"use client";

import { useEffect, useRef } from "react";
import { issueChatTicketAction } from "@/lib/actions";

/**
 * Holds a WebSocket to the chat server and calls `onChange` when one of this
 * user's request threads changes.
 *
 * The socket carries no message content — only "thread N changed" — so this
 * hook's job ends at telling the caller to re-read through the normal
 * authorized path. That keeps one read path with one permission check.
 *
 * Everything here is best-effort. A dropped socket means the chat degrades to
 * "updates when you act", not "chat is broken": the messages themselves go
 * through a server action, which never depended on this.
 */
export function useChatSocket(onChange: (requestId: number) => void) {
  // Through a ref so a caller passing an inline arrow (all of them) doesn't
  // tear the socket down and rebuild it on every render. Synced in an effect
  // rather than assigned during render, which React forbids — safe here because
  // the socket only ever reads it later, from a message.
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // Survives the async gap below: without it, a socket opened after unmount
    // would be left running.
    let live = true;

    async function connect() {
      if (!live) return;
      // A fresh ticket per attempt — they're single-use, so a reconnect can't
      // replay the last one.
      const ticket = await issueChatTicketAction();
      if (!live || !ticket) return; // signed out: no socket, no retry

      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${location.host}/api/chat/ws?ticket=${encodeURIComponent(ticket)}`,
      );
      socket = ws;

      ws.onopen = () => {
        attempt = 0; // a good connection resets the backoff
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data?.type === "chat" && typeof data.requestId === "number")
            handler.current(data.requestId);
        } catch {
          // A malformed frame is not worth breaking the page over.
        }
      };
      ws.onclose = () => {
        if (!live) return;
        // Back off so a server restart doesn't get hammered by every open tab
        // at once. Capped, because the chat should come back on its own.
        attempt += 1;
        const wait = Math.min(1000 * 2 ** (attempt - 1), 30_000);
        retry = setTimeout(connect, wait);
      };
      // onerror is always followed by onclose, which already handles retrying.
      ws.onerror = () => ws.close();
    }

    void connect();

    return () => {
      live = false;
      if (retry) clearTimeout(retry);
      // Drop the handler first: closing fires onclose, which would otherwise
      // schedule a reconnect for a component that's going away.
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);
}
