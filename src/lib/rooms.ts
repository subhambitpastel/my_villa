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
