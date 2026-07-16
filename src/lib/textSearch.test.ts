import { describe, it, expect } from "vitest";
import { matchesSearch } from "./textSearch";

// The two field shapes the account lists actually hand it.
// My Properties keeps name/city/kind apart; My Bookings pre-joins "Name, City"
// into one string. Comma search has to work on both.
const property = (name: string, city: string, kind = "Hotel") =>
  [name, city, kind] as const;

describe("matchesSearch — plain queries", () => {
  it("matches everything until something is typed", () => {
    expect(matchesSearch("", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("   ", ...property("The Bund", "Shanghai"))).toBe(true);
  });

  it("matches a word in any field, case-insensitively", () => {
    expect(matchesSearch("bund", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("SHANGHAI", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("hotel", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("paris", ...property("The Bund", "Shanghai"))).toBe(false);
  });

  it("requires every word, in any order, across fields", () => {
    expect(matchesSearch("bund shanghai", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("shanghai bund", ...property("The Bund", "Shanghai"))).toBe(true);
    expect(matchesSearch("bund paris", ...property("The Bund", "Shanghai"))).toBe(false);
  });

  it("ignores empty and absent fields", () => {
    expect(matchesSearch("bund", "The Bund", "", null, undefined)).toBe(true);
    expect(matchesSearch("2026", "Stay", 2026)).toBe(true);
  });
});

describe("matchesSearch — comma-separated name + place", () => {
  it("narrows to a property matching BOTH parts", () => {
    expect(matchesSearch("The Bund, Shanghai", ...property("The Bund", "Shanghai"))).toBe(
      true,
    );
    // Right name, wrong place — and vice versa. Either half failing is a miss.
    expect(matchesSearch("The Bund, Paris", ...property("The Bund", "Shanghai"))).toBe(
      false,
    );
    expect(matchesSearch("Riverside, Shanghai", ...property("The Bund", "Shanghai"))).toBe(
      false,
    );
  });

  it("tells same-city properties apart", () => {
    const bund = property("The Bund", "Shanghai");
    const pearl = property("Pearl Tower", "Shanghai");
    expect(matchesSearch("Pearl, Shanghai", ...bund)).toBe(false);
    expect(matchesSearch("Pearl, Shanghai", ...pearl)).toBe(true);
  });

  it("does not care about spacing around the comma", () => {
    const bund = property("The Bund", "Shanghai");
    expect(matchesSearch("The Bund,Shanghai", ...bund)).toBe(true);
    expect(matchesSearch("The Bund ,  Shanghai", ...bund)).toBe(true);
  });

  it("keeps working mid-typing, when only a comma is there yet", () => {
    const bund = property("The Bund", "Shanghai");
    expect(matchesSearch("The Bund,", ...bund)).toBe(true);
    expect(matchesSearch(",", ...bund)).toBe(true);
    expect(matchesSearch(" , ", ...bund)).toBe(true);
  });

  it("matches My Bookings' pre-joined \"Name, City\" field", () => {
    // Both parts land in the one field here — that's why parts aren't required
    // to match *distinct* fields.
    const booking = ["The Bund, Shanghai", "Hotel", "20 Jul - 25 Jul 2026", "MV-1042"];
    expect(matchesSearch("The Bund, Shanghai", ...booking)).toBe(true);
    expect(matchesSearch("The Bund, Paris", ...booking)).toBe(false);
    // A part can pick up any other field, not just the place.
    expect(matchesSearch("The Bund, MV-1042", ...booking)).toBe(true);
  });

  it("does not let a part match across two fields", () => {
    // "d shan" only exists in the seam of "Grand" + "Shanghai" — joining the
    // fields into one haystack first would wrongly match this.
    expect(matchesSearch("d shan, grand", ...property("Grand", "Shanghai"))).toBe(false);
  });

  it("still matched the third field, so extra parts keep narrowing", () => {
    const bund = property("The Bund", "Shanghai", "Resort");
    expect(matchesSearch("The Bund, Shanghai, Resort", ...bund)).toBe(true);
    expect(matchesSearch("The Bund, Shanghai, Villa", ...bund)).toBe(false);
  });
});
