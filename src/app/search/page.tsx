import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import SearchFilters from "@/components/search/SearchFilters";
import FavoriteButton from "@/components/site/FavoriteButton";
import { getCurrentUser } from "@/lib/session";
import {
  getAvailableAmenities,
  getFavoriteVillaIds,
  getMaxVillaGuests,
  isVillaAvailable,
  parsePropertyType,
  searchVillas,
  type CatalogVilla,
  type SearchFilterInput,
} from "@/lib/queries";
import { formatDay, nightsBetween, parseDay } from "@/lib/dates";

const TYPE_LABELS = {
  resort: "resorts",
  hotel: "hotels",
  rent: "villas for rent",
} as const;

export const metadata: Metadata = {
  title: "Search",
  description: "Search villas, hotels and resorts on MyVilla.",
};

/* eslint-disable @next/next/no-img-element */

type Result = CatalogVilla;

// Describe the availability count by the real property mix rather than always
// saying "villas" — e.g. "1 hotel and 3 villas" when a hotel is in the results.
// Matches how searchVillas groups kinds: Resort, Hotel, everything else = villa.
function availabilityLabel(results: Result[]): string {
  const counts = { villa: 0, resort: 0, hotel: 0 };
  for (const r of results) {
    if (r.kind === "Resort") counts.resort++;
    else if (r.kind === "Hotel") counts.hotel++;
    else counts.villa++;
  }
  const parts: string[] = [];
  const add = (n: number, noun: string) => {
    if (n > 0) parts.push(`${n} ${noun}${n === 1 ? "" : "s"}`);
  };
  add(counts.villa, "villa");
  add(counts.resort, "resort");
  add(counts.hotel, "hotel");
  if (parts.length <= 1) return parts[0] ?? "0 villas";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function AmenityChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-[#e9e8fd] px-2.5 py-1 text-[10px] text-brand">
      {children}
    </span>
  );
}

