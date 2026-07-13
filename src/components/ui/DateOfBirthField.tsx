"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBirthday, maxDob } from "@/lib/dates";

// A single-date picker for a date of birth that reuses the same popup calendar
// design as the villa/hotel booking calendars (DateRangeField / StartDateField):
// month-nav arrows, weekday header, day grid and brand pill styling — so every
// calendar in the app looks the same. Two differences fit the DOB use case:
//   • a birth year can be decades back, so the month/year title is replaced with
//     quick Month + Year dropdowns (arrows still nudge one month at a time);
//   • anything more recent than `minAge` years ago is disabled, so an under-age
//     date simply can't be chosen.
// Works both controlled (value + onChange) and inside a plain <form>: pass a
// `name` and it mirrors the choice into a hidden input for FormData.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
// YYYY-MM-DD keys compare correctly as plain strings.
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DateOfBirthField({
  value,
  defaultValue = "",
  onChange,
  name,
  id,
  minAge = 18,
  maxAgeYears = 100,
  ariaInvalid,
  triggerClassName,
  placeholder = "Select date of birth",
  defaultOpen = false,
}: {
  /** Controlled value "YYYY-MM-DD" (omit for an uncontrolled/form field). */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  onChange?: (day: string) => void;
  /** When set, a hidden input of this name carries the value for FormData. */
  name?: string;
  id?: string;
  /** Minimum age the chosen date must satisfy (dates newer than this are off). */
  minAge?: number;
  /** How far back the year dropdown goes. */
  maxAgeYears?: number;
  ariaInvalid?: boolean;
  /** Styling for the trigger so it matches the surrounding form inputs. */
  triggerClassName?: string;
  placeholder?: string;
  /** Open the calendar as soon as the field mounts (e.g. inline edit rows). */
  defaultOpen?: boolean;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = controlled ? value ?? "" : internal;

  // Latest allowed birth date, e.g. "2008-07-12" for minAge 18 today.
  const MAX = maxDob(minAge);
  const maxYear = Number(MAX.slice(0, 4));
  const maxMonth = Number(MAX.slice(5, 7)) - 1;
  const oldestYear = maxYear + minAge - maxAgeYears;

  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState(() => {
    const base = selected || MAX;
    const [y, m] = base.split("-").map(Number);
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

  const years = useMemo(
    () => Array.from({ length: maxYear - oldestYear + 1 }, (_, i) => maxYear - i),
    [maxYear, oldestYear],
  );

  const viewIndex = view.year * 12 + view.month;
  const maxIndex = maxYear * 12 + maxMonth;
  const minIndex = oldestYear * 12;

  const firstWeekday =
    (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(view.year, view.month + 1, 0),
  ).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function toggle() {
    const base = selected || MAX;
    const [y, m] = base.split("-").map(Number);
    setView({ year: y, month: m - 1 });
    setOpen((prev) => !prev);
  }

  // Keep the view within [oldest, MAX] and never on a month past the max month
  // of the youngest allowed year.
  function goto(year: number, month: number) {
    let idx = year * 12 + month;
    if (idx > maxIndex) idx = maxIndex;
    if (idx < minIndex) idx = minIndex;
    setView({ year: Math.floor(idx / 12), month: idx % 12 });
  }

  function pick(day: string) {
    if (day > MAX) return;
    if (!controlled) setInternal(day);
    onChange?.(day);
    setOpen(false);
  }

  return (
    <div
      ref={wrapRef}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className="relative"
    >
      <button
        type="button"
        id={id}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${triggerClassName ?? ""} text-left ${
          ariaInvalid ? "border-red-500" : ""
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={selected ? "text-ink" : "text-[#9d9da6]"}>
            {selected ? formatBirthday(selected) : placeholder}
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            className="shrink-0 text-[#9d9da6]"
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {name && <input type="hidden" name={name} value={selected} />}

      {open && (
        <div
          role="dialog"
          aria-label="Choose your date of birth"
          className="absolute left-0 top-[calc(100%+10px)] z-30 w-[320px] max-w-[calc(100vw-48px)] rounded-[10px] bg-white p-5 shadow-[0px_10px_30px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => goto(view.year, view.month - 1)}
              disabled={viewIndex <= minIndex}
              aria-label="Previous month"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              <select
                aria-label="Month"
                value={view.month}
                onChange={(e) => goto(view.year, Number(e.target.value))}
                className="rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold text-ink hover:bg-[rgba(123,97,255,0.08)] focus:outline-none"
              >
                {MONTH_NAMES.map((mName, m) => (
                  <option key={mName} value={m} disabled={view.year === maxYear && m > maxMonth}>
                    {mName}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={view.year}
                onChange={(e) => goto(Number(e.target.value), view.month)}
                className="rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold text-ink hover:bg-[rgba(123,97,255,0.08)] focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => goto(view.year, view.month + 1)}
              disabled={viewIndex >= maxIndex}
              aria-label="Next month"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-[rgba(123,97,255,0.12)] disabled:opacity-30 disabled:hover:bg-transparent"
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

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`empty-${i}`} />;
              const key = keyOf(view.year, view.month, day);
              const disabled = key > MAX;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(key)}
                  aria-label={`${day} ${MONTH_NAMES[view.month]} ${view.year}`}
                  aria-pressed={isSelected}
                  title={disabled ? `Must be at least ${minAge} years old` : undefined}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                    disabled
                      ? "cursor-default text-soft/70"
                      : isSelected
                        ? "bg-brand font-semibold text-white"
                        : "text-ink hover:bg-[rgba(123,97,255,0.12)]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[13px] text-gray">
            You must be at least {minAge} years old.
          </p>
        </div>
      )}
    </div>
  );
}
