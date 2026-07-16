"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MiniMarkdown from "./MiniMarkdown";

// The floating assistant. Rendered only when the server says the feature is on
// (see the root layout), so when CHATBOT=0 this component never reaches the page
// at all — there is no button, no bundle path, nothing to disable client-side.
//
// It talks to POST /api/chatbot, which streams the answer back as NDJSON
// ({type:"token"|"done"|"error"}). Audience (guest vs owner doc) is decided
// server-side from the session, so the widget itself carries no such knowledge —
// the same widget serves both, and answers follow whoever is signed in.

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi! I'm the MyVilla assistant. Ask me anything about booking, hosting, packages, payments or your account.";

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Keep the newest message in view as text streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  // Focus the box when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close when clicking anywhere outside the panel. The launcher is excluded so
  // its own onClick toggle stays the one that closes it — otherwise this would
  // close on the mousedown and the click would immediately reopen it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        launcherRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Abort any in-flight request if the widget unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setNeedsLogin(false);
    setInput("");

    // History sent for follow-up context = the conversation before this turn.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    // Optimistically add the user's message and an empty assistant bubble that
    // fills in as tokens stream.
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        setNeedsLogin(true);
        // Drop the empty assistant bubble we added.
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok || !res.body) {
        const msg = await res
          .json()
          .then((d) => d.error as string)
          .catch(() => null);
        throw new Error(msg || "Request failed.");
      }

      // Read the NDJSON stream: parse whole lines as they arrive, append token
      // text to the last (assistant) message.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: { type: string; text?: string; message?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "token" && ev.text) {
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + ev.text };
              }
              return next;
            });
          } else if (ev.type === "error") {
            streamError = ev.message || "Something went wrong.";
          }
        }
      }

      if (streamError) {
        setError(streamError);
        // Remove the (empty or partial) assistant bubble if it never got text.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === "assistant" && last.content === ""
            ? prev.slice(0, -1)
            : prev;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Something went wrong. Please try again.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant" && last.content === ""
          ? prev.slice(0, -1)
          : prev;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter makes a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open MyVilla assistant"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_30px_rgba(93,95,239,0.45)] transition-transform hover:scale-105 hover:bg-brand-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8A2.5 2.5 0 0117.5 16H9l-4 3.5V16H6.5A2.5 2.5 0 014 13.5v-8z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="MyVilla assistant"
          className="fixed bottom-24 right-5 z-[60] flex h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-[390px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
        >
          {/* Header */}
          <header className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8A2.5 2.5 0 0117.5 16H9l-4 3.5V16H6.5A2.5 2.5 0 014 13.5v-8z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight">MyVilla Assistant</p>
              <p className="text-[12px] leading-tight text-white/80">
                Answers from our help guide
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="ml-auto rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[#fafafa] px-3 py-4"
          >
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-[#333] shadow-sm">
                {GREETING}
              </div>
            </div>

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
                      : "max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[#333] shadow-sm"
                  }
                >
                  {m.role === "user" ? (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  ) : m.content ? (
                    <MiniMarkdown text={m.content} />
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            ))}

            {needsLogin && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-[#333] shadow-sm">
                  Please{" "}
                  <Link href="/login" className="font-semibold text-brand underline">
                    sign in
                  </Link>{" "}
                  to chat with the assistant.
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#fdecec] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#c0392b]">
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-black/5 bg-white p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={500}
                placeholder="Ask a question…"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[10px] border border-[#e0e0e6] bg-white px-3 py-2.5 text-[14px] text-[#121212] placeholder:text-[#a0a0aa] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12l16-8-6 16-3-7-7-1z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-[#9a9aa5]">
              Answers come from MyVilla&apos;s help guide and may not be perfect.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

/** The three-dot "thinking" indicator shown before the first token arrives. */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-[#c4c4cc]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
