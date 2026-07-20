"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/lib/actions";
import {
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_TONE,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";

/** One glyph per kind. Decorative — the title says what happened, and the
 *  screen-reader label names the kind; this only helps the eye sort them. */
function KindIcon({ type }: { type: NotificationType }) {
  const paths: Record<NotificationType, string> = {
    payment_request: "M3 7h18v10H3zM3 11h18M7 15h3",
    booking_made: "M5 12.5l4.5 4.5L19 7",
    booking_cancelled: "M6 6l12 12M18 6L6 18",
    booking_changed: "M4 12h11M11 8l4 4-4 4M20 5v14",
    call_request:
      "M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.2 11 11 0 003.5.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.5 1 1 0 01-.3 1z",
    // A speech bubble — the only kind that's someone talking to you.
    chat_message: "M4 5h16v11H8l-4 4z",
    review: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
    // A shield — support acted on something of theirs.
    moderation: "M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z",
  };
  const tone = NOTIFICATION_TONE[type];
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.fg}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d={paths[type]}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * The header's bell: how many things have happened, and what they were.
 *
 * Read/unread is only an indication — nothing gates on it — so it's kept as
 * cheap as it looks: closing the dropdown marks the lot read, and there's no
 * per-item state. The worst a misfire costs is a dot that clears early.
 */
export default function NotificationBell({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, startMarking] = useTransition();
  // No local mirror of the count: the server's number is the only one, and it
  // drops to zero on the refresh below. Copying it into state here just creates
  // a second version to keep in sync (and one that goes stale the moment a new
  // notification lands).
  const showCount = unread;

  /**
   * Mark the lot read. `refresh` only when we're STAYING on this page: the
   * action revalidates the layout, so a navigation already re-renders the
   * header with a cleared bell — and refreshing while a push is in flight
   * cancels the push, which silently swallowed the click on a notification.
   */
  function markRead(refresh: boolean) {
    if (unread === 0) return;
    startMarking(async () => {
      await markNotificationsReadAction();
      if (refresh) router.refresh();
    });
  }

  /**
   * Shutting it is what marks everything read — not opening it. Opening would
   * rewrite the list out from under the reader: the bold titles and dots they
   * opened it to see would clear while they were still looking at them. On the
   * way out they've been read, which is also just true.
   */
  function close() {
    setOpen(false);
    markRead(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          showCount > 0
            ? `Notifications, ${showCount} unread`
            : "Notifications"
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showCount > 0 && (
          // Already spoken by the button's aria-label.
          <span
            aria-hidden="true"
            style={{ height: 18, minWidth: 18 }}
            className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full border-2 border-white bg-[#eb5757] px-1 text-[10px] font-bold leading-none text-white"
          >
            {showCount > 9 ? "9+" : showCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          /* Width is an inline style, not a w-[340px] class: this file's
             arbitrary-value utilities weren't reaching the stylesheet, and the
             panel collapsed to shrink-to-fit (~120px, one word per line). The
             layout can't be left hostage to whether a utility got generated. */
          style={{ width: 340, maxWidth: "calc(100vw - 32px)" }}
          className="absolute right-0 top-[calc(100%+8px)] overflow-hidden rounded-[12px] border border-line/50 bg-white shadow-[0px_12px_40px_0px_rgba(0,0,0,0.15)]"
        >
          <p className="border-b border-line/50 px-4 py-3 text-[14px] font-semibold text-ink">
            Notifications
          </p>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
              Nothing yet. Bookings, cancellations, reviews and payment
              requests all show up here.
            </p>
          ) : (
            <ul style={{ maxHeight: 380 }}
              className="overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <KindIcon type={n.type} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] leading-[1.4] ${
                          n.read
                            ? "text-[#4a4a4a]"
                            : "font-semibold text-[#121212]"
                        }`}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-[12px] leading-[1.4] text-[#8a8a94]">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-[#a8a8b0]">
                        {n.when}
                      </span>
                    </span>
                    {/* The unread indication. Never the only signal — unread
                        titles are bold too, so this isn't colour-alone. */}
                    {!n.read && (
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                      />
                    )}
                  </>
                );
                const label = `${NOTIFICATION_KIND_LABEL[n.type]}: ${n.title}`;
                return (
                  <li key={n.id} className="border-b border-line/40 last:border-0">
                    {n.href ? (
                      <button
                        type="button"
                        role="menuitem"
                        aria-label={label}
                        onClick={() => {
                          setOpen(false);
                          // No refresh — the push below is the re-render.
                          markRead(false);
                          router.push(n.href);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-brand/5"
                      >
                        {body}
                      </button>
                    ) : (
                      <span
                        aria-label={label}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        {body}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
