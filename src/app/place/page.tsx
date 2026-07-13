import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PlaceActions from "@/components/place/PlaceActions";
import BookingCard from "@/components/place/BookingCard";
import VillaDetailView from "@/components/place/VillaDetailView";
import VillaPackages from "@/components/place/VillaPackages";
import { getCurrentUser } from "@/lib/session";
import {
  getBookedRanges,
  getCatalogVillas,
  getFavoriteVillaIds,
  getPackagesForVilla,
  getRoomBookings,
  getVillaDetail,
  getVillaReviewDistribution,
  getVillaReviews,
  type VillaDetail,
} from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";
import { dayFromNow, nightsBetween, parseDay } from "@/lib/dates";

type Search = {
  searchParams: Promise<{
    id?: string;
    in?: string;
    out?: string;
    guests?: string;
    /** Rooms carried back when editing a hotel/resort booking from checkout. */
    rooms?: string;
    /** Chosen paid-service indices, carried back when editing from checkout. */
    svc?: string;
    /** The filtered /search URL to return to (set when arriving from a result). */
    from?: string;
  }>;
};

/** Only honour a `from` that points back to our own /search results, so the
 *  breadcrumb can't be turned into an off-site or arbitrary redirect. */
function backToSearchHref(from: string | undefined): string {
  return from && from.startsWith("/search") && !from.startsWith("//")
    ? from
    : "/search";
}

async function loadVilla(id: string | undefined): Promise<VillaDetail | null> {
  const byId = id ? await getVillaDetail(Number(id)) : null;
  if (byId) return byId;
  const first = (await getCatalogVillas(1))[0];
  return first ? await getVillaDetail(first.id) : null;
}

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { id } = await searchParams;
  const villa = await loadVilla(id);
  if (!villa) return { title: "Villa" };
  return {
    title: `${villa.name}, ${villa.city}`,
    description:
      villa.description ||
      `${villa.kind} in ${villa.city} — ${villa.rooms} rooms, ${villa.bathrooms} bathrooms.`,
  };
}

export default async function PlacePage({ searchParams }: Search) {
  const {
    id,
    in: inParam,
    out: outParam,
    guests: guestsParam,
    rooms: roomsParam,
    svc: svcParam,
    from,
  } = await searchParams;
  const backHref = backToSearchHref(from);
  const villa = await loadVilla(id);
  const user = await getCurrentUser();
  const saved =
    user && villa ? (await getFavoriteVillaIds(user.id)).has(villa.id) : false;

  // Dates carried over from search (or a package link) prefill the booking card.
  const carriedDates = !!(
    parseDay(inParam) &&
    parseDay(outParam) &&
    nightsBetween(inParam!, outParam!) >= 1 &&
    inParam! >= dayFromNow(0)
  );
  // With no dates carried from search, default to a today → tomorrow (1-night)
  // stay rather than a week out.
  const defaultCheckIn = carriedDates ? inParam! : dayFromNow(0);
  const defaultCheckOut = carriedDates ? outParam! : dayFromNow(1);
  const carriedGuests = Number(guestsParam);
  const defaultGuests =
    Number.isInteger(carriedGuests) && carriedGuests >= 1 && carriedGuests <= 30
      ? carriedGuests
      : 2;
  // Rooms + chosen paid services carried back when editing from checkout, so the
  // booking card reopens with exactly what the guest had picked.
  const carriedRooms = Number(roomsParam);
  const defaultRooms =
    Number.isInteger(carriedRooms) && carriedRooms >= 1 ? carriedRooms : undefined;
  const defaultServices = (svcParam ? svcParam.split(",") : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0);

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

  const reviews = await getVillaReviews(villa.id);
  const distribution = await getVillaReviewDistribution(villa.id);
  // Hotels/resorts sell rooms individually; other kinds book as one whole unit.
  const roomBased = isRoomBased(villa.kind);
  const roomBookings = roomBased ? await getRoomBookings(villa.id) : [];
  const bookedRanges = roomBased ? [] : await getBookedRanges(villa.id);

  // Packages are shown to guests only (owners can't book their own villa).
  const isOwnerViewing = !!user && villa.owner_id === user.id;
  const packages = isOwnerViewing ? [] : await getPackagesForVilla(villa.id);
  // The "stay 7+/28+ nights for a discount" note only makes sense when the villa
  // actually offers the long-stay packages that embody those tiers (Weekly
  // Escape / Monthly Retreat) — otherwise it's advertised on villas that don't.
  const hasLongStayPackages = packages.some(
    (p) => p.type === "weekly" || p.type === "monthly",
  );

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <VillaDetailView
          villa={villa}
          reviews={reviews}
          distribution={distribution}
          breadcrumb={
            <>
              <Link href="/" className="underline">Home</Link>
              <span className="font-light">{"  /  "}</span>
              <Link href={backHref} className="underline">Search</Link>
              <span className="font-light">{" / "}</span>
              <span>{villa.name}</span>
            </>
          }
          topActions={
            <PlaceActions villaId={villa.id} initialSaved={saved} authed={user !== null} />
          }
          packagesSlot={
            packages.length > 0 ? (
              <VillaPackages
                packages={packages}
                peoplePerRoom={villa.people_per_room}
              />
            ) : null
          }
          rightColumn={
            user && villa.owner_id === user.id ? (
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
                defaultRooms={defaultRooms}
                defaultServices={defaultServices}
                maxGuests={villa.max_guests}
                today={dayFromNow(0)}
                bookedRanges={bookedRanges}
                authed={user !== null}
                services={villa.serviceList}
                roomBased={roomBased}
                totalRooms={villa.rooms}
                peoplePerRoom={villa.people_per_room}
                roomBookings={roomBookings}
                discount={villa.discount}
                hasLongStayPackages={hasLongStayPackages}
              />
            )
          }
        />
      </main>
      <Footer />
    </>
  );
}
