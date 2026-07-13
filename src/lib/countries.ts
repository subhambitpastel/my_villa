export const COUNTRIES = [
  "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Canada",
  "China", "Denmark", "Egypt", "France", "Germany", "Greece", "India",
  "Indonesia", "Ireland", "Italy", "Japan", "Malaysia", "Maldives",
  "Mexico", "Mongolia", "Morocco", "Nepal", "Netherlands", "New Zealand",
  "Norway", "Philippines", "Portugal", "Singapore", "South Africa",
  "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Thailand",
  "Turkey", "United Arab Emirates", "United Kingdom", "United States",
  "Vietnam",
];

/** Phone dial codes for the countries above (same order). */
// `min`/`max` are the national significant number length (digits AFTER the dial
// code) for that country, so a phone field can size/validate itself to whatever
// code is chosen instead of a one-size-fits-all 6–15.
export const DIAL_CODES: {
  country: string;
  code: string;
  min: number;
  max: number;
}[] = [
  { country: "Australia", code: "+61", min: 9, max: 9 },
  { country: "Austria", code: "+43", min: 10, max: 11 },
  { country: "Bangladesh", code: "+880", min: 10, max: 10 },
  { country: "Belgium", code: "+32", min: 8, max: 9 },
  { country: "Brazil", code: "+55", min: 10, max: 11 },
  { country: "Canada", code: "+1", min: 10, max: 10 },
  { country: "China", code: "+86", min: 11, max: 11 },
  { country: "Denmark", code: "+45", min: 8, max: 8 },
  { country: "Egypt", code: "+20", min: 9, max: 10 },
  { country: "France", code: "+33", min: 9, max: 9 },
  { country: "Germany", code: "+49", min: 10, max: 11 },
  { country: "Greece", code: "+30", min: 10, max: 10 },
  { country: "India", code: "+91", min: 10, max: 10 },
  { country: "Indonesia", code: "+62", min: 9, max: 12 },
  { country: "Ireland", code: "+353", min: 7, max: 9 },
  { country: "Italy", code: "+39", min: 9, max: 11 },
  { country: "Japan", code: "+81", min: 9, max: 10 },
  { country: "Malaysia", code: "+60", min: 8, max: 10 },
  { country: "Maldives", code: "+960", min: 7, max: 7 },
  { country: "Mexico", code: "+52", min: 10, max: 10 },
  { country: "Mongolia", code: "+976", min: 8, max: 8 },
  { country: "Morocco", code: "+212", min: 9, max: 9 },
  { country: "Nepal", code: "+977", min: 10, max: 10 },
  { country: "Netherlands", code: "+31", min: 9, max: 9 },
  { country: "New Zealand", code: "+64", min: 8, max: 10 },
  { country: "Norway", code: "+47", min: 8, max: 8 },
  { country: "Philippines", code: "+63", min: 10, max: 10 },
  { country: "Portugal", code: "+351", min: 9, max: 9 },
  { country: "Singapore", code: "+65", min: 8, max: 8 },
  { country: "South Africa", code: "+27", min: 9, max: 9 },
  { country: "South Korea", code: "+82", min: 9, max: 10 },
  { country: "Spain", code: "+34", min: 9, max: 9 },
  { country: "Sri Lanka", code: "+94", min: 9, max: 9 },
  { country: "Sweden", code: "+46", min: 7, max: 9 },
  { country: "Switzerland", code: "+41", min: 9, max: 9 },
  { country: "Thailand", code: "+66", min: 8, max: 9 },
  { country: "Turkey", code: "+90", min: 10, max: 10 },
  { country: "United Arab Emirates", code: "+971", min: 8, max: 9 },
  { country: "United Kingdom", code: "+44", min: 9, max: 10 },
  { country: "United States", code: "+1", min: 10, max: 10 },
  { country: "Vietnam", code: "+84", min: 9, max: 10 },
];

/** Picker options, one per country with the name first so the native
 *  select type-ahead matches what users type ("i" → India). The value
 *  carries the country too, keeping shared codes like +1 unique per
 *  option — normalize with dialCodeFromValue() before storing. */
export const DIAL_CODE_OPTIONS = DIAL_CODES.map(({ country, code }) => ({
  value: `${code}|${country}`,
  label: `${country} (${code})`,
}));

/** "+1|Canada" → "+1" (also passes through already-plain codes). */
export const dialCodeFromValue = (value: string) => value.split("|")[0];

/** "+1|Canada" → "Canada" ("" when the value carries no country). */
export const countryFromDialValue = (value: string) => value.split("|")[1] ?? "";

