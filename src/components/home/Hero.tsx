"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import LocationField from "./LocationField";
import DateRangeField from "./DateRangeField";
import type { PropertyType } from "@/lib/queries";

const TABS = [
  { label: "Resort", type: "resort" },
  { label: "Hotels", type: "hotel" },
  { label: "Rent", type: "rent" },
] as const;

const SLIDES = [
  {
    src: "/images/hero-beach.jpg",
    alt: "Beach lined with palm trees",
    position: "object-bottom",
  },
  {
    src: "/images/search-hero.jpg",
    alt: "Beach loungers under palm trees",
    position: "object-center",
  },
  {
    src: "/images/promo-resorts-v2.jpg",
    alt: "Resort pool at dusk",
    position: "object-center",
  },
  {
    src: "/images/about-hero.jpg",
    alt: "Villa terrace with an ocean view",
    position: "object-center",
  },
  {
    src: "/images/unique-mongolia.jpg",
    alt: "Traditional yurts in a green valley",
    position: "object-center",
  },
];

const SLIDE_INTERVAL_MS = 5000;

function FieldChevron() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/chevron-down.svg"
      alt=""
      width={32}
      height={32}
      className="pointer-events-none -ml-8 h-8 w-8 shrink-0"
    />
  );
}

export default function Hero({
  cities,
  tab,
  onTabChange,
  maxGuests,
}: {
  cities: string[];
  tab: PropertyType;
  onTabChange: (tab: PropertyType) => void;
  /** Largest capacity for the current tab (already capped for sanity) — the
   *  guest picker runs 1..maxGuests so its top option always returns a result. */
  maxGuests: number;
}) {
  const guestCap = Math.max(1, maxGuests);
  const guestOptions = Array.from({ length: guestCap }, (_, i) => i + 1);
  const [guestSel, setGuestSel] = useState(1);
  // Clamp to the current tab's cap so switching to a tab with smaller places
  // never leaves a stale, no-result guest count selected.
  const guests = Math.min(guestSel, guestCap);
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const router = useRouter();

  // Auto-advance; the timer restarts whenever the slide changes (including
  // manual dot clicks) and holds still while the pointer is over the hero.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => setSlide((s) => (s + 1) % SLIDES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [slide, paused]);

  return (
    <section className="relative lg:h-[804px]">
      {/* Background carousel + dark overlay */}
      <div
        className="relative h-[420px] overflow-hidden rounded-b-[15px] lg:absolute lg:inset-0 lg:h-auto"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {SLIDES.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={i === slide ? s.alt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            aria-hidden={i !== slide}
            className={`object-cover ${s.position} transition-opacity duration-1000 ${
              i === slide ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 rounded-b-[15px] bg-black/30" />

        {/* Carousel dots */}
        <div className="absolute bottom-[15px] left-1/2 hidden -translate-x-1/2 items-center gap-[5px] lg:flex">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === slide ? "true" : undefined}
              className={`h-[10px] rounded-full transition-all duration-300 ${
                i === slide
                  ? "w-[37px] bg-violet"
                  : "w-[10px] bg-[#e1e1e1] hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Headline */}
      <div className="absolute inset-x-0 top-16 px-6 text-center text-white lg:top-[180px]">
        <h1 className="text-4xl font-semibold sm:text-5xl lg:text-[72px] lg:leading-[80px]">
          Vacation feels like home
        </h1>
        <p className="mx-auto mt-3 max-w-[680px] text-base leading-relaxed text-white lg:mt-5 lg:text-[24px] lg:leading-[40px]">
          The most comfortable accommodation you can find in our website, spread
          all over the world
        </p>
      </div>

      {/* Search widget */}
      <div className="relative z-10 mx-auto -mt-24 w-full max-w-[1440px] px-6 lg:absolute lg:left-1/2 lg:top-[403px] lg:mt-0 lg:-translate-x-1/2">
        <div className="flex justify-center">
          <div className="flex rounded-t-[10px] bg-white px-4">
            {TABS.map((t) => (
              <div key={t.type} className="p-4">
                <button
                  type="button"
                  onClick={() => onTabChange(t.type)}
                  aria-pressed={tab === t.type}
                  className={`w-[100px] rounded-[8px] p-[10px] text-center text-[18px] transition-colors ${
                    tab === t.type
                      ? "bg-[rgba(123,97,255,0.3)] font-medium text-violet"
                      : "font-normal text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              </div>
            ))}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const params = new URLSearchParams();
            params.set("type", tab);
            const q = location.trim();
            if (q && q.toLowerCase() !== "anywhere") params.set("q", q);
            if (checkIn) params.set("checkin", checkIn);
            if (checkOut) params.set("checkout", checkOut);
            // Carry the chosen guest count through to search → villa → checkout.
            if (guests >= 1) params.set("guests", String(guests));
            router.push(`/search?${params.toString()}`);
          }}
          className="flex flex-col gap-6 rounded-[10px] bg-white p-8 drop-shadow-[0px_24px_25px_rgba(0,0,0,0.1)] lg:flex-row lg:items-center lg:justify-center"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-14">
            <LocationField
              cities={cities}
              value={location}
              onChange={setLocation}
            />

            <span className="hidden h-[60px] w-px bg-line lg:block" aria-hidden />

            <div className="flex flex-col gap-2">
              <span className="text-[18px] text-muted">Guest</span>
              <div className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/user.svg" alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
                <select
                  name="guests"
                  aria-label="Guest"
                  value={guests}
                  onChange={(e) => setGuestSel(Number(e.target.value))}
                  className="w-[150px] cursor-pointer appearance-none bg-transparent pl-2 pr-8 text-[18px] font-bold text-ink focus:outline-none"
                >
                  {guestOptions.map((n) => (
                    <option key={n} value={n}>
                      {n} Guest{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <FieldChevron />
              </div>
            </div>

            <span className="hidden h-[60px] w-px bg-line lg:block" aria-hidden />

            <DateRangeField
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(nextIn, nextOut) => {
                setCheckIn(nextIn);
                setCheckOut(nextOut);
              }}
            />
          </div>
          <button
            type="submit"
            className="h-16 w-full rounded-[10px] bg-brand text-[16px] leading-[1.3] text-white transition-colors hover:bg-brand-dark lg:w-40"
          >
            Search
          </button>
        </form>
      </div>
    </section>
  );
}
