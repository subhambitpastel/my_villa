"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DateRangeField from "@/components/home/DateRangeField";

// Matches the facility chips hosts pick in the wizard, so filters hit real data.
const AMENITIES = [
  "Wifi",
  "Free Parking",
  "Air Conditioner",
  "Long Stays",
  "Smoke Alarm",
  "Swimming Pool",
  "Jaccuzzi",
  "BBQ Corner",
  "TV",
];

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

// Mirrors the hero's Resort / Hotels / Rent tabs on the home page.
const PROPERTY_TYPES = [
  { value: "resort", label: "Resorts" },
  { value: "hotel", label: "Hotels" },
  { value: "rent", label: "Rent" },
];

// Slider domain; an empty field means unbounded ("$ 1,000+" per the design).
const PRICE_MIN = 0;
const PRICE_MAX = 1000;
const PRICE_STEP = 10;

function digitsToNumber(v: string): number | null {
  const digits = v.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
}

export default function SearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [min, setMin] = useState(searchParams.get("min") ?? "");
  const [max, setMax] = useState(searchParams.get("max") ?? "");
  const selected = (searchParams.get("amenities") ?? "")
    .split(",")
    .filter(Boolean);
  const rating = Number(searchParams.get("rating")) || null;
  const sort = searchParams.get("sort") ?? "newest";
  const type = searchParams.get("type");
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

  function toggleAmenity(a: string) {
    const next = selected.includes(a)
      ? selected.filter((x) => x !== a)
      : [...selected, a];
    apply({ amenities: next.join(",") || null });
  }

  function applyPrices() {
    const clean = (v: string) => v.replace(/[^\d]/g, "");
    apply({ min: clean(min) || null, max: clean(max) || null });
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
          <h2 className="text-[20px] font-semibold text-[#121212]">Filters</h2>
          <label className="flex items-center gap-1 rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]">
            <span className="sr-only">Sort results</span>
            <select
              value={sort}
              onChange={(e) =>
                apply({ sort: e.target.value === "newest" ? null : e.target.value })
              }
              className="cursor-pointer appearance-none bg-transparent pr-4 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" className="-ml-3 pointer-events-none">
              <path d="M1 1l3.5 3.5L8 1" stroke="#4a4a4a" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </label>
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
              onChange={(e) => setMin(e.target.value)}
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
              onChange={(e) => setMax(e.target.value)}
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
            checkIn={dateIn || null}
            checkOut={dateOut || null}
            onChange={changeDates}
          />
        </div>
        <p className="mt-2 text-[11px] text-[#8a8a94]">
          Pick both dates to show only villas free for that stay.
        </p>

        <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Property type</h3>
        <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => apply({ type: type === t.value ? null : t.value })}
              aria-pressed={type === t.value}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                type === t.value
                  ? "bg-brand text-white"
                  : "bg-[#e9e8fd] text-brand hover:bg-brand/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-[16px] font-medium text-[#121212]">Amenities</h3>
        <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
          {AMENITIES.map((a) => (
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
