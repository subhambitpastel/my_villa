import { describe, it, expect } from "vitest";
import {
  allowanceFree,
  isGraduated,
  MAX_ROOMS_PER_GUEST,
  neededSpan,
  parseRoomPlan,
  planFitsAllowance,
  planMaxRooms,
  planMinRooms,
  planRoomNights,
  roomPlanFor,
  roomsFreeForRange,
  serializeRoomPlan,
  type RoomBooking,
} from "./rooms";

// The motivating case: a 4-room hotel with 2 rooms already sold for Jul 16–18.
// A guest wants 4 rooms Jul 16–20 — only 2 are free for the first two nights,
// but all 4 open up once the existing stay checks out on the 18th.
const HOTEL_ROOMS = 4;
const EXISTING: RoomBooking[] = [
  { checkIn: "2026-07-16", checkOut: "2026-07-18", rooms: 2 },
];

// A guest's OWN rooms limit them too, not just the hotel's inventory: they may
// hold MAX_ROOMS_PER_GUEST a night, so nights they're already on cost them
// allowance. A roomy hotel isolates that from any inventory shortfall.
// Extending a stay: rooms already held satisfy the ask on their nights, so the
// new booking covers only the nights that still need rooms.
describe("neededSpan", () => {
  const HELD: RoomBooking[] = [
    { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 4 },
  ];

  it("trims covered leading nights — same rooms, more nights books the extension", () => {
    // Holds 4 rooms 24–26, asks 4 rooms 24–29 → the booking to make is 26–29.
    expect(neededSpan("2026-07-24", "2026-07-29", 4, HELD)).toEqual({
      checkIn: "2026-07-26",
      checkOut: "2026-07-29",
      gap: false,
    });
  });

  it("trims when asking for FEWER rooms than held too", () => {
    // Holds 4, asks 3 a night 24–29 — 24–26 already exceeds 3, book 26–29.
    expect(neededSpan("2026-07-24", "2026-07-29", 3, HELD)).toEqual({
      checkIn: "2026-07-26",
      checkOut: "2026-07-29",
      gap: false,
    });
  });

  it("trims covered trailing nights (extending backwards)", () => {
    expect(neededSpan("2026-07-22", "2026-07-26", 4, HELD)).toEqual({
      checkIn: "2026-07-22",
      checkOut: "2026-07-24",
      gap: false,
    });
  });

  it("returns null when every night is already covered", () => {
    expect(neededSpan("2026-07-24", "2026-07-26", 4, HELD)).toBeNull();
    expect(neededSpan("2026-07-24", "2026-07-26", 2, HELD)).toBeNull();
  });

  it("keeps the full span when a night needs a TOP-UP (not fully covered)", () => {
    // Asking 5 while holding 4: nights 24–26 still need 1, nothing is trimmed.
    expect(neededSpan("2026-07-24", "2026-07-29", 5, HELD)).toEqual({
      checkIn: "2026-07-24",
      checkOut: "2026-07-29",
      gap: false,
    });
  });

  it("flags an interior gap a single booking can't span", () => {
    const middle: RoomBooking[] = [
      { checkIn: "2026-07-26", checkOut: "2026-07-28", rooms: 4 },
    ];
    expect(neededSpan("2026-07-24", "2026-07-30", 4, middle)).toEqual({
      checkIn: "2026-07-24",
      checkOut: "2026-07-30",
      gap: true,
    });
  });

  it("is a no-op when the guest holds nothing", () => {
    expect(neededSpan("2026-07-24", "2026-07-29", 4, [])).toEqual({
      checkIn: "2026-07-24",
      checkOut: "2026-07-29",
      gap: false,
    });
  });
});

