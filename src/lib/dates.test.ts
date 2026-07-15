import { describe, it, expect } from "vitest";
import {
  nightsBetween,
  formatRange,
  formatDay,
  parseDay,
  addMonths,
} from "./dates";

describe("nightsBetween", () => {
  it("counts nights across a range", () => {
    expect(nightsBetween("2026-01-10", "2026-01-13")).toBe(3);
    expect(nightsBetween("2026-01-10", "2026-01-11")).toBe(1);
  });
  it("is zero or negative for invalid/backwards ranges", () => {
    expect(nightsBetween("2026-01-13", "2026-01-10")).toBe(-3);
    expect(nightsBetween("garbage", "2026-01-10")).toBe(0);
    expect(nightsBetween("", "")).toBe(0);
  });
});

describe("formatDay / formatRange", () => {
  it("formats a single day", () => {
    expect(formatDay("2026-07-14")).toBe("14 Jul");
    expect(formatDay("2026-12-01")).toBe("01 Dec");
  });
  it("formats a range", () => {
    expect(formatRange("2026-01-10", "2026-01-13")).toBe("10 Jan-13 Jan");
  });
});

describe("addMonths", () => {
  it("advances by whole calendar months", () => {
    expect(addMonths("2026-07-14", 3)).toBe("2026-10-14");
    expect(addMonths("2026-11-30", 1)).toBe("2026-12-30");
  });
  it("rolls over the year boundary", () => {
    expect(addMonths("2026-12-15", 3)).toBe("2027-03-15");
  });
  it("clamps the day to the shorter target month", () => {
    // Jan 31 + 1mo → Feb has no 31st, so clamp to the 28th (non-leap year).
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    // Nov 30 + 3mo → Feb 2027 (28 days) clamps to the 28th.
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("returns the input unchanged when unparseable", () => {
    expect(addMonths("garbage", 3)).toBe("garbage");
  });
});

describe("parseDay", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(parseDay("2026-01-10")).not.toBeNull();
  });
  it("rejects malformed input", () => {
    expect(parseDay("2026-1-1")).toBeNull();
    expect(parseDay("not-a-date")).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});
