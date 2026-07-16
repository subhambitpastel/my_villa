"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Avatar from "@/components/ui/Avatar";
import {
  markCallChatReadAction,
  sendCallMessageAction,
} from "@/lib/actions";
import { MAX_CHAT_MESSAGE, type ChatMessage } from "@/lib/callRequest";

/**
 * The conversation about one call request, as a dialog.
 *
 * ONE component for both ends of it — the host opens it from Call Requests, the
 * guest from My Requests. They see the same thread and the same composer; only
 * `withName` differs. Two mirrored implementations would be two places for the
 * same bug, on a screen where the two sides must agree exactly.
 *
 * `mine` is decided server-side, so neither end can render the other's message
 * as its own.
 */
export default function CallChat({
  requestId,
  withName,
  withAvatar,
  subtitle,
  messages,
  unread,
  onClose,
  onSent,
}: {
  requestId: number;
  /** The person on the other end — a chat is with someone, not with a listing. */
  withName: string;
  withAvatar: string;
  /** Which request this is about, e.g. "The Bund · 20–25 Jul". */
  subtitle: string;
  messages: ChatMessage[];
  unread: number;
  onClose: () => void;
  /** Refresh the server data behind the thread once something changes. */
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, startSend] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Opening it IS reading it — the badge shouldn't still claim unread once the
  // words are on screen. Fire-and-forget: a failed mark is a stale badge, not a
  // broken chat, and blocking the thread on it would be worse.
  useEffect(() => {
    if (unread > 0) void markCallChatReadAction(requestId).then(onSent);
    // Only on open, and only for this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // A chat opens at the newest message, not the oldest.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function send() {
    const text = body.trim();
    if (!text || sending) return;
    startSend(async () => {
      const res = await sendCallMessageAction({ requestId, body: text });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Cleared only on success, so a rejected message isn't lost — the guest
      // can fix and resend rather than retype.
      setBody("");
      setError("");
      onSent();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${withName}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close chat"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[12px] bg-white shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
        <header className="flex items-center gap-3 border-b border-line/60 px-5 py-3.5">
          <Avatar
            src={withAvatar}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-heading">
              {withName}
            </p>
            <p className="truncate text-[11.5px] text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full p-1.5 text-[#7a7a85] transition-colors hover:bg-[#f2f2f5]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div ref={boxRef} className="min-h-[180px] flex-1 space-y-3 overflow-y-auto bg-[#fafafa] px-5 py-4">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">
              No messages yet. Say hello — they&rsquo;ll see it in their account
              and get a notification.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[78%]">
                  <div
                    className={`rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.mine
                        ? "bg-brand text-white"
                        : "bg-white text-[#3a3a44] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.08)]"
                    }`}
                  >
                    {/* Their own line breaks are part of what they wrote. */}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <p
                    className={`mt-1 text-[10.5px] text-[#a1a1a2] ${
                      m.mine ? "text-right" : ""
                    }`}
                  >
                    {m.mine ? "You" : m.senderName} · {m.when}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line/60 px-5 py-3.5">
          {error && (
            <p role="alert" className="mb-2 text-[12px] text-[#eb5757]">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the convention
                // every chat has trained people into.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={MAX_CHAT_MESSAGE}
              placeholder={`Message ${withName.split(" ")[0]}…`}
              aria-label="Your message"
              className="min-h-[44px] w-full resize-none rounded-[8px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-ink placeholder:text-[#9d9da6] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !body.trim()}
              className="h-[44px] shrink-0 rounded-[8px] bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The button that opens a thread, with its unread count. Shared for the same
 *  reason as the dialog: both lists offer the identical affordance. */
export function ChatButton({
  unread,
  onClick,
}: {
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[8px] border border-brand px-4 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 5h16v11H8l-4 4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      Chat
      {unread > 0 && (
        <span
          aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white"
        >
          {unread}
        </span>
      )}
    </button>
  );
}
