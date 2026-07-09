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

/** "2026-07-14", "2026-07-17" → "14 Jul-17 Jul" */
export function formatRange(checkIn: string, checkOut: string): string {
  return `${formatDay(checkIn)}-${formatDay(checkOut)}`;
}

/** Today + `offset` days as YYYY-MM-DD (UTC). */
export function dayFromNow(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}
