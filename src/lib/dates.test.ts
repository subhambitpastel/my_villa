import { describe, it, expect } from "vitest";
import { nightsBetween, formatRange, formatDay, parseDay } from "./dates";

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
