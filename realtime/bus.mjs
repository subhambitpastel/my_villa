// The rendezvous between the WebSocket server (server.mjs) and the Next app.
//
// Plain JavaScript, and deliberately so: per Next's custom-server docs,
// "server.js does not run through the Next.js Compiler or bundling process",
// so it cannot import anything under src/lib (all TypeScript). This module is
// the one thing both sides can load.
//
// Both sides also get their OWN copy of this module — server.mjs loads it from
// disk, while the Next build bundles a second copy into the server chunks. Two
// copies of the code would mean two EventEmitters and messages that never
// arrive, so the STATE hangs off globalThis under a Symbol.for key: the process
// is shared even when the module instance isn't.
//
// Everything here is per-process. One Railway instance is one bus — see
// server.mjs for what that means if this is ever scaled out.
import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";

const KEY = Symbol.for("myvilla.realtime");

/** The shared state, created once per process whichever side asks first. */
function shared() {
  let state = globalThis[KEY];
  if (!state) {
    const events = new EventEmitter();
    // One connection per browser tab, and a busy host may have several open.
    // Well above that, and far below "a leak went unnoticed".
    events.setMaxListeners(0);
    state = { events, tickets: new Map() };
    globalThis[KEY] = state;
  }
  return state;
}

/* ------------------------------- tickets --------------------------------- */
//
// A WebSocket upgrade can't run a server action, and server.mjs can't read the
// session (that lives in TypeScript, over the database). So the browser asks the
// app — authenticated, as itself — for a short-lived ticket, and hands that to
// the socket. server.mjs then only has to look the ticket up.
//
// The ticket is the only thing that says who a socket is, so it is single-use
// and short-lived: a leaked one is worth nothing a moment later, and worth
// nothing twice.

/** How long a ticket may sit unused. Long enough to open a socket, short enough
 *  that a copied URL is already dead. */
const TICKET_TTL_MS = 30_000;

/** Mint a ticket for a signed-in user. Called from a server action, which has
 *  already proved who they are — this module never decides that itself. */
export function issueTicket(userId) {
  sweepTickets();
  const ticket = randomBytes(24).toString("hex");
  shared().tickets.set(ticket, { userId, expires: Date.now() + TICKET_TTL_MS });
  return ticket;
}

/** Redeem a ticket, returning its user id (or null). Single-use: consuming it
 *  deletes it, so a replayed ticket authenticates nobody. */
export function redeemTicket(ticket) {
  const { tickets } = shared();
  const found = tickets.get(ticket);
  if (!found) return null;
  tickets.delete(ticket);
  return found.expires > Date.now() ? found.userId : null;
}

/** Drop expired tickets. Called on issue: the map only grows when tickets are
 *  minted, so that's the only place it can grow unbounded. */
function sweepTickets() {
  const { tickets } = shared();
  const now = Date.now();
  for (const [key, value] of tickets)
    if (value.expires <= now) tickets.delete(key);
}

/* -------------------------------- events ---------------------------------- */

/**
 * Announce that a request's thread changed.
 *
 * `to` is the user ids allowed to hear about it (the guest and the villa's
 * owner) — the socket layer has no database, so who may know is decided here,
 * by the action that already looked both of them up.
 *
 * Carries NO message content on purpose. A ping says only "thread N changed";
 * the browser then re-reads it through the same authorized query as a normal
 * page load. That keeps one read path with one permission check, instead of a
 * second one over the socket that could drift from it.
 */
export function publishChat({ requestId, to }) {
  shared().events.emit("chat", { requestId, to });
}

/** Listen for thread changes. Returns an unsubscribe. */
export function onChat(handler) {
  const { events } = shared();
  events.on("chat", handler);
  return () => events.off("chat", handler);
}
