// Coupon rules shared by the owner's actions (actions.ts) and support's
// (adminActions.ts). Deliberately a PLAIN module: a "use server" file may only
// export async functions, so constants and pure validators can't live there —
// and duplicating them is how the two sides drift apart.

/** Codes read like codes: 3–20 chars of A–Z, digits and hyphens. Normalised to
 *  uppercase so SAVE10 and save10 are the same coupon everywhere. */
export const COUPON_CODE_RE = /^[A-Z0-9-]{3,20}$/;

/** The stored shape of a coupon's code + discount, after normalisation. */
export type CouponValues = { code: string; pct: number; fixed: number };

/**
 * Normalise and check a coupon's code and discount.
 *
 * The discount is one thing or the other, never both, and never degenerate: a
 * percentage is 1–99 (0 is no coupon, 100 is a free stay), a fixed amount is
 * strictly positive and rounded to cents. Redemption separately guarantees a
 * fixed discount can't take a stay below $1.
 */
export function validateCoupon(input: {
  code: string;
  pct?: number;
  fixed?: number;
}): { ok: true; values: CouponValues } | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(code))
    return {
      ok: false,
      error: "Codes are 3–20 letters, numbers or hyphens (e.g. SUMMER-10).",
    };

  const pct = Math.trunc(Number(input.pct ?? 0)) || 0;
  const fixed = Math.round((Number(input.fixed ?? 0) || 0) * 100) / 100;
  if ((pct > 0) === (fixed > 0))
    return {
      ok: false,
      error: "Give the coupon ONE discount: a percentage or a fixed amount.",
    };
  // Never 0 and never 100: 0% is not a coupon and 100% is a free stay.
  if (pct !== 0 && (pct < 1 || pct > 99))
    return { ok: false, error: "A percentage discount must be between 1 and 99." };
  if (fixed < 0 || (pct === 0 && fixed <= 0))
    return { ok: false, error: "A fixed discount must be more than $0." };

  return { ok: true, values: { code, pct, fixed } };
}

/** Free variations of a code that's already taken, so whoever picked it keeps
 *  the name they had in mind instead of inventing one from scratch. */
export function couponSuggestions(code: string, taken: Set<string>): string[] {
  const candidates: string[] = [];
  for (let n = 2; n <= 99 && candidates.length < 3; n++) {
    const c = `${code}-${n}`.slice(0, 20);
    if (!taken.has(c) && !candidates.includes(c)) candidates.push(c);
  }
  for (const suffix of ["-NEW", "-PLUS", "-VIP"]) {
    if (candidates.length >= 3) break;
    const c = `${code.slice(0, 20 - suffix.length)}${suffix}`;
    if (!taken.has(c) && !candidates.includes(c)) candidates.push(c);
  }
  return candidates;
}
