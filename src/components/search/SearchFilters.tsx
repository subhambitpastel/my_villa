"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DateRangeField from "@/components/home/DateRangeField";
import Dropdown from "@/components/ui/Dropdown";
import { BOOKING_WINDOW_MONTHS, MAX_STAY_NIGHTS } from "@/lib/dates";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

// Mirrors the hero's Resort / Hotels / Rent tabs on the home page, plus an
// "All types" option (empty value = no `type` filter) so a guest can see every
// property regardless of whether it's a villa rental, resort or hotel.
const PROPERTY_TYPES = [
  { value: "", label: "All types" },
  { value: "resort", label: "Resorts" },
  { value: "hotel", label: "Hotels" },
  { value: "rent", label: "Rent" },
];

// Slider domain; an empty field means unbounded ("$ 1,000+" per the design).
const PRICE_MIN = 0;
const PRICE_MAX = 1000;
const PRICE_STEP = 10;

// What the price boxes accept. The slider only spans PRICE_MIN..PRICE_MAX (its
// top thumb reads as "1,000+"), but a guest can type a figure past that — so
// bound it here, otherwise the field takes any number at all.
const PRICE_FIELD_MIN = 1;
const PRICE_FIELD_MAX = 30_000;

function digitsToNumber(v: string): number | null {
  const digits = v.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
}

/** Digits only, held at or below the ceiling — run as the guest types so the box
 *  can never show a runaway figure. The floor waits for blur: typing "1" on the
 *  way to "10" shouldn't fight the guest mid-keystroke. */
function capPriceInput(v: string): string {
  const n = digitsToNumber(v);
  return n === null ? "" : String(Math.min(n, PRICE_FIELD_MAX));
}

/** The figure to actually filter on: empty stays unbounded, anything else is
 *  pinned inside [PRICE_FIELD_MIN, PRICE_FIELD_MAX]. */
function boundPrice(v: string): string | null {
  const n = digitsToNumber(v);
  if (n === null) return null;
  return String(Math.min(Math.max(n, PRICE_FIELD_MIN), PRICE_FIELD_MAX));
}