describe("roomPlanFor (per-guest allowance)", () => {
  const BIG_HOTEL = 20;

  it("tops up to the ask on nights the guest already holds rooms", () => {
    // Holds 4 rooms Jul 24–26; now wants to hold 5 a night, Jul 24–29. Those
    // first nights need ONE more (not two — the cap has 2 spare, but they only
    // asked for 5); from the 26th they hold nothing, so all 5 are needed.
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 4 },
    ];
    const plan = roomPlanFor(
      "2026-07-24",
      "2026-07-29",
      mine, // the hotel's only booking is this guest's own
      BIG_HOTEL,
      5,
      mine,
      MAX_ROOMS_PER_GUEST,
    );
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 1 },
      { checkIn: "2026-07-26", checkOut: "2026-07-29", rooms: 5 },
    ]);
    expect(isGraduated(plan)).toBe(true);
    // Never over the cap: 4 held + 1 new = 5.
    expect(planFitsAllowance(plan, mine)).toBe(true);
  });

  it("never books past the ask, even when the cap has room to spare", () => {
    // Holds 2, asks 3 → adds exactly 1, though the cap would allow 4 more.
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 2 },
    ];
    const plan = roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 3, mine, MAX_ROOMS_PER_GUEST);
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 1 },
    ]);
  });

  it("returns no plan when the guest already holds their whole ask", () => {
    // Holds 4 and asks for 4 — nothing to add, so there's no booking to make.
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 4 },
    ];
    expect(
      roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 4, mine, MAX_ROOMS_PER_GUEST),
    ).toEqual([]);
  });

  it("returns no plan when the allowance is spent on every night", () => {
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 6 },
    ];
    expect(
      roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 1, mine, MAX_ROOMS_PER_GUEST),
    ).toEqual([]);
  });

  it("takes the TIGHTER of inventory and allowance", () => {
    // 3-room hotel with 2 sold to someone else: inventory allows 1, and the
    // guest's untouched allowance would allow 6 — inventory must win.
    const others: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 2 },
    ];
    const plan = roomPlanFor("2026-07-24", "2026-07-26", others, 3, 6, [], MAX_ROOMS_PER_GUEST);
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 1 },
    ]);
  });

  it("is inventory-only when no allowance is passed (unchanged callers)", () => {
    // Same shape as the case above but without held/allowance: a 10-room hotel
    // must still offer all 8 asked for, i.e. the cap must NOT sneak in.
    const plan = roomPlanFor("2026-07-24", "2026-07-26", [], 10, 8);
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 8 },
    ]);
  });
});

describe("roomPlanFor", () => {
  it("splits the stay where availability changes", () => {
    const plan = roomPlanFor("2026-07-16", "2026-07-20", EXISTING, HOTEL_ROOMS, 4);
    expect(plan).toEqual([
      { checkIn: "2026-07-16", checkOut: "2026-07-18", rooms: 2 },
      { checkIn: "2026-07-18", checkOut: "2026-07-20", rooms: 4 },
    ]);
    expect(isGraduated(plan)).toBe(true);
  });

  it("never offers more rooms than asked for", () => {
    const plan = roomPlanFor("2026-07-16", "2026-07-20", EXISTING, HOTEL_ROOMS, 2);
    // 2 rooms are free throughout, so this is a plain flat stay — no adjustment.
    expect(plan).toEqual([
      { checkIn: "2026-07-16", checkOut: "2026-07-20", rooms: 2 },
    ]);
    expect(isGraduated(plan)).toBe(false);
    expect(serializeRoomPlan(plan)).toBe("");
  });

  it("stays flat when nothing is booked", () => {
    const plan = roomPlanFor("2026-07-16", "2026-07-20", [], HOTEL_ROOMS, 4);
    expect(plan).toEqual([
      { checkIn: "2026-07-16", checkOut: "2026-07-20", rooms: 4 },
    ]);
    expect(isGraduated(plan)).toBe(false);
  });

  it("returns no plan when a night is sold out — a stay can't have a gap", () => {
    const soldOut: RoomBooking[] = [
      { checkIn: "2026-07-17", checkOut: "2026-07-18", rooms: 4 },
    ];
    expect(roomPlanFor("2026-07-16", "2026-07-20", soldOut, HOTEL_ROOMS, 2)).toEqual(
      [],
    );
  });

  it("returns no plan for an empty range", () => {
    expect(roomPlanFor("2026-07-16", "2026-07-16", [], HOTEL_ROOMS, 1)).toEqual([]);
  });

  it("handles availability dipping in the middle", () => {
    const midDip: RoomBooking[] = [
      { checkIn: "2026-07-17", checkOut: "2026-07-18", rooms: 3 },
    ];
    expect(roomPlanFor("2026-07-16", "2026-07-19", midDip, HOTEL_ROOMS, 4)).toEqual([
      { checkIn: "2026-07-16", checkOut: "2026-07-17", rooms: 4 },
      { checkIn: "2026-07-17", checkOut: "2026-07-18", rooms: 1 },
      { checkIn: "2026-07-18", checkOut: "2026-07-19", rooms: 4 },
    ]);
  });
});

