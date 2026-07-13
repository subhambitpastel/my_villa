import Image from "next/image";
import type { VillaDetail } from "@/lib/queries";
import Avatar from "@/components/ui/Avatar";
import VillaGallery from "@/components/place/VillaGallery";
import {
  getVillaReviews,
  getVillaReviewDistribution,
} from "@/lib/queries";

/* eslint-disable @next/next/no-img-element */

const FALLBACK_DESCRIPTION =
  "Accommodation located three blocks from the main square, consisting of kitchen, patio, green area, living room, dining room, pets are acceptable. Due to the location of the house it is easy and close to have access to public parking.";

function Dot() {
  return <img src="/icons/place/dot.svg" alt="" width={27} height={27} className="h-[27px] w-[27px]" />;
}

function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-t border-[#c6c6c6] ${className}`} />;
}

// A plain bulleted row (no icon) — matches the Extra Services list so both
// sections line up cleanly. Icons were dropped: their varying sizes threw off
// the alignment.
function FacilityItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-[10px] text-[20px] leading-[1.3] text-[#121212]">
      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-brand" />
      {label}
    </li>
  );
}

/**
 * The full villa-detail view (gallery, description, facilities, reviews, map,
 * host, house rules). Shared by the public `/place` page and the booking
 * manage page so they look identical — only the breadcrumb, the top-right
 * actions, and the right-hand card differ.
 */
export default function VillaDetailView({
  villa,
  reviews,
  distribution,
  breadcrumb,
  topActions,
  rightColumn,
  packagesSlot,
}: {
  villa: VillaDetail;
  reviews: Awaited<ReturnType<typeof getVillaReviews>>;
  distribution: Awaited<ReturnType<typeof getVillaReviewDistribution>>;
  breadcrumb: React.ReactNode;
  topActions?: React.ReactNode;
  /** The card shown in the right column (booking form, manage form, or owner tools). */
  rightColumn: React.ReactNode;
  /** Guest-facing package cards (VillaPackages); omitted on the manage view. */
  packagesSlot?: React.ReactNode;
}) {
  const reviewRows = distribution.reduce((s, d) => s + d.count, 0);
  const gallery = villa.gallery;
  // Free services (price 0) are offered at no cost, so they belong with the
  // villa's facilities under "Facilities Provided"; only paid services (price > 0)
  // go under "Extra Services".
  const paidServices = villa.serviceList.filter((s) => s.price > 0);
  const paidServiceNames = new Set(paidServices.map((s) => s.name));
  const freeServiceNames = villa.serviceList
    .filter((s) => s.price <= 0)
    .map((s) => s.name);
  // A paid add-on belongs only under "Extra Services" — so drop any facility
  // name that's also charged for (some listings carry the same label as both a
  // free facility and a paid service), leaving it out of "Facilities Provided".
  const allFacilities = [
    ...new Set([...villa.facilityList, ...freeServiceNames]),
  ].filter((name) => !paidServiceNames.has(name));
  const leftFacilities = allFacilities.filter((_, i) => i % 2 === 0);
  const rightFacilities = allFacilities.filter((_, i) => i % 2 === 1);
  const joined = new Date(villa.hostJoined.replace(" ", "T") + "Z");
  const joinedLabel = joined.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
      <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
        {breadcrumb}
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
        {topActions}
      </div>

      {/* Gallery — Figma: 950px hero + 2×2 of 300px tiles on a 1600px row. */}
      <VillaGallery gallery={gallery} name={villa.name} />

      {/* Two-column: details + right-hand card */}
      {/* Figma: 930px details + 94px gap + 576px card on a 1600px row */}
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

          {paidServices.length > 0 && (
            <>
              <Divider className="mt-[30px]" />
              <section className="mt-[30px]">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">
                  Extra Services
                </h2>
                <ul className="mt-[15px] space-y-[10px] text-[18px] leading-[1.35] text-[#121212]">
                  {paidServices.map((s) => (
                    <li key={s.name} className="flex items-center gap-[10px]">
                      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-brand" />
                      {s.name}
                      <span className="text-[16px] text-[#4a4a4a]">
                        — ${s.price}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {packagesSlot && (
            <>
              <Divider className="mt-[30px]" />
              <section id="packages" className="mt-[30px] scroll-mt-24">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">
                  Packages
                </h2>
                <p className="mt-[8px] text-[16px] leading-[1.35] text-[#4a4a4a]">
                  All-inclusive getaways for a fixed number of nights — pick a
                  start date and everything below is included.
                </p>
                {packagesSlot}
              </section>
            </>
          )}

        </div>

        {rightColumn}
      </div>

      <Divider className="mt-[30px]" />

      {/* Facilities — the villa's amenities plus any free services */}
      {allFacilities.length > 0 && (
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
                    <Avatar
                      src={r.authorAvatar}
                      alt=""
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
          <Avatar
            src={villa.hostAvatar}
            alt={`Host ${villa.hostName}`}
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

    </div>
  );
}
