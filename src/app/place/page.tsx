import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PlaceActions from "@/components/place/PlaceActions";
import BookingCard from "@/components/place/BookingCard";
import { getCurrentUser } from "@/lib/session";
import {
  getBookedRanges,
  getCatalogVillas,
  getFavoriteVillaIds,
  getVillaDetail,
  getVillaReviewDistribution,
  getVillaReviews,
  type VillaDetail,
} from "@/lib/queries";
import { dayFromNow, nightsBetween, parseDay } from "@/lib/dates";

/* eslint-disable @next/next/no-img-element */

type Search = {
  searchParams: Promise<{ id?: string; in?: string; out?: string; guests?: string }>;
};

function loadVilla(id: string | undefined): VillaDetail | null {
  const byId = id ? getVillaDetail(Number(id)) : null;
  if (byId) return byId;
  const first = getCatalogVillas(1)[0];
  return first ? getVillaDetail(first.id) : null;
}

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { id } = await searchParams;
  const villa = loadVilla(id);
  if (!villa) return { title: "Villa" };
  return {
    title: `${villa.name}, ${villa.city}`,
    description:
      villa.description ||
      `${villa.kind} in ${villa.city} — ${villa.rooms} rooms, ${villa.bathrooms} bathrooms.`,
  };
}

const FACILITY_ICONS: Record<string, { icon: string; w: number; h: number }> = {
  "Air Conditioner": { icon: "/icons/place/ac.svg", w: 54, h: 50 },
  "Long Stays": { icon: "/icons/place/calendar.svg", w: 48, h: 48 },
  TV: { icon: "/icons/place/tv.svg", w: 48, h: 53 },
  "Free Parking": { icon: "/icons/place/parking.svg", w: 61, h: 32 },
  "Smoke Alarm": { icon: "/icons/place/smoke.svg", w: 44, h: 44 },
  Wifi: { icon: "/icons/place/wifi.svg", w: 40, h: 31 },
};

const FALLBACK_DESCRIPTION =
  "Accommodation located three blocks from the main square, consisting of kitchen, patio, green area, living room, dining room, pets are acceptable. Due to the location of the house it is easy and close to have access to public parking.";

function Dot() {
  return <img src="/icons/place/dot.svg" alt="" width={27} height={27} className="h-[27px] w-[27px]" />;
}

function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-t border-[#c6c6c6] ${className}`} />;
}

function FacilityItem({ label }: { label: string }) {
  const known = FACILITY_ICONS[label];
  return (
    <li className="flex items-center gap-[15px] text-[20px] leading-[1.3] text-[#121212]">
      <span className="flex w-[61px] justify-start">
        {known ? (
          <img src={known.icon} alt="" width={known.w} height={known.h} />
        ) : (
          <Dot />
        )}
      </span>
      {label}
    </li>
  );
}

