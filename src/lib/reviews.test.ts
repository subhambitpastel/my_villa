import { describe, it, expect } from "vitest";
import {
  canEditReview,
  editHoursLeft,
  editWindowLeft,
  REVIEW_EDIT_HOURS,
} from "./reviews";

/** A stored `created_at`: UTC text, seconds precision. */
const stamp = (ms: number) =>
  new Date(ms).toISOString().slice(0, 19).replace("T", " ");

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0); // 2026-09-27 12:00:00Z
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe("canEditReview", () => {
  it("allows an edit inside the window", () => {
    expect(canEditReview(stamp(NOW), NOW)).toBe(true);
    expect(canEditReview(stamp(NOW - HOUR), NOW)).toBe(true);
    expect(canEditReview(stamp(NOW - 23 * HOUR), NOW)).toBe(true);
  });

  it("closes at exactly the window, not a moment later", () => {
    expect(canEditReview(stamp(NOW - REVIEW_EDIT_HOURS * HOUR + MINUTE), NOW)).toBe(true);
    expect(canEditReview(stamp(NOW - REVIEW_EDIT_HOURS * HOUR), NOW)).toBe(false);
    expect(canEditReview(stamp(NOW - 48 * HOUR), NOW)).toBe(false);
  });

  it("refuses a timestamp it cannot read, rather than opening the window", () => {
    expect(canEditReview("not a date", NOW)).toBe(false);
    expect(canEditReview("", NOW)).toBe(false);
  });
});

describe("editHoursLeft", () => {
  it("counts down in whole hours", () => {
    expect(editHoursLeft(stamp(NOW), NOW)).toBe(REVIEW_EDIT_HOURS);
    expect(editHoursLeft(stamp(NOW - HOUR), NOW)).toBe(23);
    expect(editHoursLeft(stamp(NOW - 23 * HOUR - 30 * MINUTE), NOW)).toBe(1);
  });

  it("is zero once the window has closed", () => {
    expect(editHoursLeft(stamp(NOW - REVIEW_EDIT_HOURS * HOUR), NOW)).toBe(0);
    expect(editHoursLeft(stamp(NOW - 100 * HOUR), NOW)).toBe(0);
    expect(editHoursLeft("not a date", NOW)).toBe(0);
  });

  it("never promises more than the window", () => {
    /* A row stamped AHEAD of now is real: the pretend clock is an offset that
       keeps ticking, so a review written during one run sits minutes past the
       moment the next run starts from. It used to read "25h left" of a
       24-hour window. */
    expect(editHoursLeft(stamp(NOW + MINUTE), NOW)).toBe(REVIEW_EDIT_HOURS);
    expect(editHoursLeft(stamp(NOW + 10 * HOUR), NOW)).toBe(REVIEW_EDIT_HOURS);
    expect(editHoursLeft(stamp(NOW + 40 * 24 * HOUR), NOW)).toBe(REVIEW_EDIT_HOURS);
  });

  it("still treats a future stamp as editable", () => {
    // Fresh, not expired — the clamp must not read as "window closed".
    expect(canEditReview(stamp(NOW + MINUTE), NOW)).toBe(true);
  });
});

describe("editWindowLeft", () => {
  it("reads in hours while there is more than an hour to go", () => {
    expect(editWindowLeft(stamp(NOW), NOW)).toBe("24h left");
    expect(editWindowLeft(stamp(NOW - HOUR), NOW)).toBe("23h left");
    expect(editWindowLeft(stamp(NOW - 22 * HOUR), NOW)).toBe("2h left");
  });

  it("switches to minutes for the last hour", () => {
    // "1h left" for fifty-nine minutes reads as room the author hasn't got.
    expect(editWindowLeft(stamp(NOW - 23 * HOUR - MINUTE), NOW)).toBe("59m left");
    expect(editWindowLeft(stamp(NOW - 23 * HOUR - 40 * MINUTE), NOW)).toBe("20m left");
    expect(editWindowLeft(stamp(NOW - 24 * HOUR + MINUTE), NOW)).toBe("1m left");
  });

  it("is empty once the words stand", () => {
    expect(editWindowLeft(stamp(NOW - REVIEW_EDIT_HOURS * HOUR), NOW)).toBe("");
    expect(editWindowLeft(stamp(NOW - 100 * HOUR), NOW)).toBe("");
    expect(editWindowLeft("not a date", NOW)).toBe("");
  });

  it("never promises more than the window", () => {
    expect(editWindowLeft(stamp(NOW + 10 * HOUR), NOW)).toBe("24h left");
  });
});
