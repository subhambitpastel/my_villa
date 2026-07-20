import { describe, it, expect, vi, afterEach } from "vitest";
import { pretendTimeFrom, nowMs, todayKey, nowStamp } from "./clock";

const utc = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
): number => Date.UTC(y, m - 1, d, h, min);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pretendTimeFrom — no pretend clock", () => {
  it("treats a missing variable as the real clock", () => {
    // The normal case: nothing in .env.local at all.
    expect(pretendTimeFrom(undefined)).toBeNull();
    expect(pretendTimeFrom(null)).toBeNull();
  });

  it("treats blank or whitespace as the real clock", () => {
    // `NEXT_PUBLIC_CURRENT_TIME=` with nothing after it.
    expect(pretendTimeFrom("")).toBeNull();
    expect(pretendTimeFrom("   ")).toBeNull();
  });

  it("accepts the None-ish words, whatever the casing", () => {
    for (const word of [
      "None",
      "none",
      "NONE",
      "off",
      "real",
      "null",
      "undefined",
      "false",
      "  None  ",
    ]) {
      expect(pretendTimeFrom(word)).toBeNull();
    }
  });

  it("says nothing when there is no clock to complain about", () => {
    // A missing variable is the normal case, not a mistake — warning about it
    // would cry wolf on every single run.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    pretendTimeFrom(undefined);
    pretendTimeFrom("");
    pretendTimeFrom("None");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("pretendTimeFrom — a moment to pretend", () => {
  it("reads DD_MM_YYYY_HH_MM_AM|PM as UTC", () => {
    expect(pretendTimeFrom("20_07_2026_12_30_PM")).toBe(utc(2026, 7, 20, 12, 30));
    expect(pretendTimeFrom("01_01_2027_09_05_AM")).toBe(utc(2027, 1, 1, 9, 5));
  });

  it("puts midnight and noon on the right side of 12", () => {
    // 12 AM is the start of the day, 12 PM is the middle — the one pair a
    // 12-hour clock routinely gets backwards.
    expect(pretendTimeFrom("20_07_2026_12_00_AM")).toBe(utc(2026, 7, 20, 0, 0));
    expect(pretendTimeFrom("20_07_2026_12_00_PM")).toBe(utc(2026, 7, 20, 12, 0));
    expect(pretendTimeFrom("20_07_2026_11_59_PM")).toBe(utc(2026, 7, 20, 23, 59));
  });

  it("takes a lower-case meridiem and single-digit day or hour", () => {
    expect(pretendTimeFrom("5_9_2026_9_00_am")).toBe(utc(2026, 9, 5, 9, 0));
  });

  it("ignores surrounding whitespace", () => {
    expect(pretendTimeFrom("  20_07_2026_12_30_PM  ")).toBe(
      utc(2026, 7, 20, 12, 30),
    );
  });
});

describe("pretendTimeFrom — malformed", () => {
  it("falls back to the real clock and says so", () => {
    // Silence here would make a mistyped date look like broken behaviour.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const bad of [
      "20/07/2026 12:30 PM", // the shape people reach for first
      "2026_07_20_12_30_PM", // year first
      "20_07_2026_12_30", // no meridiem
      "20_07_2026_12_30_XM",
      "tomorrow",
    ]) {
      expect(pretendTimeFrom(bad)).toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(5);
  });
});

describe("the module clock", () => {
  it("runs on the real clock when nothing is set", () => {
    // The suite runs without NEXT_PUBLIC_CURRENT_TIME, so this is the
    // unset-variable path end to end.
    expect(Math.abs(nowMs() - Date.now())).toBeLessThan(1000);
    expect(todayKey()).toBe(new Date().toISOString().slice(0, 10));
  });

  it("stamps timestamps in the shape the DB columns hold", () => {
    expect(nowStamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
