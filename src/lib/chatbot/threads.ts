// Persistence for the assistant's conversations, so a user can leave and come
// back to a past chat. Server-only.
//
// Its own two tables, deliberately separate from `call_messages` (the real
// host<->guest chat): that thread is a conversation between two PEOPLE about one
// booking and is deleted when the request resolves; THIS is one person's history
// with the bot, kept until they clear it. Different lifecycle, different owner,
// different table.
//
// Schema is applied lazily (like the doc_chunks store), never at app boot, so a
// database without these tables — or with the chatbot turned off — can't break
// startup. No pgvector needed here; these are plain relational rows.

import { getDb, timeAgo } from "@/lib/db";

/** One message as stored/replayed — the same shape the widget and the graph
 *  already speak, so a loaded thread drops straight back into the UI. */
export type StoredMessage = { role: "user" | "assistant"; content: string };

/** A thread in the history list (no messages — just enough to show a row). */
export type ThreadSummary = { id: number; title: string; when: string };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chatbot_threads (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS chatbot_messages (
  id         SERIAL PRIMARY KEY,
  thread_id  INTEGER NOT NULL REFERENCES chatbot_threads(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_chatbot_threads_user ON chatbot_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_thread ON chatbot_messages(thread_id, id);
`;

let ready: Promise<void> | null = null;

/** Create the thread tables once per process. Reset on failure so a transient
 *  error can be retried rather than cached as permanently broken. */
export function ensureThreadSchema(): Promise<void> {
  if (!ready) {
    ready = getDb()
      .exec(SCHEMA)
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

/** A short, human title from the first question — what the history row shows. */
const titleFrom = (text: string): string => {
  const t = text.trim().replace(/\s+/g, " ");
  return (t.length > 60 ? t.slice(0, 57) + "…" : t) || "New chat";
};

/** Start a thread for `userId`, titled from its opening question. */
export async function createThread(
  userId: number,
  firstQuestion: string,
): Promise<number> {
  await ensureThreadSchema();
  const row = await getDb()
    .prepare(
      "INSERT INTO chatbot_threads (user_id, title) VALUES (?, ?) RETURNING id",
    )
    .run(userId, titleFrom(firstQuestion));
  return Number(row.lastInsertRowid);
}

/**
 * Confirm a thread belongs to `userId`. Every thread operation goes through this
 * — it is the wall that stops one user touching another's history: an id from
 * the client is only ever acted on after this says it's theirs.
 */
export async function threadBelongsTo(
  threadId: number,
  userId: number,
): Promise<boolean> {
  await ensureThreadSchema();
  const row = await getDb()
    .prepare("SELECT 1 AS ok FROM chatbot_threads WHERE id = ? AND user_id = ?")
    .get<{ ok: number }>(threadId, userId);
  return !!row;
}

/** Append one message to a thread and bump its updated_at so it floats to the
 *  top of the history list. Caller must have verified ownership first. */
export async function appendMessage(
  threadId: number,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await ensureThreadSchema();
  const db = getDb();
  await db
    .prepare(
      "INSERT INTO chatbot_messages (thread_id, role, content) VALUES (?, ?, ?)",
    )
    .run(threadId, role, content);
  await db
    .prepare(
      "UPDATE chatbot_threads SET updated_at = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?",
    )
    .run(threadId);
}

/** The user's threads, most-recently-active first. */
export async function listThreads(userId: number): Promise<ThreadSummary[]> {
  await ensureThreadSchema();
  const rows = await getDb()
    .prepare(
      `SELECT id, title, updated_at FROM chatbot_threads
       WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 50`,
    )
    .all<{ id: number; title: string; updated_at: string }>(userId);
  return rows.map((r) => ({ id: r.id, title: r.title, when: timeAgo(r.updated_at) }));
}

/** One thread's messages in order — but only if it's this user's. Returns null
 *  for a missing thread or one belonging to someone else (same 404 either way,
 *  so the caller can't tell "not yours" from "doesn't exist"). */
export async function getThreadMessages(
  threadId: number,
  userId: number,
): Promise<StoredMessage[] | null> {
  if (!(await threadBelongsTo(threadId, userId))) return null;
  const rows = await getDb()
    .prepare(
      `SELECT role, content FROM chatbot_messages
       WHERE thread_id = ? ORDER BY id ASC`,
    )
    .all<StoredMessage>(threadId);
  return rows;
}
