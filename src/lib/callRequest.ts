// Shared shape for "ask the host to call me" requests.
//
// Dependency-free on purpose, like lib/guests.ts: the booking card (a client
// component) and requestCallAction (server) must agree on this limit, and a
// client importing a VALUE from a module that reaches the database would pull
// `pg` into the browser bundle.

/** Longest note a guest may attach to a call request. Enforced on both sides —
 *  the textarea stops at it, and the action clamps whatever actually arrives. */
export const MAX_CALL_MESSAGE = 500;

/** Longest single chat message between a guest and a host about a request. Same
 *  ceiling as the opening note — it becomes the first message of that very
 *  thread, so a different limit would let the reply outrun what it answers. */
export const MAX_CHAT_MESSAGE = MAX_CALL_MESSAGE;

/** One message in a call-request thread. Shared by the server that reads them
 *  and the (client) thread that renders them — a type, so it erases. */
export type ChatMessage = {
  id: number;
  /** True when the signed-in viewer wrote it — which side of the thread it
   *  sits on. Resolved server-side; the client never sees who "me" is. */
  mine: boolean;
  senderName: string;
  senderAvatar: string;
  body: string;
  /** "2 hours ago" — relative, matching how the rest of the account reads. */
  when: string;
};
