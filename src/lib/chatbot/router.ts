// Decides whether a question is about the user's OWN data and, if so, which
// self-scoped lookups answer it. This is the "routing in the app" layer: the app
// (not the model, and not an agentic tool-loop) chooses what data to fetch, so
// the model only ever receives data — it never reaches for it.
//
// Two stages, cheapest first:
//   1. a free heuristic GATE that skips everything for plainly impersonal "how
//      does X work" questions, so the common case pays nothing extra; then
//   2. an LLM CLASSIFIER (one cheap call) that maps a personal question to a set
//      of tool keys from the audience's own menu.
//
// The classifier returns KEYS ONLY — never ids or parameters — and its output is
// filtered against the audience's allowed keys, so a hallucinated or
// wrong-audience key simply doesn't run.

import { generate } from "./llm";
import { toolsForAudience } from "./data";
import type { Audience } from "./config";
import type { ChatTurn } from "./prompt";

/**
 * Does this question even plausibly ask about the user's own account? A first-
 * person reference ("my", "I", "me", "our") or an account verb ("booked",
 * "owe", "paid", "saved", "listed"…) is the signal. No signal ⇒ it's a how-does-
 * it-work question ⇒ skip the classifier entirely (the fast path). The gate errs
 * toward TRUE: a false positive costs one cheap classifier call that returns
 * nothing, while a false negative would leave a real data question unanswered.
 */
export function hasPersonalDataSignal(question: string): boolean {
  const q = ` ${question.toLowerCase()} `;
  const firstPerson = /\b(my|mine|myself|i|i'm|im|i've|ive|me|our|ours|we)\b/.test(q);
  const accountVerb =
    /\b(book(ed|ing|ings)?|reserv\w*|owe|owed|paid|pay(ment|ments)?|due|cancel\w*|refund\w*|stay(s|ed)?|favou?rite\w*|wishlist|saved|listing\w*|propert\w*|villa\w*|request\w*|earn\w*|rat(e|ed|ing)\w*)\b/.test(
      q,
    );
  return firstPerson || accountVerb;
}

/** Constant classifier persona — kept stable so its CLI prefix caches, exactly
 *  like the answer persona. It does one job and returns one shape. */
const SYSTEM_CLASSIFY = `You are an intent router for a booking platform's assistant. You do NOT answer questions.

Given a user's message and a menu of data lookups, decide which lookups (if any) are needed to answer it from the user's OWN account data.

Output ONLY a JSON array of the matching lookup keys, e.g. ["recent_bookings"], or [] if the question needs none (for example, a general "how does it work" question, or small talk). Output nothing else — no prose, no explanation, no code fences.

Pick a lookup only when the question is about THIS user's own data. Prefer the smallest set that covers the question; usually zero or one key, occasionally two.

Use the recent conversation to resolve follow-ups: a short question like "how many are there?" or "what about hotels?" right after the user asked about their own properties or bookings is still about that same personal data — pick the matching lookup.`;

/** Extract the first JSON array of strings from the model's text, leniently. */
function parseKeys(text: string): string[] {
  const match = /\[[^\]]*\]/.exec(text);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The tool keys needed to answer `question` for `audience`, or [] for a
 * doc-only question. Runs the gate first (free), then the classifier, then
 * filters to keys that actually exist for this audience — so nothing outside the
 * audience's own menu can ever be selected. On any classifier failure it returns
 * [] and the turn falls back to a docs-only answer rather than erroring.
 */
export async function routeDataIntents(
  question: string,
  audience: Audience,
  history: ChatTurn[] = [],
): Promise<string[]> {
  // The gate looks at the current question AND recent turns: a bare follow-up
  // ("what about hotels?") may carry no first-person word of its own, but is
  // personal because the turn before it was. Checking history here keeps such
  // follow-ups from being dropped before the classifier ever sees them.
  const gateText = [...history.slice(-2).map((t) => t.content), question].join(" ");
  if (!hasPersonalDataSignal(gateText)) return [];

  const tools = toolsForAudience(audience);
  const menu = tools.map((t) => `- ${t.key}: ${t.description}`).join("\n");
  const valid = new Set(tools.map((t) => t.key));

  // Give the classifier the last couple of turns so it can resolve context-
  // dependent follow-ups to the right lookup.
  const convo =
    history.length > 0
      ? "Recent conversation:\n" +
        history
          .slice(-4)
          .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
          .join("\n") +
        "\n\n"
      : "";

  let raw: string;
  try {
    raw = await generate({
      system: SYSTEM_CLASSIFY,
      user: `Available lookups:\n${menu}\n\n${convo}User message: ${question}\n\nJSON array of matching keys:`,
    });
  } catch {
    return [];
  }

  // Keep only real keys for this audience, and cap the number so one message
  // can't fan out into every lookup at once.
  return [...new Set(parseKeys(raw))].filter((k) => valid.has(k)).slice(0, 3);
}