export default async function PlacePage({ searchParams }: Search) {
  const { id, in: inParam, out: outParam, guests: guestsParam } = await searchParams;
  const villa = loadVilla(id);
  const user = await getCurrentUser();
  const saved =
    user && villa ? getFavoriteVillaIds(user.id).has(villa.id) : false;

  // Dates carried over from search (or a package link) prefill the booking card.
  const carriedDates = !!(
    parseDay(inParam) &&
    parseDay(outParam) &&
    nightsBetween(inParam!, outParam!) >= 1 &&
    inParam! >= dayFromNow(0)
  );
  const defaultCheckIn = carriedDates ? inParam! : dayFromNow(7);
  const defaultCheckOut = carriedDates ? outParam! : dayFromNow(10);
  const carriedGuests = Number(guestsParam);
  const defaultGuests =
    Number.isInteger(carriedGuests) && carriedGuests >= 1 && carriedGuests <= 16
      ? carriedGuests
      : 2;

  if (!villa) {
    return (
      <>
        <Header />
        <main className="bg-[#fafafa] px-6 py-40 text-center">
          <h1 className="text-[28px] font-semibold text-black">
            This villa could not be found.
          </h1>
          <Link href="/search" className="mt-4 inline-block text-brand underline">
            Browse all villas
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const reviews = getVillaReviews(villa.id);
  const distribution = getVillaReviewDistribution(villa.id);
  const reviewRows = distribution.reduce((s, d) => s + d.count, 0);
  const gallery = villa.gallery;
  const sideImages = gallery.slice(1, 5);
  const leftFacilities = villa.facilityList.filter((_, i) => i % 2 === 0);
  const rightFacilities = villa.facilityList.filter((_, i) => i % 2 === 1);
  const joined = new Date(villa.hostJoined.replace(" ", "T") + "Z");
  const joinedLabel = joined.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{"  /  "}</span>
            <Link href="/search" className="underline">Search</Link>
            <span className="font-light">{" / "}</span>
            <span>{villa.name}</span>
          </nav>

          <h1 className="mt-[50px] text-[28px] font-semibold leading-[1.3] text-black">
            {villa.name}, {villa.city}
          </h1>

          <div className="mt-[7px] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-[27px] text-[20px] leading-[1.3] text-black">
              <span className="flex items-center">
                <img src="/icons/place/star-badge.svg" alt="" width={49} height={48} className="h-12 w-[49px]" />
                {villa.reviews > 0 ? villa.rating : "New"}
              </span>
              <span>{villa.reviews} Reviews</span>
            </div>
            <PlaceActions villaId={villa.id} initialSaved={saved} authed={user !== null} />
          </div>

          {/* Gallery — Figma: 950px hero + 2×2 of 300px tiles on a 1600px row.
              Widths are fr ratios so the whole gallery scales below 1648px. */}
          {sideImages.length > 0 ? (
            <div className="mt-[14px] grid grid-cols-2 gap-x-[26px] gap-y-[22px] lg:grid-cols-[950fr_301fr_301fr] lg:gap-x-6">
              <div className="relative col-span-2 h-72 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:col-span-1 lg:row-span-2 lg:aspect-[950/622] lg:h-auto">
                <Image
                  src={gallery[0]}
                  alt={`${villa.name} main photo`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, (max-width: 1648px) 60vw, 950px"
                  className="object-cover"
                />
              </div>
              {sideImages.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="relative h-40 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:aspect-square lg:h-auto"
                >
                  <Image
                    src={src}
                    alt={`${villa.name} photo ${i + 2}`}
                    fill
                    sizes="(max-width: 1024px) 50vw, (max-width: 1648px) 20vw, 300px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative mt-[14px] h-72 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:aspect-[950/622] lg:h-auto lg:w-[59.375%]">
              <Image
                src={gallery[0]}
                alt={`${villa.name} main photo`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, (max-width: 1648px) 60vw, 950px"
                className="object-cover"
              />
            </div>
          )}

          {/* Two-column: details + booking card */}
          {/* Figma: 930px details + 94px gap + 576px booking card on a 1600px row */}
          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:gap-[5.875%]">
            <div className="w-full lg:w-[58.125%] lg:shrink-0">
              <section>
                <h2 className="text-[24px] font-semibold leading-[1.3] text-[#121212]">
                  {villa.kind} hosted by {villa.hostName}
                </h2>
                <p className="mt-[15px] flex flex-wrap items-center text-[20px] leading-[1.3] text-[#121212]">
                  {villa.rooms} {villa.rooms === 1 ? "Room" : "Rooms"} <Dot />{" "}
                  {villa.bathrooms} {villa.bathrooms === 1 ? "Bathroom" : "Bathrooms"} <Dot />{" "}
                  {villa.max_guests} {villa.max_guests === 1 ? "Guest" : "Guests"}
                  {villa.area ? (
                    <>
                      {" "}<Dot /> {villa.area} Sq. Yards
                    </>
                  ) : null}
                </p>
              </section>

              <Divider className="mt-[30px]" />

              <section className="mt-[30px]">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">Description</h2>
                <p className="mt-[15px] max-w-[930px] text-justify text-[18px] leading-[1.35] text-[#121212]">
                  {villa.description || FALLBACK_DESCRIPTION}
                </p>
              </section>

              {villa.serviceList.length > 0 && (
                <>
                  <Divider className="mt-[30px]" />
                  <section className="mt-[30px]">
                    <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">
                      Extra Services
                    </h2>
                    <ul className="mt-[15px] space-y-[10px] text-[18px] leading-[1.35] text-[#121212]">
                      {villa.serviceList.map((s) => (
                        <li key={s} className="flex items-center gap-[10px]">
                          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-brand" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              <Divider className="mt-[30px]" />

              <section className="mt-[30px]">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">Your Bedroom</h2>
                <div className="relative mt-[15px] h-60 max-w-[648px] overflow-hidden rounded-[10px] lg:h-[368px]">
                  <Image
                    src={gallery[1] ?? gallery[0]}
                    alt="Bedroom"
                    fill
                    sizes="(max-width: 640px) 100vw, 648px"
                    className="object-cover"
                  />
                </div>
                <p className="mt-5 text-[20px] font-semibold leading-[1.3] text-[#121212]">Bedroom</p>
                <p className="mt-[10px] text-[18px] leading-[1.35] text-[#121212]">
                  {villa.rooms} {villa.rooms === 1 ? "room" : "rooms"} ·{" "}
                  {villa.bathrooms} {villa.bathrooms === 1 ? "bathroom" : "bathrooms"}
                </p>
              </section>
            </div>

            {user && villa.owner_id === user.id ? (
              /* Owners manage their listing here — they can't book it. */
              <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[48px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)] lg:mt-[60px]">
                <p className="text-[24px] font-semibold text-black">
                  This is your villa
                </p>
                <p className="mt-3 text-[16px] leading-[1.4] text-[#4a4a4a]">
                  Guests see the booking form here. You can manage your listing
                  instead:
                </p>
                <Link
                  href={`/host?edit=${villa.id}`}
                  className="mt-[25px] flex h-16 items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark"
                >
                  Edit villa
                </Link>
                <Link
                  href="/profile/requests"
                  className="mt-4 flex h-16 items-center justify-center rounded-[10px] border border-brand text-[20px] font-medium text-brand transition-colors hover:bg-brand/5"
                >
                  View rent requests
                </Link>
              </aside>
            ) : (
              <BookingCard
                villaId={villa.id}
                price={villa.price}
                rating={villa.rating}
                reviews={villa.reviews}
                defaultCheckIn={defaultCheckIn}
                defaultCheckOut={defaultCheckOut}
                defaultGuests={defaultGuests}
                maxGuests={villa.max_guests}
                today={dayFromNow(0)}
                bookedRanges={getBookedRanges(villa.id)}
                authed={user !== null}
              />
            )}
          </div>

          <Divider className="mt-[30px]" />

          {/* Facilities */}
          {villa.facilityList.length > 0 && (
            <>
              <section className="mt-[30px]">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">Facilities Provided</h2>
                <div className="mt-[30px] flex flex-col gap-10 sm:flex-row sm:gap-20">
                  <ul className="flex flex-col gap-10">
                    {leftFacilities.map((f) => (
                      <FacilityItem key={f} label={f} />
                    ))}
                  </ul>
                  <ul className="flex flex-col gap-10">
                    {rightFacilities.map((f) => (
                      <FacilityItem key={f} label={f} />
                    ))}
                  </ul>
                </div>
              </section>
              <Divider className="mt-[30px]" />
            </>
          )}

          {/* Reviews */}
          <section id="reviews" className="mt-[30px] flex flex-col gap-10 lg:flex-row lg:gap-0">
            <div className="lg:w-[59.7%] lg:shrink-0 lg:pr-6">
              <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="mt-[30px] text-[18px] leading-[1.35] text-[#525252]">
                  {villa.reviews === 0
                    ? "No reviews yet — this is a new listing. Be the first to stay here!"
                    : "No written reviews yet. Guests who complete a stay can leave one."}
                </p>
              ) : (
                <div className="mt-[30px] space-y-[25px]">
                  {reviews.map((r) => (
                    <article key={r.id}>
                      <div className="flex items-center gap-[15px]">
                        <Image
                          src={r.authorAvatar || "/images/place/avatar-host.png"}
                          alt=""
                          width={103}
                          height={103}
                          className="h-[103px] w-[103px] rounded-full object-cover"
                        />
                        <div>
                          <p className="text-[24px] font-semibold leading-[1.3] text-heading">{r.authorName}</p>
                          <p className="mt-[5px] text-[20px] leading-[1.3] text-[#525252]">{r.date}</p>
                          <div className="mt-1.5 flex gap-0.5" aria-label={`${r.stars} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <img
                                key={n}
                                src={n <= r.stars ? "/icons/star-filled.svg" : "/icons/star-unfilled.svg"}
                                alt=""
                                width={16}
                                height={16}
                                className="h-4 w-4"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-[15px] max-w-[828px] text-[18px] leading-[1.35] text-heading">
                        {r.comment}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 lg:border-l lg:border-[#c6c6c6] lg:pl-[5.5%]">
              <p className="flex items-center text-[20px] leading-[1.3] text-black">
                <span className="flex items-center">
                  <img src="/icons/place/star-51.svg" alt="" width={51} height={50} className="h-[50px] w-[51px]" />
                  {villa.reviews > 0 ? `${villa.rating} Rating` : "New listing"}
                </span>
                <Dot />
                <span>{villa.reviews} reviews</span>
              </p>
              {reviewRows > 0 && (
                <dl className="mt-[24px] space-y-[15px]">
                  {distribution.map((d) => (
                    <div key={d.stars} className="flex items-center justify-between gap-4">
                      <dt className="shrink-0 text-[20px] leading-[1.3] text-[#121212]">
                        {d.stars} star{d.stars === 1 ? "" : "s"}
                      </dt>
                      <dd className="flex min-w-0 max-w-[325px] flex-1 items-center gap-[15px]">
                        <span className="relative h-[5px] w-full min-w-[60px] rounded-[10px] bg-[#c4c4c4]">
                          <span
                            className="absolute left-0 top-0 h-[5px] rounded-[10px] bg-brand"
                            style={{ width: `${(d.count / reviewRows) * 100}%` }}
                          />
                        </span>
                        <span className="w-[38px] shrink-0 text-[20px] leading-[1.3] text-black">{d.count}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>

          <Divider className="mt-[30px]" />

          {/* Map */}
          <section className="mt-[37px]">
            <h2 className="text-[28px] font-semibold leading-[1.2] text-brand">Location on map</h2>
            <p className="mt-[10px] text-[20px] leading-[1.3] text-[#121212]">{villa.address}</p>
            <div
              className="relative mt-[20px] h-80 w-full overflow-hidden rounded-[10px] lg:h-[623px]"
              aria-label="Map showing the villa location"
            >
              <Image
                src="/images/place/map.png"
                alt={`Map showing the location of ${villa.name}`}
                fill
                sizes="(max-width: 1024px) 100vw, 1600px"
                className="object-cover"
              />
              <img
                src="/icons/place/map-home.svg"
                alt=""
                className="absolute left-[7%] top-[30%] w-[130px]"
              />
              <img
                src="/icons/place/map-zoom.svg"
                alt="Map zoom controls"
                className="absolute right-[30px] top-[15px] w-[60px]"
              />
            </div>
          </section>

          {/* Host */}
          <section className="mt-[50px]">
            <div className="flex items-center gap-5">
              <Image
                src={villa.hostAvatar || "/images/place/avatar-host.png"}
                alt={`Host ${villa.hostName}`}
                width={103}
                height={103}
                className="h-[103px] w-[103px] rounded-full object-cover"
              />
              <div>
                <h2 className="text-[24px] font-semibold leading-[1.3] text-[#121212]">
                  Hosted by {villa.hostName}
                </h2>
                <p className="mt-[9px] text-[20px] leading-[1.3] text-[#525252]">
                  Joined in {joinedLabel}
                </p>
              </div>
            </div>
            <div className="mt-[30px] flex flex-wrap items-center gap-10 text-[20px] leading-[1.3] text-[#121212]">
              <span className="flex items-center gap-[11px]">
                <img src="/icons/place/star-vector.svg" alt="" width={27} height={26} className="h-[26px] w-[27px]" />
                {villa.reviews} Reviews
              </span>
              <span className="flex items-center gap-[7px]">
                <img src="/icons/place/verified.svg" alt="" width={32} height={32} className="h-8 w-8" />
                Identity Verified
              </span>
            </div>
            <div className="mt-[25px] text-[20px] leading-[1.5] text-[#121212]">
              <p>Response rate: 100%</p>
              <p>Response time: within an hour</p>
            </div>
            <button
              type="button"
              className="mt-[35px] rounded-[10px] border border-brand bg-white px-5 py-[10px] text-[16px] leading-[1.3] text-brand transition-colors hover:bg-brand/5"
            >
              Contact Host
            </button>
            <p className="mt-[35px] flex max-w-[660px] items-center gap-[21px] text-[18px] leading-[1.35] text-black">
              <img src="/icons/place/shield.svg" alt="" width={32} height={36} className="h-9 w-8 shrink-0" />
              To protect your payment, never transfer money or communicate
              outside of the MyVilla website or app.
            </p>
          </section>

          <Divider className="mt-[30px]" />

          {/* House Rules */}
          <section className="mt-[30px]">
            <h2 className="text-[28px] font-semibold leading-[1.3] text-brand">House Rules</h2>
            <ul className="mt-[30px] space-y-[15px] text-[20px] leading-[1.3] text-[#121212]">
              <li className="flex items-center gap-[9px]">
                <img src="/icons/place/clock.svg" alt="" width={39} height={39} className="h-[39px] w-[39px]" />
                Check-in: After 1:00 pm
              </li>
              <li className="flex items-center gap-[9px]">
                <img src="/icons/place/clock.svg" alt="" width={39} height={39} className="h-[39px] w-[39px]" />
                Checkout: 12:00 pm
              </li>
              <li className="flex items-center gap-[11px]">
                <img src="/icons/place/paw.svg" alt="" width={36} height={36} className="h-9 w-9" />
                Pets are allowed
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
