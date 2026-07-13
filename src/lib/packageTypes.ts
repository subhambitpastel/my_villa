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