function ResultCard({
  result,
  liked,
  authed,
  datesQuery,
  fromQuery,
}: {
  result: Result;
  liked: boolean;
  authed: boolean;
  datesQuery: string;
  fromQuery: string;
}) {
  const placeHref = `/place?id=${result.id}${datesQuery}${fromQuery}`;
  const discount = result.discount ?? 0;
  const discounted = Math.round(result.price * (1 - discount / 100));
  return (
    <article className="relative flex overflow-hidden rounded-[10px] bg-white shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)]">
      <div className="relative h-auto w-[150px] shrink-0 sm:w-[190px]">
        <Image
          src={result.image}
          alt={`${result.name}, ${result.city}`}
          fill
          sizes="190px"
          className="object-cover"
        />
        {discount > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#eb5757] px-2 py-0.5 text-[10px] font-semibold text-white">
            {discount}% OFF
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-5 py-4">
        <h3 className="truncate text-[18px] font-semibold leading-[1.3] text-[#121212]">
          {/* Stretched link: the ::after overlay makes the whole card clickable */}
          <Link href={placeHref} className="after:absolute after:inset-0">
            {result.name}, <span className="text-purple">{result.city}</span>
          </Link>
        </h3>
        <p className="mt-1 text-[12px] text-gray">{result.kind}</p>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-purple">
          <img src="/icons/star-filled.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" />
          {result.reviews > 0 ? `${result.rating} (${result.reviews})` : "New listing"}
        </p>
        {result.freeServices.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {result.freeServices.slice(0, 3).map((name) => (
              <AmenityChip key={name}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {name}
              </AmenityChip>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end px-5 py-4">
        <div className="flex items-center gap-2">
          {discount > 0 ? (
            <p className="text-[14px] font-semibold text-[#121212]">
              ${discounted}
              <span className="ml-1 text-[11px] font-normal text-gray line-through">
                ${result.price}
              </span>
              <span className="font-normal">/night</span>
            </p>
          ) : (
            <p className="text-[14px] font-semibold text-[#121212]">
              ${result.price}/night
            </p>
          )}
          {/* Above the stretched link so the heart stays clickable on its own */}
          <span className="relative z-10">
            <FavoriteButton
              villaId={result.id}
              initialLiked={liked}
              authed={authed}
              variant="bare"
            />
          </span>
        </div>
      </div>
    </article>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const num = (v: string | string[] | undefined) => {
    const n = Number(one(v));
    return Number.isFinite(n) && one(v) !== "" && one(v) != null ? n : undefined;
  };

  const user = await getCurrentUser();
  const sortParam = one(params.sort);
  // Guest count: filters results to places that sleep at least this many, and
  // carries through to the villa's booking card.
  const guestsRaw = Number(one(params.guests));
  const guests =
    Number.isInteger(guestsRaw) && guestsRaw >= 1 && guestsRaw <= 30
      ? guestsRaw
      : undefined;
  const filters: SearchFilterInput = {
    q: one(params.q)?.trim() || undefined,
    min: num(params.min),
    max: num(params.max),
    rating: num(params.rating),
    amenities: (one(params.amenities) ?? "").split(",").filter(Boolean),
    guests,
    sort:
      sortParam === "price_asc" ||
      sortParam === "price_desc" ||
      sortParam === "rating"
        ? sortParam
        : "newest",
    type: parsePropertyType(one(params.type)),
    excludeOwnerId: user?.id,
  };

  // Stay dates from the home hero (?checkin=YYYY-MM-DD&checkout=…) narrow the
  // results to villas actually free for that range.
  const checkInRaw = one(params.checkin);
  const checkOutRaw = one(params.checkout);
  const hasDates = !!(
    parseDay(checkInRaw) &&
    parseDay(checkOutRaw) &&
    nightsBetween(checkInRaw!, checkOutRaw!) >= 1
  );
  const checkIn = hasDates ? checkInRaw! : undefined;
  const checkOut = hasDates ? checkOutRaw! : undefined;

  const favorites = user ? await getFavoriteVillaIds(user.id) : new Set<number>();
  let results = await searchVillas(filters);
  if (checkIn && checkOut) {
    const avail = await Promise.all(
      results.map((v) => isVillaAvailable(v.id, checkIn, checkOut)),
    );
    results = results.filter((_, i) => avail[i]);
  }

  // Villa links keep the chosen dates + guests so the booking card prefills.
  const datesQuery =
    (checkIn ? `&in=${checkIn}&out=${checkOut}` : "") +
    (guests ? `&guests=${guests}` : "");
  // …and carry the full current search URL so a result's villa page can send
  // the guest back to THESE filtered results via its breadcrumb (browser-back
  // already preserves them; this fixes the in-page "Search" link).
  const searchQs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    if (v) searchQs.set(key, v);
  }
  const fromQuery = searchQs.size
    ? `&from=${encodeURIComponent(`/search?${searchQs.toString()}`)}`
    : "";
  const clearParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    if (v && key !== "checkin" && key !== "checkout") clearParams.set(key, v);
  }
  const clearDatesHref = `/search${clearParams.size ? "?" + clearParams.toString() : ""}`;

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        {/* Hero band */}
        <div className="relative h-[286px] w-full overflow-hidden">
          <Image
            src="/images/search-hero.jpg"
            alt="Beach loungers under palm trees"
            fill
            priority
            sizes="100vw"
            className="object-cover [object-position:50%_60%]"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <p className="absolute inset-x-0 top-[190px] text-center text-[28px] font-semibold leading-[1.3] text-white">
            {filters.q || filters.type
              ? `Showing ${results.length} ${
                  filters.type
                    ? TYPE_LABELS[filters.type]
                    : `result${results.length === 1 ? "" : "s"}`
                }${filters.q ? ` for “${filters.q}”` : ""}`
              : "Showing results for better experiences"}
          </p>
        </div>

        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>Search</span>
          </nav>

          <div className="mt-[30px] flex flex-col gap-10 lg:flex-row lg:gap-[90px]">
            {/* Left rail */}
            <div className="w-full shrink-0 lg:w-[440px]">
              <SearchFilters
                maxGuests={await getMaxVillaGuests()}
                amenities={await getAvailableAmenities(user?.id)}
              />

              <div className="mt-[55px] space-y-[15px]">
                <Link href="#" className="group relative block h-[150px] overflow-hidden rounded-[10px]">
                  <Image
                    src="/images/promo-discount-v2.jpg"
                    alt=""
                    fill
                    sizes="440px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 rounded-[10px] bg-black/40 mix-blend-multiply" />
                  <h3 className="absolute bottom-[18px] left-5 text-[24px] font-semibold leading-[1.1] text-white">
                    Upto 25% off on your
                    <br />
                    first purchase
                  </h3>
                </Link>
                <Link href="#" className="group relative block h-[150px] overflow-hidden rounded-[10px]">
                  <Image
                    src="/images/promo-friends-v2.jpg"
                    alt=""
                    fill
                    sizes="440px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 rounded-[10px] bg-black/40 mix-blend-multiply" />
                  <h3 className="absolute bottom-[18px] left-5 text-[24px] font-semibold leading-[1.1] text-white">
                    Invite your friends to
                    <br />
                    get discounts
                  </h3>
                </Link>
              </div>
            </div>

            {/* Results */}
            <div className="min-w-0 flex-1">
              {checkIn && checkOut && (
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] bg-white px-5 py-3.5 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5FEF" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                    <rect x="3.5" y="5" width="17" height="15" rx="1.8" />
                    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                  </svg>
                  <p className="text-[14px] text-[#121212]">
                    Available{" "}
                    <span className="font-semibold">
                      {formatDay(checkIn)} – {formatDay(checkOut)}
                    </span>{" "}
                    ({nightsBetween(checkIn, checkOut)} night
                    {nightsBetween(checkIn, checkOut) === 1 ? "" : "s"}) ·{" "}
                    {availabilityLabel(results)} free
                  </p>
                  <Link
                    href={clearDatesHref}
                    className="ml-auto text-[13px] text-[#eb5757] underline hover:opacity-80"
                  >
                    Clear dates
                  </Link>
                </div>
              )}
              {results.length === 0 ? (
                <div className="rounded-[10px] bg-white px-6 py-16 text-center shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)]">
                  <p className="text-[18px] font-semibold text-[#121212]">
                    {checkIn
                      ? "No villas are free for those dates."
                      : "No villas match your search."}
                  </p>
                  <p className="mt-2 text-[14px] text-gray">
                    {checkIn
                      ? "Try different dates or clear them to see all villas."
                      : "Try clearing some filters or searching for a different city."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-[27px]">
                  {results.map((r) => (
                    <li key={r.id}>
                      <ResultCard
                        result={r}
                        liked={favorites.has(r.id)}
                        authed={user !== null}
                        datesQuery={datesQuery}
                        fromQuery={fromQuery}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
