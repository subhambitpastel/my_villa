import { describe, it, expect } from "vitest";
import { quote, stayDiscount, bookingReference } from "./pricing";

describe("stayDiscount", () => {
  it("no discount under 7 nights", () => {
    expect(stayDiscount(1).rate).toBe(0);
    expect(stayDiscount(6).rate).toBe(0);
  });
  it("15% for 7–27 nights", () => {
    expect(stayDiscount(7).rate).toBe(0.15);
    expect(stayDiscount(27).rate).toBe(0.15);
  });
  it("30% for 28+ nights", () => {
    expect(stayDiscount(28).rate).toBe(0.3);
    expect(stayDiscount(60).rate).toBe(0.3);
  });
});

describe("quote", () => {
  it("short stay: no discount, 18% service fee", () => {
    const q = quote(100, 3);
    expect(q.subtotal).toBe(300);
    expect(q.discountAmount).toBe(0);
    expect(q.serviceFee).toBe(54);
    expect(q.total).toBe(354);
  });
  it("weekly stay: 15% discount applied before the fee", () => {
    const q = quote(100, 7);
    expect(q.subtotal).toBe(700);
    expect(q.discountAmount).toBe(105);
    expect(q.serviceFee).toBe(107.1);
    expect(q.total).toBe(702.1);
  });
  it("monthly stay: 30% discount", () => {
    const q = quote(100, 28);
    expect(q.subtotal).toBe(2800);
    expect(q.discountAmount).toBe(840);
    expect(q.total).toBe(2312.8);
  });
});

describe("bookingReference", () => {
  it("zero-pads to 6 digits", () => {
    expect(bookingReference(42)).toBe("MV-000042");
    expect(bookingReference(123456)).toBe("MV-123456");
  });
});