/** Resolve a stored dial code — plain ("+86") or composite ("+86|China") — plus
 *  an optional country into the matching DIAL_CODE_OPTIONS value, or "" if none.
 *  Lets a saved profile prefill the dial-code picker regardless of stored shape. */
export function dialValueFor(code: string, country?: string): string {
  if (!code) return "";
  if (code.includes("|")) return code; // already an option value
  const matches = DIAL_CODES.filter((d) => d.code === code);
  if (matches.length === 0) return "";
  const chosen =
    (country && matches.find((d) => d.country === country)) || matches[0];
  return `${chosen.code}|${chosen.country}`;
}

/** Split a stored contact like "+91 9876543210" into its dial code and number.
 *  Matches the longest known dial-code prefix; if none matches, code is "" and
 *  the whole value is the number. */
export function splitDialNumber(stored: string): { code: string; number: string } {
  const s = (stored ?? "").trim();
  let code = "";
  for (const d of DIAL_CODES) {
    if (s.startsWith(d.code) && d.code.length > code.length) code = d.code;
  }
  return code
    ? { code, number: s.slice(code.length).trim() }
    : { code: "", number: s };
}

/** International bounds: an E.164 national number is 4–15 digits. Used as the
 *  fallback range when no country/dial code has been chosen yet. */
export const MAX_PHONE_DIGITS = 15;
const MIN_PHONE_DIGITS = 4;

/** The allowed national-number digit range for a dial code — accepts a plain
 *  code ("+86"), a composite picker value ("+86|China"), or "" (no code, giving
 *  the generic 4–15 range). +1 is shared by US/Canada but both are 10 digits. */
export function phoneLenFor(dial: string): { min: number; max: number } {
  if (!dial) return { min: MIN_PHONE_DIGITS, max: MAX_PHONE_DIGITS };
  const [code, country] = dial.split("|");
  const entry =
    (country && DIAL_CODES.find((d) => d.code === code && d.country === country)) ||
    DIAL_CODES.find((d) => d.code === code);
  return entry
    ? { min: entry.min, max: entry.max }
    : { min: MIN_PHONE_DIGITS, max: MAX_PHONE_DIGITS };
}

/** Valid when the digit count fits the chosen country's range (generic 4–15 if
 *  no `dial` is given). Spaces/dashes are ignored; letters are always invalid. */
