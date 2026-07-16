// The third knowledge source: the global CATALOG — searching live listings,
// checking availability + price, and pulling up one named property's details.
// Server-only.
//
// Unlike the personal-data tools (data.ts), this is PUBLIC information — the same
// listings /search and the villa pages show anyone — so it isn't user-scoped for
// privacy (a search does exclude the caller's OWN listings, since no one books
// their own place; a detail lookup doesn't, so an owner can pull up their own).
// And unlike the key-only intent router, this needs PARAMETERS pulled out of the
// sentence — a city, dates, a room count, a price ceiling, amenities, or a
// property name — so it runs its own extraction step (one LLM call) first.
//
// The heavy lifting reuses the very functions the site uses — searchVillas,
// isVillaAvailable, quote(), getVillaById, getPackagesForVilla — so anything the
// bot quotes matches the app exactly.

import {
  searchVillas,
  isVillaAvailable,
  getVillaById,
  getPackagesForVilla,
  parseServiceList,
  type SearchFilterInput,
  type PropertyType,
  type CatalogVilla,
} from "@/lib/queries";
import { quote } from "@/lib/pricing";
import { isRoomBased } from "@/lib/rooms";
import {
  parseDay,
  nightsBetween,
  dayFromNow,
  addMonths,
  formatDay,
  MAX_STAY_NIGHTS,
  BOOKING_WINDOW_MONTHS,
} from "@/lib/dates";
import { generate } from "./llm";
import type { ChatTurn } from "./prompt";

/** Most results a single answer lists — enough for "show me all villas under
 *  $100" to feel complete, short enough to stay a chat reply. */
const MAX_RESULTS = 10;

/**
 * A cheap gate: does this look like a request to FIND a place, check
 * availability/price, or read up on a specific property — as opposed to a "how
 * does it work" question or one about the user's own bookings? Search verbs,
 * availability/price words, or "tell me about …" phrasing are the signals. The
 * extractor below is the real authority (it can still say "not a search"); this
 * only avoids paying for that call on plainly unrelated turns. Errs toward TRUE.
 */
export function hasSearchSignal(text: string): boolean {
  const q = ` ${text.toLowerCase()} `;
  return (
    /\b(find|search|show|looking for|look for|recommend|suggest|browse|book|list|any|where can)\b/.test(
      q,
    ) ||
    /\b(available|availability|free|vacan\w*|open)\b/.test(q) ||
    /\b(cheap\w*|budget|under|below|less than|between|from|price|cost|per night|nightly)\b/.test(
      q,
    ) ||
    /\b(tell me about|details? (about|of|on)|more about|describe|info\w*|what'?s? .* like)\b/.test(
      q,
    )
  );
}

/** What the extractor pulls out of the request. `intent` steers the rest:
 *  "detail" uses propertyName; "search" uses the filters; "none" is neither. */
type Extracted = {
  intent: "search" | "detail" | "none";
  propertyName: string | null;
  city: string | null;
  type: PropertyType | null;
  checkIn: string | null;
  checkOut: string | null;
  rooms: number | null;
  guests: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  amenities: string[];
  sort: "price_asc" | "price_desc" | "rating" | null;
};

/** Constant extraction persona — stable so its CLI prefix caches. Emits one JSON
 *  object; today's date rides in the user message (below), so THIS stays
 *  constant across days. */
const SYSTEM_EXTRACT = `You extract structured parameters from a user's request about places to stay on the MyVilla booking platform.

Output ONLY a JSON object — no prose, no code fences. Shape:
{"intent": "search"|"detail"|"none", "propertyName": string|null, "city": string|null, "type": "hotel"|"resort"|"rent"|null, "checkIn": "YYYY-MM-DD"|null, "checkOut": "YYYY-MM-DD"|null, "rooms": number|null, "guests": number|null, "minPrice": number|null, "maxPrice": number|null, "amenities": string[], "sort": "price_asc"|"price_desc"|"rating"|null}

intent:
- "detail" — the user asks ABOUT one specific named property ("tell me about The Bund", "what's Iris Villa like"). Put the property's name in propertyName.
- "search" — the user wants to FIND/BROWSE places, or check availability or price for a stay.
- "none" — anything else (how-things-work questions, the user's own bookings, small talk).

Other fields (for a search):
- type: "hotel" and "resort" are literal; "rent" means a whole private place (villa, bungalow, etc.). null if unspecified.
- Resolve relative dates ("this weekend", "the 18th to the 21st") against today's date, given in the message. Both checkIn and checkOut, or neither.
- rooms, guests: integers. minPrice/maxPrice: nightly USD amounts — use null (NOT 0) when unspecified.
- amenities: things the place must have that the user names — e.g. ["wifi"], ["private chef"], ["pool","parking"]. Empty array if none named.
- sort: "price_asc" for cheapest-first / "under $X", "rating" for "best"/"top-rated", else null.
Use the recent conversation to resolve follow-ups ("cheaper ones", "what about in Bali?").`;

