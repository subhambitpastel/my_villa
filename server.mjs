// Custom Next server, existing for exactly one reason: `next start` cannot host
// a WebSocket, and the call-request chat is real-time.
//
// Per Next's custom-server guide, this file does NOT go through the Next
// compiler — it must be plain, runnable Node. That's why it does no session
// lookup and touches no database: all of that is TypeScript under src/lib and
// unreachable from here. It authenticates by redeeming a ticket the app already
// issued to a signed-in user, and relays pings. Nothing else.
//
// SCALE: the bus behind this is per-process, so two app instances would each
// only reach their own sockets. Fine at one instance (Railway's default); if
// this is ever scaled out, the bus needs to move to Postgres LISTEN/NOTIFY —
// the seam for that is realtime/bus.mjs, not this file.
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { onChat, redeemTicket } from "./realtime/bus.mjs";

// Mode comes from a flag, not from `NODE_ENV=x npm start` as the docs' example
// does: that syntax isn't valid on Windows, and this repo is developed there.
// Deriving NODE_ENV from the flag keeps one answer on both platforms.
const dev = process.argv.includes("--dev");
process.env.NODE_ENV ??= dev ? "development" : "production";

// Imported dynamically, and only now: `next` reads NODE_ENV as it loads (it's
// what picks the production React build), and a static import would be hoisted
// above the line that sets it.
const { default: next } = await import("next");

const port = parseInt(process.env.PORT || "3000", 10);
// 0.0.0.0, not localhost: a container's port is published from outside it.
const hostname = process.env.HOSTNAME || "0.0.0.0";

/** Where the browser connects. Anything else upgrading is not ours. */
const WS_PATH = "/api/chat/ws";

const server = createServer((req, res) => handle(req, res));

// `httpServer` matters: it's how Next attaches its OWN upgrade handling (dev
// HMR runs over a WebSocket on this very server). Without it, hot reload dies
// the moment we start listening for upgrades.
//
// `webpack: true` in dev, deliberately. The programmatic next() defaults to
// Turbopack, whose CSS pipeline PANICS on Windows: Tailwind v4's PostCSS plugin
// lists the null device as a dependency, and Turbopack tries to read
// "<project>\NUL" — a reserved device name, not a file — which fails with
// "Incorrect function (os error 1)" and 500s every page. Webpack's postcss
// loader handles it (it's the same path `next build` uses, which compiles this
// CSS fine). NOTE: `turbopack: false` does NOT work — next treats it as
// falsy/absent and still picks Turbopack; `webpack: true` is the real opt-out
// (see createServer in next/dist/server/next.js). Only dev compiles; production
// serves the prebuilt output and never bundles here, so the flag is dev-only.
const app = next({
  dev,
  httpServer: server,
  ...(dev ? { webpack: true } : {}),
});
const handle = app.getRequestHandler();

// noServer: we do the upgrade by hand so we can decline anything that isn't
// ours and leave the socket alone — Next's HMR listener gets it instead. A
// plain `new WebSocketServer({ server })` would swallow every upgrade.
const wss = new WebSocketServer({ noServer: true });

/** Live sockets, each tagged with the user it was authenticated as. */
const clients = new Set();

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== WS_PATH) return; // not ours — Next's HMR handler takes it

  // A ticket, not a cookie: reading the session means reading the database, and
  // this file can't. The app vouched for them already; we just redeem it.
  const userId = redeemTicket(url.searchParams.get("ticket") ?? "");
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.userId = userId;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    // Nothing a client says is trusted or needed — messages are sent through
    // the server action, which does the real authorization. This socket is
    // one-way in practice; ignoring input keeps it that way.
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    clients.add(ws);
    wss.emit("connection", ws, req);
  });
});

// One subscription for the whole process, fanning out to sockets. `to` is the
// guest and the owner of that request — resolved by the action that wrote the
// message, since we have no way to look it up.
onChat(({ requestId, to }) => {
  const payload = JSON.stringify({ type: "chat", requestId });
  for (const ws of clients) {
    if (ws.readyState !== ws.OPEN || !to.includes(ws.userId)) continue;
    ws.send(payload);
  }
});

// Proxies and phone networks drop idle sockets silently, leaving a browser that
// thinks it's connected and a chat that has quietly stopped being live. Ping
// often enough to keep them open, and reap whatever stopped answering.
const HEARTBEAT_MS = 30_000;
const heartbeat = setInterval(() => {
  for (const ws of clients) {
    if (!ws.isAlive) {
      clients.delete(ws);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);
heartbeat.unref();

app.prepare().then(() => {
  server.listen(port, hostname, () => {
    console.log(
      `> MyVilla on http://${hostname}:${port} (${dev ? "development" : process.env.NODE_ENV}) — chat socket at ${WS_PATH}`,
    );
  });
});
