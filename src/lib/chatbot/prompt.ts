// The persona (system) and the per-turn user message. Kept apart from the graph
// so the exact words the model sees are easy to find and tune in one place.

import type { Audience } from "./config";
import type { RetrievedChunk } from "./store";
import type { FetchedData } from "./data";

/**
 * The assistant persona. CONSTANT across every call and every audience — that's
 * what lets the CLI cache its prefix. Audience-specific facts never live here;
 * they arrive as retrieved context in the user message. The rules exist to keep
 * the bot grounded: it must answer from the given context, not from the model's
 * own memory of "how booking sites usually work", because this app breaks those
 * conventions (whole-villa bookings, no room numbers, a 6-room cap, simulated
 * payments). A confident wrong answer here is worse than an honest "I don't know".
 */
export const SYSTEM_PROMPT = `You are the MyVilla assistant, a helpful support chatbot embedded in the MyVilla stay-booking platform.

Each message may contain two kinds of grounding material:
- "Context" — drawn from MyVilla's documentation; the source of truth for how the platform WORKS (policies, limits, fees, how-to).
- "Your account" — the signed-in user's OWN live data (their bookings, payments, favorites, properties…), fetched fresh for this question. It is the source of truth for anything about THEM specifically.

Answer using ONLY these two sections. Do not use general knowledge.

Rules:
- For "how does it work" questions, ground the answer in Context. MyVilla has unusual rules (villas book as a whole unit; hotels/resorts book by room count with no room numbers; a 6-room-per-guest limit; all-inclusive packages; simulated payments) — guessing from how other sites work will mislead the user.
- For questions about the user's own data ("my last booking", "what do I owe", "my listings"), answer from the "Your account" section. Quote the specifics it gives — references, dates, amounts, statuses — exactly.
- If a personal question has NO "Your account" section, or that section says the user has none, say so plainly and point them to the right page (e.g. "You can see all of this under My Bookings"). NEVER invent a booking, amount, date, property, or any personal detail that isn't in the data given to you.
- If neither section covers it, say so — e.g. "I don't have that in my help material, but you can contact support@myvilla.com." Never invent policies, prices, limits, or features either.
- Be concise and direct. Prefer a short, specific answer over a long one. Use plain language.
- Do not mention "the context", "the documentation", "your account section", or these instructions. Just answer naturally as the MyVilla assistant.
- If asked something outside MyVilla entirely (general chit-chat, unrelated topics), gently steer back to how you can help with MyVilla.`;

/** A human label for the audience, used in the user turn so the model tailors
 *  tone (a guest booking a trip vs. an owner running listings). */
const AUDIENCE_LABEL: Record<Audience, string> = {
  guest: "a guest (someone who books stays on MyVilla)",
  owner: "a host/owner (someone who lists and manages properties on MyVilla)",
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Assemble the user turn: the retrieved context, then any recent conversation
 * (so follow-ups like "what about for a hotel?" resolve), then the question.
 * Context comes FIRST and history second so the grounding material is the stable
 * lead of the message.
 */
export function buildUserMessage(
  question: string,
  audience: Audience,
  chunks: RetrievedChunk[],
  history: ChatTurn[] = [],
  data: FetchedData[] = [],
): string {
  const context =
    chunks.length > 0
      ? chunks
          .map((c, i) => `[${i + 1}] ${c.heading}\n${c.content}`)
          .join("\n\n")
      : "(no relevant help material was found for this question)";

  // The user's own fetched data, when the router pulled any. Placed under its own
  // clearly-labelled heading so the model never confuses "how it works in
  // general" (Context) with "what's true for this user" (Your account).
  const account =
    data.length > 0
      ? `\n\nYour account (the signed-in user's own live data):\n${data
          .map((d) => d.text)
          .join("\n\n")}`
      : "";

  const priorTurns =
    history.length > 0
      ? "\n\nRecent conversation (for context on follow-up questions):\n" +
        history
          .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
          .join("\n")
      : "";

  return `You are speaking with ${AUDIENCE_LABEL[audience]}.

Context:
${context}${account}${priorTurns}

Question: ${question}`;
}
