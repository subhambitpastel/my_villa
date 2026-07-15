// Room-inventory helpers for hotels & resorts. Pure functions with no server
// deps, so both server code (queries/actions) and client components can share
// them. Villas of other kinds book as a single whole unit (capacity 1).

export type RoomBooking = { checkIn: string; checkOut: string; rooms: number };

/** Villa kinds that sell individual rooms instead of the whole property. */
export const ROOM_BASED_KINDS = ["Hotel", "Resort"] as const;

export const isRoomBased = (kind: string): boolean =>
  (ROOM_BASED_KINDS as readonly string[]).includes(kind);

/** Concurrent reservations a villa allows on a single date: its room count for
 *  hotels/resorts, or 1 (the whole property) for everything else. */
export const roomCapacity = (kind: string, rooms: number): number =>
  isRoomBased(kind) ? Math.max(1, Math.trunc(rooms) || 1) : 1;

/** Rooms a booking must hold to seat `guests`: for hotels/resorts, enough rooms
 *  at the villa's per-room occupancy; whole-villa kinds always take 1 (the unit).
 *  Used by packages to turn "for up to N guests" into a room count. */
export const roomsForGuests = (
  kind: string,
  guests: number,
  peoplePerRoom: number,
): number =>
  isRoomBased(kind)
    ? Math.max(1, Math.ceil(Math.max(1, guests) / Math.max(1, peoplePerRoom)))
    : 1;

const pad = (n: number) => String(n).padStart(2, "0");

/** The YYYY-MM-DD one day after `date`. */
export function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Every night (YYYY-MM-DD) in the half-open range [checkIn, checkOut). */
export function nightsInRange(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let d = checkIn; d && d < checkOut; d = nextDay(d)) out.push(d);
  return out;
}

/** Rooms occupied on `date` across accepted bookings (half-open intervals — a
 *  checkout day frees the room for the next guest). */
export function roomsBookedOn(date: string, bookings: RoomBooking[]): number {
  return bookings.reduce(
    (n, b) => (date >= b.checkIn && date < b.checkOut ? n + b.rooms : n),
    0,
  );
}

/** Fewest rooms free on any night of [checkIn, checkOut) — the most a new
 *  reservation could take without overbooking. */
export function roomsFreeForRange(
  checkIn: string,
  checkOut: string,
  bookings: RoomBooking[],
  totalRooms: number,
): number {
  let free = totalRooms;
  for (const night of nightsInRange(checkIn, checkOut)) {
    free = Math.min(free, totalRooms - roomsBookedOn(night, bookings));
  }
  return Math.max(0, free);
}

/* --------------------------- per-guest room cap ---------------------------
 * One guest may not take a whole hotel through the self-serve flow. The cap is
 * per NIGHT and counts every room that guest already holds at the property, so
 * it can't be side-stepped by splitting a block across several bookings. Beyond
 * it, the guest asks the host to arrange the block on a call.
 * -------------------------------------------------------------------------- */

/** The most rooms one guest may hold at a property on any single night. */
export const MAX_ROOMS_PER_GUEST = 6;

/** How much of a guest's per-night allowance is still free across
 *  [checkIn, checkOut), given the rooms `held` they already have there.
 *  Deliberately the same maths as availability — the "capacity" being consumed
 *  is just the personal cap instead of the hotel's inventory. */
export const allowanceFree = (
  checkIn: string,
  checkOut: string,
  held: RoomBooking[],
  allowance: number = MAX_ROOMS_PER_GUEST,
): number => roomsFreeForRange(checkIn, checkOut, held, allowance);

/**
 * The stretch of [checkIn, checkOut) a NEW booking must actually cover for the
 * guest to hold `want` rooms every night, given the rooms they already have
 * (`held`). Nights already covered at the edges are trimmed off — a guest who
 * holds 4 rooms Jul 24–26 and asks for 4 rooms Jul 24–29 is extending their
 * stay, so the booking to make is Jul 26–29, not a refusal.
 *
 * Returns:
 *   • null — every night is already covered; there is nothing to book. The
 *     right doorway is editing the existing stay, not a new booking.
 *   • { …, gap: true } — covered nights sit BETWEEN nights that need rooms.
 *     One booking can't skip its own middle, so the ends must be booked
 *     separately (rare; called out to the guest rather than silently mangled).
 *   • otherwise the trimmed span a single booking should cover.
 */
export function neededSpan(
  checkIn: string,
  checkOut: string,
  want: number,
  held: RoomBooking[],
): { checkIn: string; checkOut: string; gap: boolean } | null {
  const need = Math.max(1, Math.trunc(want) || 1);
  const needed = nightsInRange(checkIn, checkOut).filter(
    (night) => roomsBookedOn(night, held) < need,
  );
  if (needed.length === 0) return null;
  const span = { checkIn: needed[0], checkOut: nextDay(needed[needed.length - 1]) };
  return {
    ...span,
    // Fewer needed nights than the span holds ⇒ some interior night is covered.
    gap: needed.length < nightsInRange(span.checkIn, span.checkOut).length,
  };
}

/* ------------------------ flexible (graduated) stays ------------------------
 * A hotel often has fewer rooms free at the start of a range than at the end
 * (e.g. 2 of 4 free Jul 16–18, all 4 free Jul 18–20). Capping the whole stay at
 * the bottleneck (2) would either lose the guest or under-sell the later nights,
 * so a stay may instead hold DIFFERENT room counts over consecutive segments —
 * a "room plan". A plan is stored on the booking and expanded back into plain
 * RoomBooking entries for availability maths, so the rest of the engine (and the
 * double-booking guard) needs no special cases.
 * -------------------------------------------------------------------------- */