const clampInt = (n: unknown, lo: number, hi: number): number | null => {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v >= lo ? Math.min(v, hi) : null;
};
const clampNum = (n: unknown, lo: number, hi: number): number | null => {
  const v = Number(n);
  return Number.isFinite(v) && v >= lo ? Math.min(v, hi) : null;
};

/** Extract the first {...} JSON object from the model's text, leniently. */
function parseObject(text: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const blank = (): Extracted => ({
  intent: "none",
  propertyName: null,
  city: null,
  type: null,
  checkIn: null,
  checkOut: null,
  rooms: null,
  guests: null,
  minPrice: null,
  maxPrice: null,
  amenities: [],
  sort: null,
});

async function extract(question: string, history: ChatTurn[]): Promise<Extracted> {
  const today = dayFromNow(0);
  const convo =
    history.length > 0
      ? "Recent conversation:\n" +
        history
          .slice(-4)
          .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
          .join("\n") +
        "\n\n"
      : "";
  let raw: string;
  try {
    raw = await generate({
      system: SYSTEM_EXTRACT,
      user: `Today's date: ${today}.\n\n${convo}Request: ${question}\n\nJSON:`,
    });
  } catch {
    return blank();
  }
  const o = parseObject(raw);
  if (!o) return blank();
  const intent =
    o.intent === "search" || o.intent === "detail" ? o.intent : "none";
  if (intent === "none") return blank();

  const type =
    o.type === "hotel" || o.type === "resort" || o.type === "rent"
      ? (o.type as PropertyType)
      : null;
  const sort =
    o.sort === "price_asc" || o.sort === "price_desc" || o.sort === "rating"
      ? (o.sort as Extracted["sort"])
      : null;

  // Dates: both valid, future, within the booking window, sane length — else
  // dropped, and the search runs without an availability check.
  const maxStart = addMonths(today, BOOKING_WINDOW_MONTHS);
  let checkIn = typeof o.checkIn === "string" && parseDay(o.checkIn) ? o.checkIn : null;
  let checkOut = typeof o.checkOut === "string" && parseDay(o.checkOut) ? o.checkOut : null;
  if (checkIn && checkOut) {
    const nights = nightsBetween(checkIn, checkOut);
    if (!(checkIn >= today && checkIn <= maxStart && nights >= 1 && nights <= MAX_STAY_NIGHTS)) {
      checkIn = null;
      checkOut = null;
    }
  } else {
    checkIn = null;
    checkOut = null;
  }

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null;
  const amenities = Array.isArray(o.amenities)
    ? o.amenities
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim().slice(0, 40))
        .slice(0, 6)
    : [];

  return {
    intent,
    propertyName: str(o.propertyName),
    city: str(o.city),
    type,
    checkIn,
    checkOut,
    // Floor of 1, not 0: the extractor tends to emit 0 for "unspecified", and a
    // $0 ceiling would exclude every property (price <= 0 matches nothing).
    rooms: clampInt(o.rooms, 1, 20),
    guests: clampInt(o.guests, 1, 50),
    minPrice: clampNum(o.minPrice, 1, 100000),
    maxPrice: clampNum(o.maxPrice, 1, 100000),
    amenities,
    sort,
  };
}

/* ------------------------------- detail ---------------------------------- */

/** Full write-up of one named property. searchVillas finds it by name (so a
 *  detail lookup uses the same matching /search does); getVillaById fills in the
 *  description, facilities, priced services and rating, and getPackagesForVilla
 *  adds any bundles. When a name matches several distinct listings (MyVilla has
 *  a "The Bund" villa, hotel AND resort), they're listed for the guest to pick
 *  rather than guessing one. Not owner-excluded — an owner may ask about theirs. */