export default function SearchFilters({
  maxGuests,
  amenities = [],
}: {
  maxGuests: number;
  /** Facility chips at least one listed property offers — derived server-side so
   *  every amenity shown can actually return a result. */
  amenities?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  // Capped on the way in too, so a hand-typed ?max=999999 can't seed the box
  // with a figure the guest could never have entered.
  const [min, setMin] = useState(capPriceInput(searchParams.get("min") ?? ""));
  const [max, setMax] = useState(capPriceInput(searchParams.get("max") ?? ""));
  const selected = (searchParams.get("amenities") ?? "")
    .split(",")
    .filter(Boolean);
  const rating = Number(searchParams.get("rating")) || null;
  const sort = searchParams.get("sort") ?? "newest";
  const type = searchParams.get("type");
  const guests = Number(searchParams.get("guests")) || 0;
  // Options scale to the biggest place listed (floor 8, cap 30) — same as the
  // home hero's guest picker.
  const guestCap = Math.min(30, Math.max(8, maxGuests));
  const [dateIn, setDateIn] = useState(searchParams.get("checkin") ?? "");
  const [dateOut, setDateOut] = useState(searchParams.get("checkout") ?? "");

  // Dates can also change from outside this panel (hero handoff, the results
  // header's "Clear dates" link) — reconcile the inputs whenever the URL's
  // date pair changes (derive-from-props pattern, no effect needed).
  const urlDates =
    (searchParams.get("checkin") ?? "") + "|" + (searchParams.get("checkout") ?? "");
  const [prevUrlDates, setPrevUrlDates] = useState(urlDates);
  if (prevUrlDates !== urlDates) {
    setPrevUrlDates(urlDates);
    setDateIn(searchParams.get("checkin") ?? "");
    setDateOut(searchParams.get("checkout") ?? "");
  }

  // Latest params for callbacks that may fire from a stale render (debounce timer).
  const paramsRef = useRef(searchParams);
  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // A changed filter replaces the results — start reading them from the
    // first card, not from wherever the guest had scrolled to in the OLD
    // list. Smooth (and ours, not the router's instant jump) so it reads as
    // "the list moved", not "the page blinked".
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Live filtering: push q/min/max into the URL shortly after the user stops
  // typing or dragging. Deps are the local inputs only — reacting to
  // searchParams here would fight browser back/forward navigation.
  useEffect(() => {
    const timer = setTimeout(() => {
      const clean = (v: string) => v.replace(/[^\d]/g, "");
      const params = paramsRef.current;
      const patch: Record<string, string | null> = {};
      if (query.trim() !== (params.get("q") ?? "")) patch.q = query.trim() || null;
      if (clean(min) !== (params.get("min") ?? "")) patch.min = clean(min) || null;
      if (clean(max) !== (params.get("max") ?? "")) patch.max = clean(max) || null;
      if (Object.keys(patch).length > 0) apply(patch);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, min, max]);

  // Push a complete, ordered pair into the URL; a half-picked pair clears the
  // params so stale dates never keep filtering the results.
  function changeDates(nextIn: string | null, nextOut: string | null) {
    setDateIn(nextIn ?? "");
    setDateOut(nextOut ?? "");
    const complete = !!(nextIn && nextOut && nextOut > nextIn);
    apply({
      checkin: complete ? nextIn : null,
      checkout: complete ? nextOut : null,
    });
  }

  function clearDates() {
    changeDates(null, null);
  }

  // Any filter, sort, date or query in the URL means there's something to clear.
  const hasActiveFilters = searchParams.toString().length > 0;

  function clearAll() {
    setQuery("");
    setMin("");
    setMax("");
    setDateIn("");
    setDateOut("");
    // Drop every query param — the derived values (amenities, rating, sort,
    // type, guests) all read from searchParams, so they reset automatically.
    router.replace(pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleAmenity(a: string) {
    const next = selected.includes(a)
      ? selected.filter((x) => x !== a)
      : [...selected, a];
    apply({ amenities: next.join(",") || null });
  }

  function applyPrices() {
    const nextMin = boundPrice(min);
    const nextMax = boundPrice(max);
    // Show what's being filtered on: if a figure got pinned to the floor or the
    // ceiling, the box updates to match rather than lying about the filter.
    setMin(nextMin ?? "");
    setMax(nextMax ?? "");
    apply({ min: nextMin, max: nextMax });
  }

  const clampPrice = (n: number) =>
    Math.min(Math.max(n, PRICE_MIN), PRICE_MAX);
  const minVal = clampPrice(digitsToNumber(min) ?? PRICE_MIN);
  const maxVal = clampPrice(digitsToNumber(max) ?? PRICE_MAX);

  function slideMin(value: number) {
    const v = Math.min(value, maxVal - PRICE_STEP);
    setMin(v <= PRICE_MIN ? "" : String(v));
  }

  function slideMax(value: number) {
    const v = Math.max(value, minVal + PRICE_STEP);
    setMax(v >= PRICE_MAX ? "" : String(v));
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: query.trim() || null });
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search villas"
          className="h-[46px] w-full rounded-full bg-[#e4e4e7] px-6 text-[14px] text-[#121212] placeholder:text-[#6f6f78] focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </form>

      <div className="mt-[35px] rounded-[10px] bg-white p-6 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[20px] font-semibold text-[#121212]">Filters</h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[12px] text-[#eb5757] underline hover:opacity-80"
              >
                Clear all
              </button>
            )}
          </div>
          <Dropdown
            ariaLabel="Sort results"
            value={sort}
            onChange={(v) => apply({ sort: v === "newest" ? null : v })}
            options={SORTS}
            formatLabel={(o) => `Sort: ${o.label}`}
            align="right"
            buttonClassName="flex items-center rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]"
          />
        </div>
        <hr className="mt-4 border-t border-[#e3e3e8]" />

        <h3 className="mt-5 text-[16px] font-medium text-[#121212]">Price</h3>
        {/* Dual-thumb range; the text inputs below share the same state */}
        <div className="relative mt-4 h-[6px] rounded-full bg-[#e4e4e7]">
          <div
            className="absolute top-0 h-[6px] rounded-full bg-brand/60"
            style={{
              left: `${(minVal / PRICE_MAX) * 100}%`,
              right: `${100 - (maxVal / PRICE_MAX) * 100}%`,
            }}
          />
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={minVal}
            onChange={(e) => slideMin(Number(e.target.value))}
            onPointerUp={applyPrices}
            onKeyUp={applyPrices}
            aria-label="Minimum price"
            className="range-brand absolute left-0 right-0 top-1/2 h-3.5 -translate-y-1/2"
            style={{ zIndex: minVal > PRICE_MAX - 100 ? 30 : 10 }}
          />
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={maxVal}
            onChange={(e) => slideMax(Number(e.target.value))}
            onPointerUp={applyPrices}
            onKeyUp={applyPrices}
            aria-label="Maximum price"
            className="range-brand absolute left-0 right-0 top-1/2 z-20 h-3.5 -translate-y-1/2"
          />
        </div>
        <form
          className="mt-5 flex items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrices();
          }}
        >
          <label className="flex-1 rounded-[6px] border border-[#c9c9d4] px-3 py-1.5">
            <span className="block text-[10px] text-[#8a8a94]">minimum price</span>
            <input
              type="text"
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(capPriceInput(e.target.value))}
              onBlur={applyPrices}
              placeholder="$ 10"
              aria-label="Minimum price"
              className="w-full bg-transparent text-[13px] text-[#121212] focus:outline-none"
            />
          </label>
          <span aria-hidden className="h-px w-3 bg-[#8a8a94]" />
          <label className="flex-1 rounded-[6px] border border-[#c9c9d4] px-3 py-1.5">
            <span className="block text-[10px] text-[#8a8a94]">maximum price</span>
            <input
              type="text"
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(capPriceInput(e.target.value))}
              onBlur={applyPrices}
              placeholder="$ 1,000+"
              aria-label="Maximum price"
              className="w-full bg-transparent text-[13px] text-[#121212] focus:outline-none"
            />
          </label>
          <button type="submit" className="sr-only">
            Apply price
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-medium text-[#121212]">Dates</h3>
          {(dateIn || dateOut) && (
            <button
              type="button"
              onClick={clearDates}
              className="text-[12px] text-[#eb5757] underline hover:opacity-80"
            >
              Clear dates
            </button>
          )}
        </div>
        <div className="mt-3">
          <DateRangeField
            variant="compact"
            windowMonths={BOOKING_WINDOW_MONTHS}
            maxNights={MAX_STAY_NIGHTS}
            checkIn={dateIn || null}
            checkOut={dateOut || null}
            onChange={changeDates}
          />
        </div>
        <p className="mt-2 text-[11px] text-[#8a8a94]">
          Pick both dates to show only villas free for that stay.
        </p>

        <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Guests</h3>
        <div className="mt-3">
          <Dropdown
            ariaLabel="Minimum number of guests"
            value={guests ? String(guests) : ""}
            onChange={(v) => apply({ guests: v || null })}
            options={[
              { value: "", label: "Any number of guests" },
              ...Array.from({ length: guestCap }, (_, i) => i + 1).map((n) => ({
                value: String(n),
                label: `${n} guest${n === 1 ? "" : "s"} or more`,
              })),
            ]}
            buttonClassName="flex w-full items-center justify-between rounded-[6px] border border-[#c9c9d4] bg-white px-3 py-2 text-[13px] text-[#121212] focus:border-brand focus:outline-none"
          />
        </div>

        <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Property type</h3>
        <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
          {PROPERTY_TYPES.map((t) => {
            // "All types" (empty value) is active when no `type` is set and
            // clears the filter; a specific type selects that kind.
            const active = t.value ? type === t.value : !type;
            return (
              <button
                key={t.value || "all"}
                type="button"
                onClick={() => apply({ type: t.value || null })}
                aria-pressed={active}
                className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "bg-[#e9e8fd] text-brand hover:bg-brand/20"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {amenities.length > 0 && (
          <>
            <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Amenities</h3>
            <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
              {amenities.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  aria-pressed={selected.includes(a)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                    selected.includes(a)
                      ? "bg-brand text-white"
                      : "bg-[#e9e8fd] text-brand hover:bg-brand/20"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Rating</h3>
        <div className="mt-3 flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => apply({ rating: rating === n ? null : String(n) })}
              aria-pressed={rating === n}
              aria-label={`${n} star rating`}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors ${
                rating === n
                  ? "bg-brand text-white"
                  : "bg-[#e9e8fd] text-brand hover:bg-brand/20"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
