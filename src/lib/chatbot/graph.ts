// The RAG pipeline as a LangGraph: retrieve → generate. Server-only.
//
// Why a graph for two nodes: it's the seam for everything a support bot grows
// into — query rewriting, retrieval grading, a "should I answer this at all"
// guard, self-correction on a weak answer — each of which is a node added
// between these two, without touching the API route or the widget. The state
// shape below is what those future nodes would read and write. Today the flow is
// linear, and that's fine; the structure is the point.
//
// Generation streams tokens out through LangGraph's "custom" stream channel
// (config.writer), so the API route gets fragments as the CLI produces them
// rather than waiting for the whole answer.

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { retrieve, type RetrievedChunk } from "./store";
import { generate } from "./llm";
import { routeDataIntents } from "./router";
import { fetchUserData, type FetchedData } from "./data";
import { catalogSearch } from "./catalog";
import { SYSTEM_PROMPT, buildUserMessage, type ChatTurn } from "./prompt";
import { HISTORY_TURNS, type Audience } from "./config";

// The pipeline's state. `reducer: last-wins` on the arrays because each node sets
// them outright rather than appending — there's no accumulation across nodes.
const ChatState = Annotation.Root({
  question: Annotation<string>(),
  audience: Annotation<Audience>(),
  /** The signed-in user's id, from the session — the ONLY source of identity in
   *  the pipeline. Data tools are scoped to it; the model never sees or sets it. */
  userId: Annotation<number>(),
  history: Annotation<ChatTurn[]>({ reducer: (_, b) => b, default: () => [] }),
  chunks: Annotation<RetrievedChunk[]>({ reducer: (_, b) => b, default: () => [] }),
  data: Annotation<FetchedData[]>({ reducer: (_, b) => b, default: () => [] }),
  /** Live catalog search results (availability + pricing), or null when the
   *  question wasn't a place-to-book search. */
  catalog: Annotation<string | null>({ reducer: (_, b) => b, default: () => null }),
  answer: Annotation<string>(),
});

/** retrieve node: pull the audience-scoped doc chunks nearest the question. */
async function retrieveNode(state: typeof ChatState.State) {
  const chunks = await retrieve(state.question, state.audience);
  return { chunks };
}

/** personalize node: decide whether the question is about the user's OWN data
 *  and, if so, fetch exactly the self-scoped slices that answer it. The router
 *  gates cheap questions out, so a "how does it work" turn does no extra work
 *  here. Identity is state.userId (from the session) — never the question. */
async function personalizeNode(state: typeof ChatState.State) {
  const keys = await routeDataIntents(
    state.question,
    state.audience,
    state.history.slice(-HISTORY_TURNS),
  );
  if (keys.length === 0) return { data: [] };
  const data = await fetchUserData(keys, state.userId, state.audience);
  return { data };
}

/** catalog node: when the question is a "find/price a place to book" search,
 *  extract its parameters and run the live catalog search (availability + price).
 *  Public data, so it's not audience-gated; own listings are excluded inside. */
async function catalogNode(state: typeof ChatState.State) {
  const catalog = await catalogSearch(
    state.question,
    state.userId,
    state.history.slice(-HISTORY_TURNS),
  );
  return { catalog };
}

/** generate node: build the grounded prompt, stream the CLI's answer out through
 *  the custom writer, and store the full text on the state. */
async function generateNode(
  state: typeof ChatState.State,
  config: LangGraphRunnableConfig,
) {
  const user = buildUserMessage(
    state.question,
    state.audience,
    state.chunks,
    state.history.slice(-HISTORY_TURNS),
    state.data,
    state.catalog,
  );
  const answer = await generate({
    system: SYSTEM_PROMPT,
    user,
    onToken: (text) => config.writer?.({ type: "token", text }),
    signal: config.signal,
  });
  return { answer };
}

// retrieve (docs), personalize (own data) and catalog (live search) are all
// independent, so they fan out from START and run together; generate joins on
// all three (LangGraph waits for every edge into a node before running it).
const compiled = new StateGraph(ChatState)
  .addNode("retrieve", retrieveNode)
  .addNode("personalize", personalizeNode)
  .addNode("searchCatalog", catalogNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge(START, "personalize")
  .addEdge(START, "searchCatalog")
  .addEdge("retrieve", "generate")
  .addEdge("personalize", "generate")
  .addEdge("searchCatalog", "generate")
  .addEdge("generate", END)
  .compile();

export type AskInput = {
  question: string;
  audience: Audience;
  /** The signed-in user's id — supplied by the API route from the session. */
  userId: number;
  history?: ChatTurn[];
  /** Fires per streamed text fragment. */
  onToken: (text: string) => void;
  signal?: AbortSignal;
};

/**
 * Run one question through the pipeline, streaming tokens to `onToken`, and
 * return the finished answer. The single entry point the API route calls — it
 * never touches the graph, the store, or the CLI directly.
 */
export async function ask(input: AskInput): Promise<string> {
  let answer = "";
  const stream = await compiled.stream(
    {
      question: input.question,
      audience: input.audience,
      userId: input.userId,
      history: input.history ?? [],
    },
    { streamMode: "custom", signal: input.signal },
  );
  for await (const ev of stream) {
    if (ev && typeof ev === "object" && ev.type === "token") {
      answer += ev.text;
      input.onToken(ev.text);
    }
  }
  return answer;
}
