"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
type ThreadSummary = { id: number; title: string; when: string };

const GREETING =
  "Hi! I'm the MyVilla assistant. Ask me anything about booking, hosting, packages, payments or your account.";

export default function ChatbotWidget() {
  // The assistant answers as a guest or a host ("your bookings", "your
  // listings") — it has nothing to say to the back office, and a member-facing
  // bubble floating over the admin panel is exactly the blurred line the admin
  // shell exists to remove. The root layout mounts this on every page, so the
  // one place it doesn't belong opts out here.
  const onAdmin = usePathname().startsWith("/admin");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  // Which thread the current conversation is being saved to (null = a fresh
  // chat not yet given an id by the server).
  const [threadId, setThreadId] = useState<number | null>(null);
  // "chat" shows the conversation; "history" shows the list of past threads.
  const [view, setView] = useState<"chat" | "history">("chat");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

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
        body: JSON.stringify({ question, history, threadId }),
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
          let ev: { type: string; text?: string; message?: string; id?: number };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "thread" && typeof ev.id === "number") {
            // The server tells us (once) which thread this turn was saved to, so
            // the next message stays in the same thread.
            setThreadId(ev.id);
          } else if (ev.type === "token" && ev.text) {
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

  // Open the history list, always refetching so it reflects the latest thread
  // (a brand-new one created moments ago included).
  async function openHistory() {
    setView("history");
    setError(null);
    setThreadsLoading(true);
    try {
      const res = await fetch("/api/chatbot/threads");
      if (res.status === 401) {
        setNeedsLogin(true);
        setThreads([]);
        return;
      }
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }

  // Re-open a past conversation: pull its messages, drop them into the view, and
  // attach further replies to that same thread.
  async function openThread(id: number) {
    abortRef.current?.abort();
    setError(null);
    try {
      const res = await fetch(`/api/chatbot/threads/${id}`);
      if (!res.ok) throw new Error("Couldn't load that conversation.");
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setThreadId(id);
      setView("chat");
    } catch (err) {
      setError((err as Error).message || "Couldn't load that conversation.");
      setView("chat");
    }
  }

  // Start over: a clean conversation with no thread yet (the server mints one on
  // the first message).
  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setError(null);
    setNeedsLogin(false);
    setView("chat");
    setInput("");
  }

  if (onAdmin) return null;

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
                {view === "history" ? "Your past chats" : "Answers from our help guide"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              {/* History — the timer/clock icon, sitting just before Close. Toggles
                  between the current chat and the list of past conversations. */}
              <button
                type="button"
                onClick={() => (view === "history" ? setView("chat") : openHistory())}
                aria-label={view === "history" ? "Back to chat" : "Chat history"}
                aria-pressed={view === "history"}
                className={`rounded-full p-1.5 transition-colors hover:bg-white/15 ${
                  view === "history" ? "bg-white/20" : ""
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 8v4l2.5 1.5M3.5 12a8.5 8.5 0 1 0 2.2-5.7M3.5 4v3h3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="rounded-full p-1.5 transition-colors hover:bg-white/15"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          {view === "history" ? (
            <HistoryPanel
              threads={threads}
              loading={threadsLoading}
              needsLogin={needsLogin}
              activeId={threadId}
              onOpen={openThread}
              onNew={newChat}
            />
          ) : (
          <>
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
          </>
          )}
        </section>
      )}
    </>
  );
}

/** The past-conversations list, shown when the clock icon is toggled on. */
function HistoryPanel({
  threads,
  loading,
  needsLogin,
  activeId,
  onOpen,
  onNew,
}: {
  threads: ThreadSummary[];
  loading: boolean;
  needsLogin: boolean;
  activeId: number | null;
  onOpen: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] px-3 py-3">
      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-brand/30 bg-white px-3 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        New chat
      </button>

      {needsLogin ? (
        <p className="px-1 py-6 text-center text-[14px] leading-relaxed text-[#7a7a85]">
          Please{" "}
          <Link href="/login" className="font-semibold text-brand underline">
            sign in
          </Link>{" "}
          to see your past chats.
        </p>
      ) : loading ? (
        <p className="px-1 py-6 text-center text-[13px] text-[#9a9aa5]">
          Loading your chats…
        </p>
      ) : threads.length === 0 ? (
        <p className="px-1 py-6 text-center text-[14px] leading-relaxed text-[#7a7a85]">
          No past chats yet. Anything you ask is saved here so you can pick it up
          later.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className={`flex w-full flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                  t.id === activeId
                    ? "border-brand/40 bg-brand/5"
                    : "border-transparent bg-white hover:bg-[#f2f2f7]"
                }`}
              >
                <span className="line-clamp-1 w-full text-[14px] font-medium text-[#121212]">
                  {t.title}
                </span>
                <span className="text-[12px] text-[#9a9aa5]">{t.when}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