describe("plan totals", () => {
  const plan = roomPlanFor("2026-07-16", "2026-07-20", EXISTING, HOTEL_ROOMS, 4);

  it("charges for room-nights actually held", () => {
    // 2 rooms × 2 nights + 4 rooms × 2 nights = 12 room-nights (vs 8 if the
    // whole stay were capped at the 2-room bottleneck).
    expect(planRoomNights(plan)).toBe(12);
  });

  it("peak rooms is the headline count, min rooms caps the guests", () => {
    expect(planMaxRooms(plan)).toBe(4);
    expect(planMinRooms(plan)).toBe(2);
  });

  it("a flat stay's room-nights match rooms × nights", () => {
    const flat = roomPlanFor("2026-07-16", "2026-07-20", [], HOTEL_ROOMS, 4);
    expect(planRoomNights(flat)).toBe(4 * 4);
  });
});

describe("room plan round-trip", () => {
  it("serializes only graduated plans and reads them back", () => {
    const plan = roomPlanFor("2026-07-16", "2026-07-20", EXISTING, HOTEL_ROOMS, 4);
    expect(parseRoomPlan(serializeRoomPlan(plan))).toEqual(plan);
  });

  it("falls back to null on empty or malformed input", () => {
    expect(parseRoomPlan("")).toBeNull();
    expect(parseRoomPlan("not json")).toBeNull();
    expect(parseRoomPlan("[]")).toBeNull();
    expect(parseRoomPlan('[{"checkIn":"2026-07-16"}]')).toBeNull();
    // check-in on/after check-out is nonsense — reject rather than trust it.
    expect(
      parseRoomPlan('[{"checkIn":"2026-07-18","checkOut":"2026-07-16","rooms":2}]'),
    ).toBeNull();
  });
});

describe("booked plan segments consume inventory per night", () => {
  it("an adjusted stay blocks each leg by its own room count", () => {
    // The adjusted stay above, expanded back into the engine's flat entries.
    const booked = roomPlanFor("2026-07-16", "2026-07-20", EXISTING, HOTEL_ROOMS, 4);
    const all = [...EXISTING, ...booked];
    // Jul 16–18: 2 existing + 2 adjusted = 4 of 4 taken → nothing left.
    expect(roomsFreeForRange("2026-07-16", "2026-07-18", all, HOTEL_ROOMS)).toBe(0);
    // Jul 18–20: the adjusted stay holds all 4 → nothing left either.
    expect(roomsFreeForRange("2026-07-18", "2026-07-20", all, HOTEL_ROOMS)).toBe(0);
  });
});

describe("allowanceFree (per-guest room cap)", () => {
  it("gives a guest with nothing booked the full allowance", () => {
    expect(allowanceFree("2026-07-10", "2026-07-12", [])).toBe(MAX_ROOMS_PER_GUEST);
  });

  it("counts rooms the guest already holds on the same nights", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 4 },
    ];
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(2);
  });

  it("is exhausted once the guest holds the full allowance", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 6 },
    ];
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(0);
  });

  it("adds up across SEPARATE bookings on the same night (can't be split)", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 3 },
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 3 },
    ];
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(0);
  });

  it("bites on the worst night, not the average", () => {
    // 6 rooms held on Jul 11 only; a Jul 10–12 stay overlaps that night.
    const held: RoomBooking[] = [
      { checkIn: "2026-07-11", checkOut: "2026-07-12", rooms: 6 },
    ];
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(0);
    // Jul 10–11 misses it entirely, so the allowance is untouched.
    expect(allowanceFree("2026-07-10", "2026-07-11", held)).toBe(6);
  });

  it("ignores rooms held on nights that don't overlap", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-08-01", checkOut: "2026-08-03", rooms: 6 },
    ];
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(6);
  });

  it("treats a check-out day as free (half-open range)", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-08", checkOut: "2026-07-10", rooms: 6 },
    ];
    // The held stay ends the morning of the 10th, so a 10th–12th stay is clear.
    expect(allowanceFree("2026-07-10", "2026-07-12", held)).toBe(6);
  });
});

describe("planFitsAllowance", () => {
  const plan = [
    { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 2 },
    { checkIn: "2026-07-12", checkOut: "2026-07-14", rooms: 5 },
  ];

  it("passes when every leg fits", () => {
    expect(planFitsAllowance(plan, [])).toBe(true);
  });

  it("fails when a SINGLE leg busts the allowance", () => {
    // 2 held Jul 12–14 → that leg needs 5 but only 4 remain.
    const held: RoomBooking[] = [
      { checkIn: "2026-07-12", checkOut: "2026-07-14", rooms: 2 },
    ];
    expect(planFitsAllowance(plan, held)).toBe(false);
  });

  it("passes when the held rooms only touch a leg with room to spare", () => {
    // 3 held Jul 10–12 → that leg needs 2 and 3 remain; the other leg is clear.
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 3 },
    ];
    expect(planFitsAllowance(plan, held)).toBe(true);
  });
});
