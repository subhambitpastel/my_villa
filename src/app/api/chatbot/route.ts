// The chatbot endpoint. POST a question, get the answer streamed back as
// newline-delimited JSON (NDJSON): one {type:"token",text} per fragment, then a
// terminal {type:"done"} or {type:"error",message}.
//
// Deliberately NOT at /api/chat/ws — that path is the real host<->guest chat over
// the custom WebSocket server (server.mjs). This is a separate HTTP route for the
// AI assistant, so the two never collide.
//
// The CHATBOT env gate is enforced here as a hard 404: when the bot is off, the
// endpoint doesn't answer, doesn't touch the model, and doesn't even admit it
// exists — matching the widget, which isn't rendered at all. Nothing about the
// feature is reachable when CHATBOT=0.

import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { chatbotEnabled, MAX_QUESTION_CHARS, HISTORY_TURNS } from "@/lib/chatbot/config";
import { audienceFor } from "@/lib/chatbot/audience";
import { ask } from "@/lib/chatbot/graph";
import type { ChatTurn } from "@/lib/chatbot/prompt";
import { createThread, appendMessage, threadBelongsTo } from "@/lib/chatbot/threads";

// Always run at request time — this reads the session cookie and streams a live
// model response; there is nothing here to prerender or cache.
export const dynamic = "force-dynamic";

/** Coerce the posted history into clean {role,content} turns, bounded in count
 *  and length so a client can't smuggle a huge prompt through the history. */
function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as ChatTurn).role;
    const content = (item as ChatTurn).content;
    if ((role === "user" || role === "assistant") && typeof content === "string") {
      turns.push({ role, content: content.slice(0, MAX_QUESTION_CHARS) });
    }
  }
  // Keep only the most recent turns — the graph trims again, but bound it early.
  return turns.slice(-HISTORY_TURNS * 2);
}

export async function POST(request: Request) {
  // Gate first, before any work or any information leak. 404, not 403 — a
  // disabled feature is invisible, not forbidden.
  if (!chatbotEnabled()) {
    return new Response("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "You must be signed in to use the assistant." },
      { status: 401 },
    );
  }

  // Per-user throttle: the model call is comparatively expensive, so cap bursts.
  if (!rateLimit(`chatbot:${user.id}`, 20, 60_000)) {
    return Response.json(
      { error: "You're sending messages too quickly. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { question?: unknown; history?: unknown; threadId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json(
      { error: `Please keep your question under ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  }

  const history = parseHistory(body.history);
  const audience = await audienceFor(user);

  // Resolve the thread this message belongs to. A threadId from the client is
  // honoured only after threadBelongsTo confirms it's this user's — otherwise
  // (or when none is sent) we start a fresh thread. Persistence never blocks the
  // answer: if any of it fails, the chat still streams, just unsaved.
  let threadId: number | null = null;
  try {
    const asked = Number((body as { threadId?: unknown }).threadId);
    if (Number.isInteger(asked) && asked > 0 && (await threadBelongsTo(asked, user.id))) {
      threadId = asked;
    } else {
      threadId = await createThread(user.id, question);
    }
    await appendMessage(threadId, "user", question);
  } catch (err) {
    console.error("chatbot thread persistence (user turn) failed:", err);
    threadId = null; // carry on unsaved rather than failing the chat
  }

  // Stream the answer as NDJSON. The client aborts (request.signal) when the
  // user closes the widget or navigates away; that signal rides into the graph
  // and kills the CLI child, so we never keep generating for a gone reader.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      // Tell the client which thread this is, up front, so it can attach the
      // next message to the same thread and refresh its history list.
      if (threadId) send({ type: "thread", id: threadId });
      let answer = "";
      try {
        answer = await ask({
          question,
          audience,
          // Identity comes from the authenticated session — never from the
          // request body — so a user's data lookups are always their own.
          userId: user.id,
          history,
          onToken: (text) => {
            answer += text;
            send({ type: "token", text });
          },
          signal: request.signal,
        });
        send({ type: "done" });
      } catch (err) {
        // Abort is the normal "reader left" case — not an error to report.
        const aborted =
          request.signal.aborted ||
          (err instanceof Error && err.message === "aborted");
        if (!aborted) {
          console.error("chatbot generation failed:", err);
          send({
            type: "error",
            message:
              "Sorry — I couldn't answer that just now. Please try again in a moment.",
          });
        }
      } finally {
        // Save the assistant's reply so the thread reads back whole. Anything
        // that streamed is worth keeping — even a partial answer cut off by an
        // abort — so the saved thread matches what the user actually saw.
        if (threadId && answer.trim()) {
          try {
            await appendMessage(threadId, "assistant", answer);
          } catch (err) {
            console.error("chatbot thread persistence (assistant turn) failed:", err);
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Defensive: some proxies buffer unless told not to.
      "X-Accel-Buffering": "no",
    },
  });
}
