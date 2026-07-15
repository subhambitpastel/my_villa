// Shared shape for "ask the host to call me" requests.
//
// Dependency-free on purpose, like lib/guests.ts: the booking card (a client
// component) and requestCallAction (server) must agree on this limit, and a
// client importing a VALUE from a module that reaches the database would pull
// `pg` into the browser bundle.

/** Longest note a guest may attach to a call request. Enforced on both sides —
 *  the textarea stops at it, and the action clamps whatever actually arrives. */
export const MAX_CALL_MESSAGE = 500;
