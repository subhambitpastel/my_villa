"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

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

/** The calendar day before `key` (handles month/year boundaries). */
const prevDayKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const p = new Date(Date.UTC(y, m - 1, d - 1));
  return keyOf(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
};

function todayKey() {
  const now = new Date();
  return keyOf(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatKey(key: string | null) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

type Field = "checkin" | "checkout";

export default function DateRangeField({
  checkIn,
  checkOut,
  onChange,
  variant = "hero",
  bookedRanges = [],
}: {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
  /** "hero" = home search widget; "compact" = search filter panel;
   *  "booking" = large villa booking card. */
  variant?: "hero" | "compact" | "booking";
  /** Confirmed stays whose days should be blocked in the calendar. */
  bookedRanges?: { checkIn: string; checkOut: string }[];
}) {
  const [active, setActive] = useState<Field | null>(null);
  const [view, setView] = useState({ year: 0, month: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setActive(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [active]);

  function openField(field: Field) {
    const base =
      (field === "checkout" ? checkOut ?? checkIn : checkIn) ?? todayKey();
    const [y, m] = base.split("-").map(Number);
    setView({ year: y, month: m - 1 });
    setHover(null);
    setActive((prev) => (prev === field ? null : field));
  }

  // A day is booked if it falls inside a confirmed stay [checkIn, checkOut)
  // (half-open — a checkout day is free for the next guest's check-in).
  const isBooked = (key: string) =>
    bookedRanges.some((r) => key >= r.checkIn && key < r.checkOut);
  // True if the stay [from, to) would overlap any confirmed booking.
  const spanCrossesBooked = (from: string, to: string) =>
    bookedRanges.some((r) => r.checkIn < to && r.checkOut > from);

  function pick(day: string) {
    if (
      active === "checkout" &&
      checkIn &&
      day > checkIn &&
      !spanCrossesBooked(checkIn, day)
    ) {
      onChange(checkIn, day);
      setActive(null);
    } else {
      // Picking check-in, or a check-out on/before check-in, or a range that
      // would cross a booked block: restart the range from this day.
      const keepOut =
        checkOut && checkOut > day && !spanCrossesBooked(day, checkOut)
          ? checkOut
          : null;
      onChange(day, keepOut);
      setActive("checkout");
    }
  }

  const today = todayKey();
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
  // The "unavailable dates" note should track the month actually on screen — a
  // booking in some other month shouldn't claim there are crossed-out dates here
  // (e.g. editing your own stay, whose month has no other bookings to cut).
  const monthHasBooked = cells.some(
    (day) => day !== null && isBooked(keyOf(view.year, view.month, day)),
  );

  // While choosing check-out, the hovered day previews the range end — but not
  // across a booked block (that range can't be selected anyway).
  const previewEnd =
    checkOut ??
    (active === "checkout" &&
    checkIn &&
    hover &&
    hover > checkIn &&
    !spanCrossesBooked(checkIn, hover)
      ? hover
      : null);

  const fields: { field: Field; label: string; value: string | null }[] = [
    { field: "checkin", label: "Check In", value: checkIn },
    { field: "checkout", label: "Check Out", value: checkOut },
  ];

  return (
    <div
      ref={wrapRef}
      onKeyDown={(e) => e.key === "Escape" && setActive(null)}
      className={
        variant === "compact"
          ? "relative flex items-center gap-4"
          : variant === "booking"
            ? "relative flex flex-col gap-3 sm:flex-row"
            : "relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-14"
      }
    >
      {fields.map(({ field, label, value }, i) => (
        <span
          key={field}
          className={
            variant === "compact"
              ? "contents"
              : variant === "booking"
                ? "min-w-0 flex-1"
                : undefined
          }
        >
          {variant === "compact" && i > 0 && (
            <span aria-hidden className="h-px w-3 shrink-0 bg-[#8a8a94]" />
          )}
          {variant === "booking" ? (
            <button
              type="button"
              onClick={() => openField(field)}
              aria-expanded={active === field}
              aria-haspopup="dialog"
              className={`w-full min-w-0 rounded-[10px] border-[1.5px] p-[15px] text-left transition-colors ${
                active === field ? "border-brand" : "border-[#ddd]"
              }`}
            >
              <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
                {label}
              </span>
              <span
                className={`mt-0.5 block text-[16px] leading-[1.2] ${
                  value ? "text-[#4a4a4a]" : "text-[#9d9da6]"
                }`}
              >
                {formatKey(value) ?? "Add date"}
              </span>
            </button>
          ) : variant === "compact" ? (
            <button
              type="button"
              onClick={() => openField(field)}
              aria-expanded={active === field}
              aria-haspopup="dialog"
              className={`min-w-0 flex-1 rounded-[6px] border px-3 py-1.5 text-left transition-colors ${
                active === field ? "border-brand" : "border-[#c9c9d4]"
              }`}
            >
              <span className="block text-[10px] text-[#8a8a94]">
                {label.toLowerCase()}
              </span>
              <span
                className={`block truncate text-[13px] ${
                  active === field
                    ? "text-brand"
                    : value
                      ? "text-[#121212]"
                      : "text-[#9d9da6]"
                }`}
              >
                {formatKey(value) ?? "Add date"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openField(field)}
              aria-expanded={active === field}
              aria-haspopup="dialog"
              className="flex flex-col gap-2 text-left"
            >
              <span className="text-[18px] text-muted">{label}</span>
              <span className="flex items-center">
                <img
                  src="/icons/calendar.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0"
                />
                <span
                  className={`w-[150px] pl-2 pr-8 text-[18px] font-bold ${
                    active === field
                      ? "text-violet"
                      : value
                        ? "text-ink"
                        : "text-muted"
                  }`}
                >
                  {formatKey(value) ?? "Add date"}
                </span>
                <img
                  src="/icons/chevron-down.svg"
                  alt=""
                  width={32}
                  height={32}
                  className="pointer-events-none -ml-8 h-8 w-8 shrink-0"
                />
              </span>
            </button>
          )}
        </span>
      ))}

      {active && (
        <div
          role="dialog"
          aria-label="Choose your stay dates"
          className="absolute left-0 top-[calc(100%+10px)] z-20 w-[320px] max-w-[calc(100vw-48px)] rounded-[10px] bg-white p-5 shadow-[0px_10px_30px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setView(({ year, month }) =>
                  month === 0
                    ? { year: year - 1, month: 11 }
                    : { year, month: month - 1 },
                );
              }}
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
              onClick={() => {
                setView(({ year, month }) =>
                  month === 11
                    ? { year: year + 1, month: 0 }
                    : { year, month: month + 1 },
                );
              }}
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
              const booked = isBooked(key);
              const isEdge = key === checkIn || key === checkOut;
              // A booked day whose PREVIOUS day is free is a "check-out only"
              // turnover day — the first night of a stay, but its morning is free
              // for a departing guest. So a new stay can END here (someone checks
              // out in the morning before this booking checks in the afternoon),
              // just never START here. That makes it different from a fully-booked
              // middle night, which is blocked outright — so it isn't crossed out.
              // This only holds for FUTURE turnover days, though: checking out on a
              // day needs a check-in before it, and you can't book a past check-in —
              // so a booked TODAY can be neither started nor ended, and is simply
              // unavailable (crossed out) like any fully-booked night.
              const checkoutOnly =
                booked && !isBooked(prevDayKey(key)) && key > today;
              // While picking check-out, allow a booked day when the whole span up
              // to it is free (e.g. book 17→18 in the gap between a 14–17 and an
              // 18–22 stay). The already-picked check-out edge stays enabled too.
              const turnoverCheckout =
                active === "checkout" &&
                checkIn !== null &&
                key > checkIn &&
                !spanCrossesBooked(checkIn, key);
              const disabled =
                key < today || (booked && !turnoverCheckout && !isEdge);
              const inRange =
                !isEdge &&
                checkIn !== null &&
                previewEnd !== null &&
                key >= checkIn &&
                key <= previewEnd;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(key)}
                  onMouseEnter={() => setHover(key)}
                  aria-label={`${day} ${MONTH_NAMES[view.month]} ${view.year}`}
                  aria-pressed={isEdge}
                  title={
                    !booked
                      ? undefined
                      : !disabled
                        ? "Available as check-out"
                        : checkoutOnly
                          ? "Check-out only — a stay can end here, not start here"
                          : "Already booked"
                  }
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                    disabled
                      ? booked
                        ? checkoutOnly
                          ? "cursor-default text-ink"
                          : "cursor-default text-soft/70 line-through"
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
            {active === "checkin"
              ? "Select your check-in date"
              : checkIn && !checkOut
                ? "Now select your check-out date"
                : "Select your check-out date"}
          </p>
          {monthHasBooked && (
            <p className="mt-1 text-[13px] text-soft">
              Crossed-out dates are unavailable — they are already booked.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
