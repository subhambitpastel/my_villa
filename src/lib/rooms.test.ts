import { describe, it, expect } from "vitest";
import {
  bookedNights,
  dayBudget,
  hasDayLimit,
  isGraduated,
  neededSpan,
  parseRoomPlan,
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

describe("roomPlanFor (top-up against held rooms)", () => {
  const BIG_HOTEL = 20;

  it("tops up to the ask on nights the guest already holds rooms", () => {
    // Holds 4 rooms Jul 24–26; now wants to hold 5 a night, Jul 24–29. Those
    // first nights need ONE more (they only asked for 5); from the 26th they
    // hold nothing, so all 5 are needed.
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
    );
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 1 },
      { checkIn: "2026-07-26", checkOut: "2026-07-29", rooms: 5 },
    ]);
    expect(isGraduated(plan)).toBe(true);
  });

  it("never books past the ask", () => {
    // Holds 2, asks 3 → adds exactly 1.
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 2 },
    ];
    const plan = roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 3, mine);
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
      roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 4, mine),
    ).toEqual([]);
  });

  it("returns no plan when the ask is at or below what's already held", () => {
    const mine: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 6 },
    ];
    expect(
      roomPlanFor("2026-07-24", "2026-07-26", mine, BIG_HOTEL, 1, mine),
    ).toEqual([]);
  });

  it("is capped by free inventory", () => {
    // 3-room hotel with 2 sold to someone else: only 1 room is free, so an ask
    // for 6 books just the 1 available.
    const others: RoomBooking[] = [
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 2 },
    ];
    const plan = roomPlanFor("2026-07-24", "2026-07-26", others, 3, 6, []);
    expect(plan).toEqual([
      { checkIn: "2026-07-24", checkOut: "2026-07-26", rooms: 1 },
    ]);
  });

  it("offers the whole ask when the hotel has room (no held rooms)", () => {
    // A 10-room hotel must offer all 8 asked for.
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

describe("hasDayLimit", () => {
  it("is false for 0 (no limit) and negatives, true for a positive cap", () => {
    expect(hasDayLimit(0)).toBe(false);
    expect(hasDayLimit(-1)).toBe(false);
    expect(hasDayLimit(Infinity)).toBe(false);
    expect(hasDayLimit(4)).toBe(true);
  });
});

describe("bookedNights", () => {
  it("collects the distinct nights across a guest's stays", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-12", rooms: 3 },
      { checkIn: "2026-07-15", checkOut: "2026-07-16", rooms: 1 },
    ];
    expect([...bookedNights(held)].sort()).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-15",
    ]);
  });

  it("counts a night once no matter how many rooms or bookings touch it", () => {
    const held: RoomBooking[] = [
      { checkIn: "2026-07-10", checkOut: "2026-07-11", rooms: 5 },
      { checkIn: "2026-07-10", checkOut: "2026-07-11", rooms: 2 },
    ];
    expect(bookedNights(held).size).toBe(1);
  });
});

describe("dayBudget (per-guest night budget)", () => {
  const HELD: RoomBooking[] = [
    { checkIn: "2026-07-22", checkOut: "2026-07-24", rooms: 3 }, // nights 22, 23
  ];

  it("is never over budget when the owner set no limit", () => {
    const b = dayBudget(0, HELD, "2026-07-24", "2026-08-24");
    expect(b.limited).toBe(false);
    expect(b.overBudget).toBe(false);
    expect(b.remaining).toBe(Infinity);
  });

  it("spends the budget in distinct nights, counting held stays", () => {
    // Limit 4, already holds 2 nights (22, 23). Booking 24→26 adds 24, 25.
    const b = dayBudget(4, HELD, "2026-07-24", "2026-07-26");
    expect(b.used).toBe(2);
    expect(b.added).toBe(2);
    expect(b.remaining).toBe(2);
    expect(b.overBudget).toBe(false);
  });

  it("flags a booking that would push the guest past the limit", () => {
    // Holds 2, limit 4, but this books 3 new nights (24, 25, 26) → 5 total.
    const b = dayBudget(4, HELD, "2026-07-24", "2026-07-27");
    expect(b.added).toBe(3);
    expect(b.overBudget).toBe(true);
  });

  it("charges no nights for extra rooms on nights already held", () => {
    // The whole range is nights the guest already occupies — 0 added, fits.
    const b = dayBudget(2, HELD, "2026-07-22", "2026-07-24");
    expect(b.added).toBe(0);
    expect(b.overBudget).toBe(false);
  });

  it("is already spent once the guest holds the whole budget", () => {
    const b = dayBudget(2, HELD, "2026-07-24", "2026-07-25");
    expect(b.used).toBe(2);
    expect(b.remaining).toBe(0);
    expect(b.overBudget).toBe(true); // any new night busts it
  });
});
