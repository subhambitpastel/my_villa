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
export const DIAL_CODES: { country: string; code: string }[] = [
  { country: "Australia", code: "+61" },
  { country: "Austria", code: "+43" },
  { country: "Bangladesh", code: "+880" },
  { country: "Belgium", code: "+32" },
  { country: "Brazil", code: "+55" },
  { country: "Canada", code: "+1" },
  { country: "China", code: "+86" },
  { country: "Denmark", code: "+45" },
  { country: "Egypt", code: "+20" },
  { country: "France", code: "+33" },
  { country: "Germany", code: "+49" },
  { country: "Greece", code: "+30" },
  { country: "India", code: "+91" },
  { country: "Indonesia", code: "+62" },
  { country: "Ireland", code: "+353" },
  { country: "Italy", code: "+39" },
  { country: "Japan", code: "+81" },
  { country: "Malaysia", code: "+60" },
  { country: "Maldives", code: "+960" },
  { country: "Mexico", code: "+52" },
  { country: "Mongolia", code: "+976" },
  { country: "Morocco", code: "+212" },
  { country: "Nepal", code: "+977" },
  { country: "Netherlands", code: "+31" },
  { country: "New Zealand", code: "+64" },
  { country: "Norway", code: "+47" },
  { country: "Philippines", code: "+63" },
  { country: "Portugal", code: "+351" },
  { country: "Singapore", code: "+65" },
  { country: "South Africa", code: "+27" },
  { country: "South Korea", code: "+82" },
  { country: "Spain", code: "+34" },
  { country: "Sri Lanka", code: "+94" },
  { country: "Sweden", code: "+46" },
  { country: "Switzerland", code: "+41" },
  { country: "Thailand", code: "+66" },
  { country: "Turkey", code: "+90" },
  { country: "United Arab Emirates", code: "+971" },
  { country: "United Kingdom", code: "+44" },
  { country: "United States", code: "+1" },
  { country: "Vietnam", code: "+84" },
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

/** A phone number is 6–15 digits once spaces and dashes are stripped. */
export function isValidPhoneNumber(number: string): boolean {
  return /^\d{6,15}$/.test((number ?? "").replace(/[\s-]/g, ""));
}

/** Canonical stored form: "+CC digits" (empty when there's no number). */
export function joinDialNumber(code: string, number: string): string {
  const digits = (number ?? "").replace(/[\s-]/g, "");
  if (!digits) return "";
  return `${code} ${digits}`.trim();
}
