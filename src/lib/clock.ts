// The app's notion of "now".
//
// Everything time-dependent — the 24-hour review edit window, whether a stay
// has finished, which dates a calendar will still take, session expiry — asks
// here rather than calling Date.now() directly, so a test can move the clock
// and watch those rules behave.
//
// Set NEXT_PUBLIC_CURRENT_TIME in .env.local to pretend it is some other
// moment:
//
//   NEXT_PUBLIC_CURRENT_TIME=None              → the real clock (also blank/unset)
//   NEXT_PUBLIC_CURRENT_TIME=20_07_2026_12_30_PM → pretend it is that moment
//
// Format is DD_MM_YYYY_HH_MM_AM|PM, read as UTC — the app stores and compares
// every date in UTC, so a local reading would make "today" ambiguous by a day
// either side.
//
// NEXT_PUBLIC_ so the browser and the server agree: a calendar rendered on the
// client and the availability check on the server must share one today, or a
// date the picker offers is one the action refuses. Changing it needs a dev
// server restart (Next inlines it into the client bundle at build time).

/** Ways of saying "no pretend clock, use the real one". Missing entirely,
 *  blank, or any of these words — a variable someone commented out, deleted or
 *  set to a placeholder must never leave the app on a half-set clock. */
const NO_PRETEND = /^(none|off|real|null|undefined|false)$/i;

/**
 * DD_MM_YYYY_HH_MM_AM|PM → epoch ms (UTC), or null to mean "use the real
 * clock" — for a missing, blank or None-ish value, and for anything that
 * isn't that shape.
 *
 * Exported for its tests: this is the whole contract of the env variable, and
 * it is worth pinning down separately from the module-level clock it feeds.
 */
export function pretendTimeFrom(raw: string | undefined | null): number | null {
  const value = (raw ?? "").trim();
  if (!value || NO_PRETEND.test(value)) return null;
  const m = /^(\d{1,2})_(\d{1,2})_(\d{4})_(\d{1,2})_(\d{2})_(AM|PM)$/i.exec(value);
  if (!m) {
    // A typo here would silently run on the real clock and make a test look
    // like a bug, so say so loudly instead.
    console.warn(
      `[clock] Ignoring NEXT_PUBLIC_CURRENT_TIME="${raw}" — expected DD_MM_YYYY_HH_MM_AM|PM, e.g. 20_07_2026_12_30_PM.`,
    );
    return null;
  }
  const [, dd, mm, yyyy, hh, min, meridiem] = m;
  const hour24 = (Number(hh) % 12) + (/pm/i.test(meridiem) ? 12 : 0);
  const ms = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hour24,
    Number(min),
  );
  return Number.isFinite(ms) ? ms : null;
}

/* Unset is the normal case, and reads exactly like None: both give the real
   clock. NEXT_PUBLIC_ is what the browser can see; CURRENT_TIME is accepted
   server-side too, so setting either one works. */
const PRETEND = pretendTimeFrom(
  process.env.NEXT_PUBLIC_CURRENT_TIME ?? process.env.CURRENT_TIME,
);

/* An OFFSET rather than a frozen instant: the clock still ticks. A frozen one
   would mean a 24-hour window never closes while you watch it and sessions
   never expire — the opposite of useful for testing the rules that depend on
   time passing. */
const OFFSET_MS = PRETEND === null ? 0 : PRETEND - Date.now();

/** True when the app is running on a pretend clock. */
export const CLOCK_SHIFTED = OFFSET_MS !== 0;

/** Milliseconds since the epoch, as the app understands the present. */
export function nowMs(): number {
  return Date.now() + OFFSET_MS;
}

/** The present, as a Date. */
export function now(): Date {
  return new Date(nowMs());
}

/** The present as a UTC "YYYY-MM-DDTHH:MM:SS.sssZ" string — what the columns
 *  storing an exact moment (locked_at, disabled_at, session expiry) hold. */
export function nowIso(): string {
  return now().toISOString();
}

/** Today as UTC YYYY-MM-DD — the form every date comparison in the app uses. */
export function todayKey(): string {
  return nowIso().slice(0, 10);
}

/** The present in the DB's own timestamp text ("YYYY-MM-DD HH:MM:SS", UTC) —
 *  what `created_at` columns hold. Pass it explicitly when a row's age is
 *  something the app later reasons about (a review's edit window), so the row
 *  is stamped with the app's clock rather than the database's: otherwise a
 *  shifted clock would file every new review as already hours old. */
export function nowStamp(): string {
  return nowIso().slice(0, 19).replace("T", " ");
}
