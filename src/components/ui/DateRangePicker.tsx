"use client";

import { useEffect, useRef, useState } from "react";
import { now as clockNow } from "@/lib/clock";

/**
 * A plain two-ended date range picker — the booking calendar's look with none
 * of its rules.
 *
 * Deliberately NOT `DateRangeField`: that one exists to sell a stay, so it
 * blocks the past, honours the booking window, blacks out taken nights and
 * counts rooms. A filter over records that ALREADY happened needs the exact
 * opposite — every date reachable, in both directions, nothing disabled. The
 * two share an appearance, not a job.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
// YYYY-MM-DD keys compare correctly as plain strings.
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayKey() {
  const now = clockNow();
  return keyOf(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "2026-09-03" → "03 Sep 2026" */
export function formatRangeKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${pad(d)} ${MONTH_SHORT[m - 1]} ${y}`;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  ariaLabel,
  placeholder = "Any dates",
  buttonClassName = "",
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  ariaLabel: string;
  /** Trigger text when no range is picked. */
  placeholder?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const [y, m] = (from ?? todayKey()).split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    const [y, m] = (from ?? todayKey()).split("-").map(Number);
    setView({ year: y, month: m - 1 });
    setHover(null);
    setOpen(true);
  }

  // One end picked → the next click closes the range; a complete range (or a
  // click before the start) starts a fresh one.
  function pick(day: string) {
    if (from && !to && day >= from) {
      onChange(from, day);
      setOpen(false);
    } else {
      onChange(day, null);
    }
  }

  const firstWeekday =
    (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(view.year, view.month + 1, 0),
  ).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // While the second end is open, the hovered day previews where it lands.
  const previewEnd = to ?? (from && hover && hover >= from ? hover : null);
  const today = todayKey();

  const label = from
    ? to
      ? `${formatRangeKey(from)} – ${formatRangeKey(to)}`
      : `${formatRangeKey(from)} – …`
    : placeholder;

  const step = (delta: number) =>
    setView(({ year, month }) => {
      const next = month + delta;
      return next < 0
        ? { year: year - 1, month: 11 }
        : next > 11
          ? { year: year + 1, month: 0 }
          : { year, month: next };
    });

  return (
    <div
      ref={wrapRef}
      className="relative"
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={buttonClassName}
      >
        <span className="truncate">{label}</span>
        <svg
          width="11"
          height="7"
          viewBox="0 0 9 6"
          fill="none"
          aria-hidden="true"
          className={`ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[300px] max-w-[calc(100vw-48px)] rounded-[10px] border border-[#e3e3e8] bg-white p-5 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.16)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)]"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-[15px] font-semibold text-ink">
              {MONTH_NAMES[view.month]} {view.year}
            </p>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)]"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-[12px] text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div
            className="mt-1 grid grid-cols-7 gap-y-1"
            onMouseLeave={() => setHover(null)}
          >
            {cells.map((day, i) => {
              if (day === null) return <span key={`empty-${i}`} />;
              const key = keyOf(view.year, view.month, day);
              const isEdge = key === from || key === to;
              const inRange =
                !isEdge &&
                from !== null &&
                previewEnd !== null &&
                key >= from &&
                key <= previewEnd;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  onMouseEnter={() => setHover(key)}
                  aria-pressed={isEdge}
                  aria-label={`${day} ${MONTH_NAMES[view.month]} ${view.year}`}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                    isEdge
                      ? "bg-brand font-semibold text-white"
                      : inRange
                        ? "bg-[rgba(123,97,255,0.15)] text-ink"
                        : key === today
                          ? "font-semibold text-brand hover:bg-[rgba(123,97,255,0.12)]"
                          : "text-ink hover:bg-[rgba(123,97,255,0.12)]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[13px] text-gray">
              {!from ? "Pick the first day" : !to ? "Now pick the last day" : "Range selected"}
            </p>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  onChange(null, null);
                  setHover(null);
                }}
                className="shrink-0 text-[13px] text-brand underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