async function propertyDetail(name: string): Promise<string> {
  const matches = await searchVillas({ q: name });
  if (matches.length === 0) {
    return `No property named "${name}" was found. It may be spelled differently, or not listed.`;
  }
  // Prefer an exact name match; a name can repeat across kinds, so keep all of
  // those to disambiguate.
  const lname = name.toLowerCase();
  const exact = matches.filter((v) => v.name.toLowerCase() === lname);
  const pool = exact.length > 0 ? exact : matches;

  if (pool.length > 1) {
    const lines = pool
      .slice(0, 6)
      .map((v) => `- ${v.name}, ${v.city} — ${v.kind} · $${v.price}/night`);
    return `Several properties match "${name}" — ask the user which one:\n${lines.join("\n")}`;
  }

  const v = await getVillaById(pool[0].id);
  if (!v) return `No property named "${name}" was found.`;

  const facilities: string[] = (() => {
    try {
      const a = JSON.parse(v.facilities);
      return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();
  const paidServices = parseServiceList(v.services).filter((s) => s.price > 0);
  const packages = await getPackagesForVilla(v.id);
  const roomBased = isRoomBased(v.kind);

  const lines: string[] = [
    `${v.name}, ${v.city} — ${v.kind}`,
    `$${v.price}/night${v.discount > 0 ? ` (${v.discount}% off)` : ""} · ${
      roomBased ? `${v.rooms} rooms` : "whole property"
    } · sleeps up to ${v.max_guests} · ${
      v.reviews > 0 ? `${v.rating}★ (${v.reviews} reviews)` : "no reviews yet"
    }`,
  ];
  if (v.description) lines.push(`About: ${v.description.slice(0, 400)}`);
  if (facilities.length) lines.push(`Facilities (included): ${facilities.join(", ")}`);
  if (paidServices.length)
    lines.push(
      `Extra services: ${paidServices
        .map((s) => `${s.name} ($${s.price.toFixed(2)})`)
        .join(", ")}`,
    );
  if (packages.length)
    lines.push(
      `Packages: ${packages
        .map(
          (p) =>
            `${p.name} (${p.nights} night${p.nights === 1 ? "" : "s"}, up to ${
              p.maxGuests
            } guests, $${p.price.toFixed(2)} all-inclusive)`,
        )
        .join("; ")}`,
    );
  return `Property details:\n${lines.join("\n")}`;
}

/* ------------------------------- search ---------------------------------- */

function resultLine(v: CatalogVilla, params: Extracted, nights: number): string {
  const roomBased = isRoomBased(v.kind);
  const rooms = roomBased ? Math.max(1, params.rooms ?? 1) : 1;
  const bits = [`${v.name}, ${v.city} (${v.kind})`, `$${v.price}/night`];
  if (v.discount > 0) bits.push(`${v.discount}% off`);
  if (nights > 0) {
    const q = quote(v.price * rooms, nights, v.discount);
    const roomLabel = roomBased ? `${rooms} room${rooms === 1 ? "" : "s"} × ` : "";
    bits.push(`${roomLabel}${nights} night${nights === 1 ? "" : "s"} → ~$${q.total.toFixed(2)} total`);
  }
  if (v.reviews > 0) bits.push(`${v.rating}★`);
  return "- " + bits.join(" · ");
}

async function runSearch(params: Extracted, userId: number): Promise<string> {
  const filters: SearchFilterInput = {
    q: params.city ?? undefined,
    type: params.type ?? undefined,
    min: params.minPrice ?? undefined,
    max: params.maxPrice ?? undefined,
    guests: params.guests ?? undefined,
    amenities: params.amenities.length ? params.amenities : undefined,
    sort: params.sort ?? undefined,
    excludeOwnerId: userId, // never surface the user's own place as a result
  };

  let results = await searchVillas(filters);
  const nights =
    params.checkIn && params.checkOut ? nightsBetween(params.checkIn, params.checkOut) : 0;

  // With dates, keep only what's free for the whole stay at the wanted room
  // count — the same availability gate the search page applies.
  if (params.checkIn && params.checkOut) {
    const roomsFor = (v: CatalogVilla) =>
      isRoomBased(v.kind) ? Math.max(1, params.rooms ?? 1) : 1;
    const avail = await Promise.all(
      results.map((v) =>
        isVillaAvailable(v.id, params.checkIn!, params.checkOut!, roomsFor(v)),
      ),
    );
    results = results.filter((_, i) => avail[i]);
  }

  const criteria = [
    params.type ? (params.type === "rent" ? "villas/rentals" : params.type + "s") : "places",
    params.city ? `in ${params.city}` : null,
    params.amenities.length ? `with ${params.amenities.join(" + ")}` : null,
    params.checkIn && params.checkOut
      ? `free ${formatDay(params.checkIn)}–${formatDay(params.checkOut)}`
      : null,
    params.guests ? `for ${params.guests} guest${params.guests === 1 ? "" : "s"}` : null,
    params.rooms ? `${params.rooms} room${params.rooms === 1 ? "" : "s"}` : null,
    params.maxPrice ? `under $${params.maxPrice}/night` : null,
    params.minPrice ? `over $${params.minPrice}/night` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (results.length === 0) {
    return `Search — ${criteria}: no matching properties${
      params.checkIn ? " were free for those dates" : ""
    }.`;
  }
  const lines = results.slice(0, MAX_RESULTS).map((v) => resultLine(v, params, nights));
  const more =
    results.length > MAX_RESULTS ? `\n(…and ${results.length - MAX_RESULTS} more.)` : "";
  return `Search results — ${criteria} (${results.length} match${
    results.length === 1 ? "" : "es"
  }):\n${lines.join("\n")}${more}`;
}

/**
 * The one entry point the graph calls. Gates cheaply, extracts intent + params
 * with one LLM call, then either pulls up a named property's details or runs a
 * filtered search — returning a text block for the prompt, or null when it isn't
 * a catalog question at all (so the turn is answered from docs/personal data).
 */
export async function catalogSearch(
  question: string,
  userId: number,
  history: ChatTurn[] = [],
): Promise<string | null> {
  const gateText = [...history.slice(-2).map((t) => t.content), question].join(" ");
  if (!hasSearchSignal(gateText)) return null;
  const params = await extract(question, history);
  try {
    if (params.intent === "detail" && params.propertyName) {
      return await propertyDetail(params.propertyName);
    }
    if (params.intent === "search") {
      return await runSearch(params, userId);
    }
    return null;
  } catch {
    return null; // a catalog failure shouldn't sink the whole answer
  }
}
