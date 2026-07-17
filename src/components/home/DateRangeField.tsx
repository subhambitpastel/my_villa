"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, nightsBetween } from "@/lib/dates";

/* eslint-disable @next/next/no-img-element */

/** How the per-night room count reads at a glance: 1 = last room (red), 2–3 =
 *  going (amber), 4+ = comfortable (green). The NUMBER carries the meaning —
 *  colour only reinforces it, so this never relies on colour alone. */
const roomsTone = (free: number): string =>
  free <= 1
    ? "text-[#eb5757]"
    : free < 4
      ? "text-[#c98a00]"
      : "text-[#1c7d5c]";

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
  windowMonths,
  maxNights,
  roomsFreeOn,
  bookableCap: bookableCapProp,
  nightBudget,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
  /** "hero" = home search widget; "compact" = search filter panel;
   *  "booking" = large villa booking card. */
  variant?: "hero" | "compact" | "booking";
  /** Confirmed stays whose days should be blocked in the calendar. */
  bookedRanges?: { checkIn: string; checkOut: string }[];
  /** When set, the calendar only shows dates from today through this many
   *  calendar months out — later days are disabled and month nav stops there. */
  windowMonths?: number;
  /** When set, a stay can be at most this many nights — check-out days beyond
   *  check-in + maxNights are disabled while picking check-out. */
  maxNights?: number;
  /** Rooms still free on a given night (room-based stays only). When set, each
   *  bookable day shows that count under it as "NR", and a legend below the grid
   *  says what it means. Omit for whole-villa stays, which have no rooms to
   *  count. */
  roomsFreeOn?: (dateKey: string) => number;
  /** The most rooms bookable ONLINE per night — the guest flow's per-guest cap.
   *  A night with more free than this shows the cap as "NR ☎", the phone
   *  meaning "more are free; request a call for the rest". Omit (default no
   *  cap) for the owner's own booking flow, which has no per-guest limit. */
  bookableCap?: number;
  /** The guest's per-night budget for this property, once a check-in is picked.
   *  `remaining` = nights still open under the limit; `limit` = the owner's cap.
   *  `held` = nights the guest already holds here (YYYY-MM-DD) — they never
   *  count against the budget again, so a span crossing an existing stay only
   *  spends budget on its NEW nights. Nights beyond the remaining budget render
   *  yellow with a "request a call" note. Omit when the property has no limit
   *  (or on the owner's own flow). */
  nightBudget?: { remaining: number; limit: number; held?: string[] } | null;
}) {
  // No cap given → the count is uncapped and no phone ever shows.
  const bookableCap = bookableCapProp ?? Infinity;
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
  // True if a stay [from, to) would exceed the maximum allowed nights.
  const tooLong = (from: string, to: string) =>
    maxNights != null && nightsBetween(from, to) > maxNights;

  function pick(day: string) {
    if (
      active === "checkout" &&
      checkIn &&
      day > checkIn &&
      !spanCrossesBooked(checkIn, day) &&
      !tooLong(checkIn, day)
    ) {
      onChange(checkIn, day);
      setActive(null);
    } else {
      // Picking check-in, or a check-out on/before check-in, or a range that
      // would cross a booked block or exceed the max stay: restart from this day.
      const keepOut =
        checkOut &&
        checkOut > day &&
        !spanCrossesBooked(day, checkOut) &&
        !tooLong(day, checkOut)
          ? checkOut
          : null;
      onChange(day, keepOut);
      setActive("checkout");
    }
  }

  const today = todayKey();
  // Furthest bookable day (inclusive) when a booking window is enforced.
  const maxDate =
    windowMonths != null ? addMonths(today, windowMonths) : null;
  const viewIndex = view.year * 12 + view.month;
  const nowIndex = (() => {
    const [y, m] = today.split("-").map(Number);
    return y * 12 + (m - 1);
  })();
  const maxIndex = maxDate
    ? (() => {
        const [y, m] = maxDate.split("-").map(Number);
        return y * 12 + (m - 1);
      })()
    : Infinity;

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
    !spanCrossesBooked(checkIn, hover) &&
    !tooLong(checkIn, hover)
      ? hover
      : null);

  // Budget spent by each night of the previewed span: how many NEW nights (not
  // already held by this guest) come before it, night by night from check-in.
  // A night the guest already holds spends nothing — extending across an
  // existing stay only counts the added nights, same as the server's gate.
  const heldNights = new Set(nightBudget?.held ?? []);
  const budgetSpentAt = new Map<string, number>();
  let budgetSpentTotal = 0;
  if (nightBudget != null && checkIn && previewEnd) {
    for (let d = checkIn; d < previewEnd; d = addDays(d, 1)) {
      budgetSpentAt.set(d, budgetSpentTotal);
      if (!heldNights.has(d)) budgetSpentTotal += 1;
    }
  }

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
              disabled={viewIndex >= maxIndex}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)] disabled:opacity-30 disabled:hover:bg-transparent"
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
              // While picking check-out, a day past check-in + maxNights would
              // make the stay too long — disable it (the edges stay clickable).
              const exceedsMaxStay =
                active === "checkout" &&
                checkIn !== null &&
                key > checkIn &&
                !isEdge &&
                tooLong(checkIn, key);
              // Dates can arrive PRESELECTED (search params, a shared link) on
              // days that are fully booked — often by a stay the owner arranged
              // for someone else. Being "the selection" must not dress such a
              // day up as a bookable purple edge: a stay can never START on a
              // booked day, and can only END on one when it's a turnover
              // morning. Everything else renders as what it is — crossed out.
              const deadEdge =
                booked &&
                (key === checkIn || (key === checkOut && !checkoutOnly));
              const disabled =
                key < today ||
                (maxDate !== null && key > maxDate) ||
                exceedsMaxStay ||
                (booked && !turnoverCheckout && (!isEdge || deadEdge));
              const inRange =
                !isEdge &&
                checkIn !== null &&
                previewEnd !== null &&
                key >= checkIn &&
                key <= previewEnd;
              // Rooms free on this night. Keyed off the DAY's own availability,
              // not `disabled` — that also swings on the in-progress selection
              // (max-stay, turnover), and counts blinking as you pick would read
              // as the hotel filling up.
              const outOfWindow =
                key < today || (maxDate !== null && key > maxDate);
              // The property's real free count, uncapped — this answers "how
              // full is the hotel that night", so it shows every free room.
              const roomsLeft =
                roomsFreeOn && !outOfWindow ? roomsFreeOn(key) : 0;
              // When a per-guest online cap is set (guest booking flow), a night
              // with more free rooms than the cap can only take `cap` online —
              // the rest are arranged on a call. The "R" count shows what's
              // bookable here, and a phone marks that more are available beyond.
              const bookableHere = Math.min(roomsLeft, bookableCap);
              const overCap = roomsLeft > bookableCap;
              // A night that pushes the stay past the guest's per-night budget.
              // Gated on `inRange` so it behaves like the range preview: yellow
              // shows only on nights inside the span they're hovering/selecting
              // once it crosses the threshold — never a blanket fill the moment
              // a check-in is picked. The night stays clickable (picking it
              // routes to "request a call").
              // The hovered/selected check-out day is a boundary, not a night
              // stayed, so it never counts toward the budget or shows amber —
              // and a night the guest already holds spends no budget, so it
              // never marks either.
              const overBudgetNight =
                nightBudget != null &&
                inRange &&
                key !== previewEnd &&
                !booked &&
                !heldNights.has(key) &&
                (budgetSpentAt.get(key) ?? 0) >= nightBudget.remaining;
              const budgetTip = overBudgetNight
                ? `The host lets one guest book at most ${nightBudget!.limit} nights online here${nightBudget!.remaining < nightBudget!.limit ? ` (${nightBudget!.remaining} left for you)` : ""} — request a call to stay longer.`
                : null;
              const dayButton = (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(key)}
                  onMouseEnter={() => setHover(key)}
                  aria-label={
                    // The count is rendered aria-hidden (a bare "3" says
                    // nothing on its own), so it rides along here instead.
                    (roomsLeft > 0
                      ? `${day} ${MONTH_NAMES[view.month]} ${view.year}, ${bookableHere} room${bookableHere === 1 ? "" : "s"} bookable${overCap ? " online — request a call for more" : ""}`
                      : `${day} ${MONTH_NAMES[view.month]} ${view.year}`) +
                    (overBudgetNight ? " — over your night limit, request a call" : "")
                  }
                  aria-pressed={isEdge}
                  title={
                    budgetTip ??
                    (!booked
                      ? undefined
                      : !disabled
                        ? "Available as check-out"
                        : checkoutOnly
                          ? "Check-out only — a stay can end here, not start here"
                          : "Already booked")
                  }
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                    /* Every fully-booked day reads as full — CROSSED — even a
                       turnover day a stay may still END on (kept clickable,
                       dark ink + tooltip say so). "Plain text with a tooltip"
                       looked available, and guests don't hover. Over-budget
                       nights read amber so the threshold is visible at a glance. */
                    disabled
                      ? booked
                        ? "cursor-default text-soft/70 line-through"
                        : "cursor-default text-soft/70"
                      : isEdge
                        ? "bg-brand font-semibold text-white"
                        : overBudgetNight
                          ? "bg-[#fbe9c4] text-[#8a6a1f] hover:bg-[#f8dfa8]"
                          : inRange
                            ? "bg-[rgba(123,97,255,0.15)] text-ink"
                            : booked
                              ? "text-ink line-through hover:bg-[rgba(123,97,255,0.12)]"
                              : "text-ink hover:bg-[rgba(123,97,255,0.12)]"
                  }`}
                >
                  {day}
                </button>
              );
              // Whole-villa stays have no rooms to count — keep the bare pill so
              // their calendar is untouched.
              if (!roomsFreeOn) return dayButton;
              return (
                <span key={key} className="flex flex-col items-center">
                  {dayButton}
                  {/* Fixed height whether or not there's a number, so rows don't
                      jump between months. "3R" = 3 rooms bookable; a ☎ means
                      more are free but need a call (over the online cap). */}
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-[12px] items-center gap-[1px] text-[10px] font-semibold leading-[12px] ${
                      roomsLeft > 0 ? roomsTone(bookableHere) : ""
                    }`}
                  >
                    {roomsLeft > 0 ? `${bookableHere}R` : ""}
                    {overCap && (
                      <span
                        className="text-[8px] text-[#8a6a1f]"
                        title={`More than ${bookableCap} rooms are free — book ${bookableCap} online, request a call for the rest.`}
                      >
                        ☎
                      </span>
                    )}
                  </span>
                </span>
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
          {/* A bare "48" under a date says nothing on its own, and the day cell
              is far too narrow to carry the word "rooms" with it — so the unit
              is spelled out here, once, for the whole grid. Written as a plain
              sentence: a sample number with an "=" beside it reads like data,
              not like a key. */}
          {roomsFreeOn && (
            <p className="mt-1 text-[13px] text-soft">
              &ldquo;3R&rdquo; under a date means 3 rooms are bookable that
              night.
              {bookableCapProp != null && (
                <>
                  {" "}
                  A <span aria-hidden>☎</span> means more are free than you can
                  book online ({bookableCap}) — request a call for the rest.
                </>
              )}
            </p>
          )}
          {monthHasBooked && (
            <p className="mt-1 text-[13px] text-soft">
              Crossed-out dates are unavailable — they are already booked.
            </p>
          )}
          {nightBudget != null &&
            checkIn !== null &&
            previewEnd !== null &&
            budgetSpentTotal > nightBudget.remaining && (
              <p className="mt-1 text-[13px] text-[#8a6a1f]">
                Yellow nights are past the {nightBudget.limit}-night limit one
                guest can book online here — request a call to stay longer.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
