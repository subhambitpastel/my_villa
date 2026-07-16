// In-page text matching for the account lists (My Bookings, My Properties, My
// Packages, My Favorites, the request queues). These lists are already loaded in
// full, so they filter in the browser rather than re-querying — this is the
// client-side counterpart to the SQL /search runs in `villaSearchWhere`.

/**
 * Case-insensitive match of a query against one record's fields. An empty query
 * matches everything.
 *
 * Two shapes, mirroring /search:
 *
 *  - **Plain** — every word must turn up somewhere across the fields, in any
 *    order: "bund shanghai" finds The Bund in Shanghai.
 *  - **Comma-separated** — each part must land inside a SINGLE field, so a name
 *    and a place narrow together: "The Bund, Shanghai" needs one field holding
 *    "the bund" and one holding "shanghai".
 *
 * Parts are matched per-field rather than against the fields joined together,
 * because a joined haystack lets a part match across the seam between two
 * fields (name "Grand" + city "Shanghai" would match the phrase "grand shang").
 * Parts needn't match *distinct* fields though: My Bookings stores its villa as
 * one pre-joined "Name, City" string, and both parts legitimately match it.
 */
export function matchesSearch(
  query: string,
  ...fields: (string | number | null | undefined)[]
): boolean {
  const values = fields
    .filter((f) => f != null && f !== "")
    .map((f) => String(f).toLowerCase());

  const parts = query
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Nothing typed, or only commas and spaces — not a query yet.
  if (parts.length === 0) return true;

  if (parts.length > 1) {
    return parts.every((part) => values.some((value) => value.includes(part)));
  }

  // A single part stays a loose word-AND, so "bund shanghai" works with no
  // comma at all. Deliberately parts[0] and not the raw query: that drops the
  // dangling comma in a half-typed "shanghai," instead of hunting for one.
  const hay = values.join(" ");
  return parts[0].split(/\s+/).every((word) => hay.includes(word));
}
