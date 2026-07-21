// How a package FORM behaves as it's filled in — shared by the owner's own
// package builder (My Packages) and the admin's edit dialog, so a package
// edited from the back office moves the same way it does for its owner. The
// server-side rules live next door in packageTypes.ts; these are the rules the
// fields follow while you type.
//
// Pure functions over plain strings (what inputs give back) — no React, no DB.

import { quote } from "./pricing";
import { isRoomBased, roomsForGuests } from "./rooms";
import {
  presetDiscount,
  presetNights,
  type PackageType,
} from "./packageTypes";

/** The villa a package is priced against. */
export type PricingVilla = {
  kind: string;
  /** Nightly rate. */
  price: number;
  /** The villa's own standing % off. */
  discount: number;
  rooms: number;
  peoplePerRoom: number;
  maxGuests: number;
};

/** The fields these rules touch. Both forms carry more (name, inclusions…) and
 *  keep whatever else they hold — hence the generic. */
export type PricedFields = {
  type: PackageType;
  nights: string;
  maxGuests: string;
  discount: string;
  price: string;
};

/** Rooms a package for this many guests needs (1 for whole-villa kinds). */
export function roomsNeeded(villa: PricingVilla, guests: number): number {
  return isRoomBased(villa.kind)
    ? roomsForGuests(villa.kind, guests, villa.peoplePerRoom)
    : 1;
}

/** Most guests a package on this villa may declare. */
export function packageVillaCapacity(villa: PricingVilla): number {
  return isRoomBased(villa.kind)
    ? Math.max(1, villa.rooms * villa.peoplePerRoom)
    : Math.max(1, villa.maxGuests);
}

/**
 * Apply a preset type: fix the nights and auto-price off the villa's nightly
 * rate. `quote` already applies the automatic long-stay discount, which is
 * exactly what the preset advertises (a Weekly Escape's 15% IS the 7-night
 * tier), so the price and the % stay honest about each other.
 */
export function applyPreset<F extends PricedFields>(
  form: F,
  type: PackageType,
  villa: PricingVilla | undefined,
): F {
  const nights = presetNights(type);
  // "Curated" is the absence of a preset — it keeps whatever is in the fields.
  if (nights === null) return { ...form, type: "curated" };
  return {
    ...form,
    type,
    nights: String(nights),
    discount: String(presetDiscount(type) ?? 0),
    price: villa ? quote(villa.price, nights).total.toFixed(2) : "",
  };
}

/**
 * Keep the all-inclusive price in step with a curated package's discount %:
 * price = what the same stay costs booked normally, less that %. So a "30% off"
 * package really does cost 30% less, and the saving shown to guests tracks the
 * number the host typed.
 *
 * A preset prices itself (see applyPreset), and with no discount there's
 * nothing to derive from — both leave the price exactly as it is.
 */
export function repriceFromDiscount<F extends PricedFields>(
  form: F,
  villa: PricingVilla | undefined,
): F {
  if (form.type !== "curated") return form;
  const pct = parseInt(form.discount, 10) || 0;
  const nights = parseInt(form.nights, 10) || 0;
  if (!villa || nights < 1 || pct <= 0) return form;
  const rooms = roomsNeeded(villa, parseInt(form.maxGuests, 10) || 0);
  const normal = quote(villa.price * rooms, nights, villa.discount).total;
  return {
    ...form,
    price: (Math.round(normal * (1 - pct / 100) * 100) / 100).toFixed(2),
  };
}

export type StayReference = {
  /** What the same stay costs booked normally, all in. */
  normal: number;
  nights: number;
  /** "3 rooms" or "the whole villa". */
  scope: string;
  kindLabel: string;
  /** e.g. "long-stay discount (15%)", already inside `normal` ("" = none). */
  discountNote: string;
  /** The % this package advertises. */
  planDiscount: number;
  /** What that % off `normal` comes to (null when no % is set). */
  target: number | null;
  pkgPrice: number;
  /** normal − pkgPrice: positive is a saving, negative a mark-up. */
  savings: number | null;
};

const KIND_NOUN: Record<string, string> = {
  Resort: "resort",
  Hotel: "hotel",
  Bungalow: "bungalow",
  "Villa Living": "villa",
};

/**
 * What a guest with no package would pay for the same villa and nights — the
 * yardstick that makes an all-inclusive price mean something. Uses the very
 * `quote` checkout charges, so it already carries the villa's discount (or the
 * long-stay one, whichever is larger) and the service fee.
 */
export function stayReference(
  form: PricedFields,
  villa: PricingVilla | undefined,
): StayReference | null {
  if (!villa) return null;
  const nights = parseInt(form.nights, 10) || 0;
  if (nights < 1) return null;
  const rooms = roomsNeeded(villa, parseInt(form.maxGuests, 10) || 0);
  const q = quote(villa.price * rooms, nights, villa.discount);
  const planDiscount = Math.min(90, parseInt(form.discount, 10) || 0);
  const pkgPrice = parseFloat(form.price) || 0;
  return {
    normal: q.total,
    nights,
    scope: isRoomBased(villa.kind)
      ? `${rooms} room${rooms === 1 ? "" : "s"}`
      : "the whole villa",
    kindLabel: KIND_NOUN[villa.kind] ?? "villa",
    discountNote: q.discount.rate > 0 ? q.discount.label.toLowerCase() : "",
    planDiscount,
    target:
      planDiscount > 0
        ? Math.round(q.total * (1 - planDiscount / 100) * 100) / 100
        : null,
    pkgPrice,
    savings: pkgPrice > 0 ? Math.round((q.total - pkgPrice) * 100) / 100 : null,
  };
}
