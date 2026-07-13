"use client";

import { useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/dates";

// A single-date picker that reuses the same popup calendar as DateRangeField
// (month nav, weekday header, day grid, brand styling) so a package's "start
// date" field matches every other calendar in the app. The stay length is
// fixed by the package, so picking a start also previews the whole span.

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
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function formatKey(key: string) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

export default function StartDateField({
  value,
  onChange,
  today,
  nights,
  isUnavailable,
  hasBlockedDates = false,
}: {
  /** Selected start date "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (day: string) => void;
  /** Earliest selectable day "YYYY-MM-DD". */
  today: string;
  /** Fixed package length — used to preview and highlight the stay span. */
  nights: number;
  /** True when a stay of `nights` starting on that day can't be booked. */
  isUnavailable: (day: string) => boolean;
  /** Whether any dates are already booked — shows the crossed-out note. */
  hasBlockedDates?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const [y, m] = (value || today).split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    const [y, m] = (value || today).split("-").map(Number);
    setView({ year: y, month: m - 1 });
    setHover(null);
    setOpen((prev) => !prev);
  }

  const viewIndex = view.year * 12 + view.month;
  const nowIndex = (() => {
    const [y, m] = today.split("-").map(Number);
    return y * 12 + (m - 1);
  })();

  const firstWeekday =
    (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(view.year, view.month + 1, 0),
  ).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // The span to highlight: the selected start (or a hovered, selectable one)
  // through its fixed-length checkout, so the whole stay lights up.
  const anchor =
    value || (hover && hover >= today && !isUnavailable(hover) ? hover : "");
  const anchorEnd = anchor ? addDays(anchor, nights) : "";

  function pick(day: string) {
    if (day < today || isUnavailable(day)) return;
    onChange(day);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`w-full min-w-0 rounded-[10px] border-[1.5px] p-[15px] text-left transition-colors ${
          open ? "border-brand" : "border-[#ddd]"
        }`}
      >
        <span className="block text-[15px] font-medium leading-[1.2] text-[#121212]">
          Choose your start date
        </span>
        <span
          className={`mt-0.5 block text-[16px] leading-[1.2] ${
            value ? "text-[#4a4a4a]" : "text-[#9d9da6]"
          }`}
        >
          {formatKey(value) ?? "Add date"}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose your start date"
          className="absolute left-0 top-[calc(100%+10px)] z-20 w-[320px] max-w-[calc(100vw-48px)] rounded-[10px] bg-white p-5 shadow-[0px_10px_30px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setView(({ year, month }) =>
                  month === 0
                    ? { year: year - 1, month: 11 }
                    : { year, month: month - 1 },
                )
              }
              disabled={viewIndex <= nowIndex}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-[16px] font-semibold text-ink">
              {MONTH_NAMES[view.month]} {view.year}
            </p>
            <button
              type="button"
              onClick={() =>
                setView(({ year, month }) =>
                  month === 11
                    ? { year: year + 1, month: 0 }
                    : { year, month: month + 1 },
                )
              }
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
              const past = key < today;
              const unavailable = !past && isUnavailable(key);
              const disabled = past || unavailable;
              const isEdge = key === anchor || key === anchorEnd;
              const inRange =
                !isEdge && !!anchor && key > anchor && key < anchorEnd;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(key)}
                  onMouseEnter={() => setHover(key)}
                  aria-label={`${day} ${MONTH_NAMES[view.month]} ${view.year}`}
                  aria-pressed={key === value}
                  title={unavailable ? `Can't fit a ${nights}-night stay` : undefined}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                    disabled
                      ? unavailable
                        ? "cursor-default text-soft/70 line-through"
                        : "cursor-default text-soft/70"
                      : isEdge
                        ? "bg-brand font-semibold text-white"
                        : inRange
                          ? "bg-[rgba(123,97,255,0.15)] text-ink"
                          : "text-ink hover:bg-[rgba(123,97,255,0.12)]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[13px] text-gray">
            Select your start date — your {nights}-night stay is highlighted.
          </p>
          {hasBlockedDates && (
            <p className="mt-1 text-[13px] text-soft">
              Crossed-out dates are unavailable — they are already booked.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
