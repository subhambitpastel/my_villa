// Date helpers for bookings. Dates travel as plain YYYY-MM-DD strings and are
// interpreted in UTC so server and client always agree.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string | undefined | null): Date | null {
  if (!value || !DAY_RE.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "2026-07-14" → "14 Jul" */
export function formatDay(value: string): string {
  const d = parseDay(value);
  if (!d) return value;
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

/** "2026-02-01" → "Feb 01" (month-first, for policy/summary copy). */
export function formatMonthDay(value: string): string {
  const d = parseDay(value);
  if (!d) return value;
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** "2026-07-14", "2026-07-17" → "14 Jul-17 Jul" */
export function formatRange(checkIn: string, checkOut: string): string {
  return `${formatDay(checkIn)}-${formatDay(checkOut)}`;
}

/** Today + `offset` days as YYYY-MM-DD (UTC). */
export function dayFromNow(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** `date` + `days` as YYYY-MM-DD (UTC); returns `date` unchanged if unparseable. */
export function addDays(date: string, days: number): string {
  const d = parseDay(date);
  if (!d) return date;
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** `date` + `months` calendar months as YYYY-MM-DD (UTC). The day-of-month is
 *  clamped to the target month's length (e.g. Jan 31 + 1 month → Feb 28/29).
 *  Returns `date` unchanged if unparseable. */
export function addMonths(date: string, months: number): string {
  const d = parseDay(date);
  if (!d) return date;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), daysInTarget));
  return target.toISOString().slice(0, 10);
}

/** How far ahead a guest may book/search: the calendars only show dates from
 *  today through this many calendar months out. */
export const BOOKING_WINDOW_MONTHS = 3;

/** The longest stay a guest may book in the nightly flow — check-out can be at
 *  most this many nights after check-in. Packages set their own fixed length. */
export const MAX_STAY_NIGHTS = 30;

/* -------------------------- date of birth --------------------------- */

/** The latest date of birth (YYYY-MM-DD) that is still at least `minAge` years
 *  old today. Use it as `max` on a DOB date picker so under-age dates can't be
 *  chosen, and to validate (a dob is old enough when `dob <= maxDob()`). */
export function maxDob(minAge = 18): string {
  const now = new Date();
  const y = now.getUTCFullYear() - minAge;
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize a stored DOB — YYYY-MM-DD, or a legacy string like
 *  "January 16, 1991" — into the YYYY-MM-DD a date input needs, or "". */
export function toDateInput(dob: string): string {
  if (!dob) return "";
  if (DAY_RE.test(dob)) return dob;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** True when a DOB makes someone at least `minAge` today. Empty/unparseable →
 *  true (a missing DOB is handled by the separate "required" check). */
export function isAtLeastAge(dob: string, minAge = 18): boolean {
  const ymd = toDateInput(dob);
  return !ymd || ymd <= maxDob(minAge);
}

/** "1991-01-16" → "16 Jan 1991" for display (falls back to the raw value). */
export function formatBirthday(dob: string): string {
  const d = parseDay(toDateInput(dob));
  if (!d) return dob;
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