export function isValidPhoneNumber(number: string, dial = ""): boolean {
  const digits = (number ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return false;
  const { min, max } = phoneLenFor(dial);
  return digits.length >= min && digits.length <= max;
}

/** Sanitize as-typed: keep digits (plus spaces/dashes for readability), drop
 *  everything else, and stop accepting digits past the chosen country's max
 *  length (generic 15 if no `dial` given) so the field can't run too long. */
export function capPhoneNumber(value: string, dial = ""): string {
  const max = phoneLenFor(dial).max;
  let digits = 0;
  let out = "";
  for (const ch of value ?? "") {
    if (ch >= "0" && ch <= "9") {
      if (digits >= max) continue;
      digits++;
      out += ch;
    } else if (ch === " " || ch === "-") {
      out += ch;
    }
  }
  return out;
}

/* --------------------------- postal codes --------------------------- */

export type PostalRule = {
  /** Validates a trimmed postal code for the country. */
  regex: RegExp;
  /** Max characters the input accepts. */
  maxLength: number;
  /** Example shown in the placeholder / error (e.g. "734004"). */
  example: string;
  /** Digits-only format — letters are stripped as you type. Defaults to true;
   *  set false for alphanumeric formats (UK, Canada, Netherlands, Ireland). */
  numeric?: boolean;
};

const numeric = (n: number): RegExp => new RegExp(`^\\d{${n}}$`);

// Postal-code format per country. Most are fixed-length numeric; a handful are
// alphanumeric (UK/Canada/Netherlands/Ireland) or numeric-with-separator
// (Japan/Brazil/Portugal/Sweden). Anything not listed uses DEFAULT_POSTAL.
const POSTAL_RULES: Record<string, PostalRule> = {
  Australia: { regex: numeric(4), maxLength: 4, example: "2000" },
  Austria: { regex: numeric(4), maxLength: 4, example: "1010" },
  Bangladesh: { regex: numeric(4), maxLength: 4, example: "1000" },
  Belgium: { regex: numeric(4), maxLength: 4, example: "1000" },
  Brazil: { regex: /^\d{5}-?\d{3}$/, maxLength: 9, example: "01000-000" },
  Canada: { regex: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, maxLength: 7, example: "A1A 1A1", numeric: false },
  China: { regex: numeric(6), maxLength: 6, example: "100000" },
  Denmark: { regex: numeric(4), maxLength: 4, example: "1050" },
  Egypt: { regex: numeric(5), maxLength: 5, example: "11511" },
  France: { regex: numeric(5), maxLength: 5, example: "75001" },
  Germany: { regex: numeric(5), maxLength: 5, example: "10115" },
  Greece: { regex: numeric(5), maxLength: 5, example: "10552" },
  India: { regex: numeric(6), maxLength: 6, example: "734004" },
  Indonesia: { regex: numeric(5), maxLength: 5, example: "10110" },
  Ireland: { regex: /^[A-Za-z]\d{2} ?[A-Za-z\d]{4}$/, maxLength: 8, example: "A65 F4E2", numeric: false },
  Italy: { regex: numeric(5), maxLength: 5, example: "00100" },
  Japan: { regex: /^\d{3}-?\d{4}$/, maxLength: 8, example: "123-4567" },
  Malaysia: { regex: numeric(5), maxLength: 5, example: "50000" },
  Maldives: { regex: numeric(5), maxLength: 5, example: "20026" },
  Mexico: { regex: numeric(5), maxLength: 5, example: "01000" },
  Mongolia: { regex: numeric(5), maxLength: 5, example: "15160" },
  Morocco: { regex: numeric(5), maxLength: 5, example: "10000" },
  Nepal: { regex: numeric(5), maxLength: 5, example: "44600" },
  Netherlands: { regex: /^\d{4} ?[A-Za-z]{2}$/, maxLength: 7, example: "1234 AB", numeric: false },
  "New Zealand": { regex: numeric(4), maxLength: 4, example: "6011" },
  Norway: { regex: numeric(4), maxLength: 4, example: "0010" },
  Philippines: { regex: numeric(4), maxLength: 4, example: "1000" },
  Portugal: { regex: /^\d{4}-?\d{3}$/, maxLength: 8, example: "1000-001" },
  Singapore: { regex: numeric(6), maxLength: 6, example: "238877" },
  "South Africa": { regex: numeric(4), maxLength: 4, example: "0002" },
  "South Korea": { regex: numeric(5), maxLength: 5, example: "04524" },
  Spain: { regex: numeric(5), maxLength: 5, example: "28001" },
  "Sri Lanka": { regex: numeric(5), maxLength: 5, example: "00100" },
  Sweden: { regex: /^\d{3} ?\d{2}$/, maxLength: 6, example: "123 45" },
  Switzerland: { regex: numeric(4), maxLength: 4, example: "8001" },
  Thailand: { regex: numeric(5), maxLength: 5, example: "10200" },
  Turkey: { regex: numeric(5), maxLength: 5, example: "34000" },
  "United Arab Emirates": { regex: /^.{0,12}$/, maxLength: 12, example: "optional", numeric: false },
  "United Kingdom": { regex: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, maxLength: 8, example: "SW1A 1AA", numeric: false },
  "United States": { regex: /^\d{5}(-\d{4})?$/, maxLength: 10, example: "12345 or 12345-6789" },
  Vietnam: { regex: numeric(6), maxLength: 6, example: "700000" },
};

/** A generic rule for any country not in POSTAL_RULES: 2–10 alphanumerics. */
const DEFAULT_POSTAL: PostalRule = {
  regex: /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/,
  maxLength: 10,
  example: "postal code",
  numeric: false,
};

/** The postal-code rule for a country (falls back to a generic rule). */
export function postalRuleFor(country: string): PostalRule {
  return POSTAL_RULES[country] ?? DEFAULT_POSTAL;
}

/** True when the country's postal code is digits-only (no letters allowed). */
export function postalIsNumeric(country: string): boolean {
  return postalRuleFor(country).numeric !== false;
}

/**
 * Sanitize a postal code as the guest types: strip characters the country's
 * format never contains — letters too for digits-only countries (India, US…) —
 * and cap to the country's max length. Alphanumeric formats (UK, Canada…) keep
 * their letters.
 */
export function capPostalCode(value: string, country: string): string {
  const rule = postalRuleFor(country);
  const cleaned =
    rule.numeric === false
      ? value.replace(/[^A-Za-z0-9\s-]/g, "")
      : value.replace(/[^\d\s-]/g, "");
  return cleaned.slice(0, rule.maxLength);
}

/** Canonical stored form: "+CC digits" (empty when there's no number). */
export function joinDialNumber(code: string, number: string): string {
  const digits = (number ?? "").replace(/[\s-]/g, "");
  if (!digits) return "";
  return `${code} ${digits}`.trim();
}