/** One leg of a stay: `rooms` rooms held for every night in [checkIn, checkOut). */
export type RoomSegment = { checkIn: string; checkOut: string; rooms: number };

/**
 * The best room plan for [checkIn, checkOut) when the guest wants to hold
 * `wanted` rooms a night: each night gets as many as it can, never more than
 * needed, with consecutive same-count nights merged into one segment.
 *
 * `wanted` is a TOTAL, not an addition. `held` is what this guest already has
 * here, so a night where they hold some of the ask only tops up the difference —
 * ask 5 while holding 4 and that night adds 1, not 2. Booking someone up to the
 * cap when they asked for less would sell them rooms they never wanted.
 *
 * Each night takes the tightest of three limits:
 *   • what's still needed  — `wanted` less what they already hold that night;
 *   • the hotel's free inventory — `totalRooms` less everyone's bookings;
 *   • this guest's own cap — `allowance` less what they hold that night.
 * Omit `held`/`allowance` and it's inventory-only, exactly as before.
 *
 * Returns [] when no plan is possible — an empty range, or a night that can add
 * nothing (a stay can't have a roomless gap in the middle). Note that "needs
 * nothing" lands here too: a guest who already holds their whole ask on a night
 * has nothing to book for it, which callers report differently from sold out.
 */
export function roomPlanFor(
  checkIn: string,
  checkOut: string,
  bookings: RoomBooking[],
  totalRooms: number,
  wanted: number,
  held: RoomBooking[] = [],
  allowance: number = Infinity,
): RoomSegment[] {
  const want = Math.max(1, Math.trunc(wanted) || 1);
  const plan: RoomSegment[] = [];
  for (const night of nightsInRange(checkIn, checkOut)) {
    const mine = roomsBookedOn(night, held);
    const free = Math.min(
      want - mine,
      totalRooms - roomsBookedOn(night, bookings),
      allowance - mine,
    );
    if (free < 1) return [];
    const last = plan[plan.length - 1];
    // Nights arrive in order, so an equal-count night always extends the run.
    if (last && last.rooms === free) last.checkOut = nextDay(night);
    else plan.push({ checkIn: night, checkOut: nextDay(night), rooms: free });
  }
  return plan;
}

/** Room-nights in a plan (rooms × nights, summed) — what the stay is charged for. */
export const planRoomNights = (plan: RoomSegment[]): number =>
  plan.reduce(
    (n, s) => n + s.rooms * nightsInRange(s.checkIn, s.checkOut).length,
    0,
  );

/** Most rooms the plan ever holds — the booking's headline room count. */
export const planMaxRooms = (plan: RoomSegment[]): number =>
  plan.reduce((n, s) => Math.max(n, s.rooms), 0);

/** Fewest rooms the plan ever holds. Guests must fit in this leg — it's the one
 *  night-stretch where the party has the least space. */
export const planMinRooms = (plan: RoomSegment[]): number =>
  plan.reduce((n, s) => Math.min(n, s.rooms), Infinity);

/** True when the plan changes room count mid-stay, i.e. it's an "adjusted" stay
 *  the guest has to opt into. (Merging means >1 segment ⇒ counts differ.) */
export const isGraduated = (plan: RoomSegment[]): boolean => plan.length > 1;

/** True when every leg of `plan` fits inside the guest's remaining allowance.
 *  Checked leg-by-leg rather than against the plan's peak: each leg spans
 *  different nights, so it's measured against what the guest holds on those
 *  nights specifically. */
export const planFitsAllowance = (
  plan: RoomSegment[],
  held: RoomBooking[],
  allowance: number = MAX_ROOMS_PER_GUEST,
): boolean =>
  plan.every(
    (s) => roomsFreeForRange(s.checkIn, s.checkOut, held, allowance) >= s.rooms,
  );

/** Serialize a plan for the booking's room_plan column ('' when it's a plain
 *  flat stay, so normal bookings stay exactly as they were). */
export const serializeRoomPlan = (plan: RoomSegment[]): string =>
  isGraduated(plan) ? JSON.stringify(plan) : "";

/** Read a stored room_plan back. Returns null for '' / anything malformed, so
 *  callers fall back to the booking's flat `rooms` count. */
export function parseRoomPlan(raw: string): RoomSegment[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const plan = parsed.map((s) => ({
      checkIn: String((s as RoomSegment)?.checkIn ?? ""),
      checkOut: String((s as RoomSegment)?.checkOut ?? ""),
      rooms: Math.max(1, Math.trunc(Number((s as RoomSegment)?.rooms)) || 1),
    }));
    if (plan.some((s) => !s.checkIn || !s.checkOut || s.checkIn >= s.checkOut))
      return null;
    return plan;
  } catch {
    return null;
  }
}

/** Sold-out days (every room taken) as single-day ranges — fed to the calendar
 *  so those dates block selection and render struck-through. */
export function fullyBookedRanges(
  bookings: RoomBooking[],
  totalRooms: number,
): { checkIn: string; checkOut: string }[] {
  const days = new Set<string>();
  for (const b of bookings)
    for (const night of nightsInRange(b.checkIn, b.checkOut)) days.add(night);
  return [...days]
    .filter((date) => roomsBookedOn(date, bookings) >= totalRooms)
    .map((date) => ({ checkIn: date, checkOut: nextDay(date) }));
}
