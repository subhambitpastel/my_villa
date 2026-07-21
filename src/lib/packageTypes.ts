import { isRoomBased } from "./rooms";
// Package "types" the owner can pick when creating a package. A preset type
// (weekend/weekly/monthly) has a fixed night count and auto-fills the price from
// the villa's nightly rate + the long-stay discount; "curated" is fully custom.
// Pure data + helpers, shared by client (owner form), server (actions) and the
// public packages page — no framework deps.

export type PackageType = "curated" | "weekend" | "weekly" | "monthly";

export type PackageTypeDef = {
  value: PackageType;
  label: string;
  /** Fixed nights for a preset, or null for the custom "curated" type. */
  nights: number | null;
  /** Discount % off the nightly rate a preset advertises (matches the long-stay
   *  tiers); null for "curated" (owner sets their own). */
  discountPct: number | null;
  /** Short blurb for the public page section. */
  blurb: string;
};

export const PACKAGE_TYPES: PackageTypeDef[] = [
  {
    value: "curated",
    label: "Curated Package",
    nights: null,
    discountPct: null,
    blurb: "One-off getaways our hosts put together — your own nights and price.",
  },
  {
    value: "weekend",
    label: "Weekend Getaway",
    nights: 3,
    discountPct: 0,
    blurb: "A short 3-night escape at the standard nightly rate.",
  },
  {
    value: "weekly",
    label: "Weekly Escape",
    nights: 7,
    discountPct: 15,
    blurb: "A full week with a 15% long-stay discount baked in.",
  },
  {
    value: "monthly",
    label: "Monthly Retreat",
    nights: 28,
    discountPct: 30,
    blurb: "Live like a local for a month — 30% off the nightly rate.",
  },
];

const BY_VALUE = new Map(PACKAGE_TYPES.map((t) => [t.value, t]));

/** Coerce an untrusted string to a valid PackageType (defaults to "curated"). */
export function parsePackageType(value: string | undefined | null): PackageType {
  return value && BY_VALUE.has(value as PackageType)
    ? (value as PackageType)
    : "curated";
}

export function packageTypeLabel(type: PackageType): string {
  return BY_VALUE.get(type)?.label ?? "Curated Package";
}

/** Fixed nights for a preset type, or null for "curated". */
export function presetNights(type: PackageType): number | null {
  return BY_VALUE.get(type)?.nights ?? null;
}

/** Advertised discount % for a preset type, or null for "curated". */
export function presetDiscount(type: PackageType): number | null {
  return BY_VALUE.get(type)?.discountPct ?? null;
}

/* ------------------------------ package rules -----------------------------
   Shared by the owner's own package actions and the admin's, so a package
   edited from the back office obeys the rules its owner is held to — one set
   of rules, not a second opinion that happens to agree today. */

/** What a package is, as it arrives from either form. */
export type PackageInput = {
  villaId: number;
  name: string;
  description: string;
  type: string;
  nights: number;
  maxGuests: number;
  discount: number;
  price: number;
  inclusions: string[];
};

/** The villa fields a package is validated against. */
export type PackageVilla = {
  kind: string;
  rooms: number;
  people_per_room: number;
  max_guests: number;
};

/** A preset type (weekend/weekly/monthly) fixes the nights server-side, so a
 *  tampered client can't claim a "Monthly Retreat" with 2 nights. */
export function resolvedNights(input: PackageInput): number {
  return (
    presetNights(parsePackageType(input.type)) ??
    Math.max(1, Math.trunc(input.nights))
  );
}

/** Presets fix the advertised discount too; curated is the owner's own 0–90%. */
export function resolvedDiscount(input: PackageInput): number {
  const preset = presetDiscount(parsePackageType(input.type));
  if (preset !== null) return preset;
  return Math.min(90, Math.max(0, Math.trunc(Number(input.discount)) || 0));
}

/** Trim, drop blanks, cap the list so a package can't carry junk/huge input. */
export function normalizeInclusions(list: string[] | undefined): string[] {
  return (list ?? [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s !== "")
    .slice(0, 20);
}

/** Most guests a package on this villa may declare — room-based villas cap at
 *  rooms × per-room occupancy, whole-villa kinds at the villa's max_guests. */
export function villaGuestCapacity(v: PackageVilla): number {
  return isRoomBased(v.kind)
    ? Math.max(1, v.rooms * v.people_per_room)
    : Math.max(1, v.max_guests);
}

export const cleanPackagePrice = (v: number) =>
  Math.round((Number(v) || 0) * 100) / 100;

/** The reason this package can't be saved, or null when it can. */
export function validatePackageInput(
  input: PackageInput,
  villa: PackageVilla,
): string | null {
  if (!input.name.trim()) return "Package name is required.";
  if (!(resolvedNights(input) >= 1))
    return "A package must run for at least 1 night.";
  const guests = Math.trunc(input.maxGuests);
  if (!(guests >= 1)) return "A package must be for at least 1 guest.";
  const cap = villaGuestCapacity(villa);
  if (guests > cap)
    return `This villa fits up to ${cap} guest${cap === 1 ? "" : "s"}.`;
  if (!(Number(input.price) >= 0)) return "Price can't be negative.";
  if (normalizeInclusions(input.inclusions).length === 0)
    return "Add at least one inclusion to the package.";
  return null;
}
