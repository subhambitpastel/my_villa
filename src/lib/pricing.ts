// Booking price rules — shared by the villa page, checkout, and packages so
// an advertised discount is always the one actually charged.

export const SERVICE_FEE_RATE = 0.18;

export type StayDiscount = { rate: number; label: string };

/** Automatic length-of-stay discount. */
export function stayDiscount(nights: number): StayDiscount {
  if (nights >= 28) return { rate: 0.3, label: "Monthly stay discount (30%)" };
  if (nights >= 7) return { rate: 0.15, label: "Weekly stay discount (15%)" };
  return { rate: 0, label: "" };
}

export type Quote = {
  nights: number;
  subtotal: number;
  discount: StayDiscount;
  discountAmount: number;
  serviceFee: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quote(pricePerNight: number, nights: number): Quote {
  const subtotal = round2(pricePerNight * nights);
  const discount = stayDiscount(nights);
  const discountAmount = round2(subtotal * discount.rate);
  const serviceFee = round2((subtotal - discountAmount) * SERVICE_FEE_RATE);
  const total = round2(subtotal - discountAmount + serviceFee);
  return { nights, subtotal, discount, discountAmount, serviceFee, total };
}

/** "MV-000042" style booking reference from a row id. */
export function bookingReference(id: number): string {
  return `MV-${String(id).padStart(6, "0")}`;
}
