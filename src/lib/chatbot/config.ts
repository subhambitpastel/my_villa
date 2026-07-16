// Shared chatbot constants and the master on/off switch.
//
// A plain module on purpose (no "use client"): the root layout (server) and the
// widget (client) both read from here, and value exports from a client module
// turn into proxies when a server component imports them.

/** Which document a user's questions are answered from. Mirrors the app's own
 *  notion of "is this person a host" — see isHostAudience in audience.ts. */
export type Audience = "guest" | "owner";

/**
 * The master switch, from the CHATBOT env var: "1" = on, anything else = off.
 *
 * Read through a function rather than exported as a const so it is evaluated per
 * call. A module-level const would be frozen at import time, which on the server
 * means "whatever the value was when the module first loaded" — surprising when
 * the var is changed and only some routes pick it up.
 *
 * Server-only: CHATBOT is deliberately NOT prefixed NEXT_PUBLIC_, so it never
 * reaches the browser bundle. The layout reads it and passes the boolean down.
 */
export const chatbotEnabled = (): boolean => process.env.CHATBOT === "1";

/** The docs each audience is answered from, relative to the repo root. */
export const DOC_FOR: Record<Audience, string> = {
  guest: "ABOUT_PROJECT_GUEST.md",
  owner: "ABOUT_PROJECT_OWNER.md",
};

/** Embedding model. all-MiniLM-L6-v2 is 384-dim and runs locally with no API
 *  key — the only reason this project can do real vector search at all. */
export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIMS = 384;

/**
 * Hard ceiling on the text handed to the embedder. MiniLM truncates at 256
 * word-pieces and silently drops the rest, so a chunk longer than roughly this
 * would embed only its opening — the tail would be unfindable while still
 * looking indexed. The chunker keeps bodies under this for that reason alone.
 */
export const MAX_CHUNK_CHARS = 1000;

/** Chunks handed to the model per answer. Generous on purpose: the retrieved
 *  text rides in the user message (a few thousand tokens), which is cheap next
 *  to the CLI's own cached prefix, and recall matters more than precision when
 *  the model can ignore an irrelevant chunk but can't invent a missing one. */
export const RETRIEVE_K = 8;

/** Longest question accepted. Bounds both the embedding call and the prompt. */
export const MAX_QUESTION_CHARS = 500;

/** Turns of history replayed into the prompt (user+assistant pairs). Enough for
 *  "what about for a hotel?" to resolve, without unbounded growth. */
export const HISTORY_TURNS = 6;
