import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PlaceActions from "@/components/place/PlaceActions";
import BookingCard from "@/components/place/BookingCard";
import VillaDetailView from "@/components/place/VillaDetailView";
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

type Search = {
  searchParams: Promise<{ id?: string; in?: string; out?: string; guests?: string }>;
};

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
  const { id, in: inParam, out: outParam, guests: guestsParam } = await searchParams;
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

  const reviews = await getVillaReviews(villa.id);
  const distribution = await getVillaReviewDistribution(villa.id);

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
              <Link href="/search" className="underline">Search</Link>
              <span className="font-light">{" / "}</span>
              <span>{villa.name}</span>
            </>
          }
          topActions={
            <PlaceActions villaId={villa.id} initialSaved={saved} authed={user !== null} />
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
                maxGuests={villa.max_guests}
                today={dayFromNow(0)}
                bookedRanges={await getBookedRanges(villa.id)}
                authed={user !== null}
                services={villa.serviceList}
              />
            )
          }
        />
      </main>
      <Footer />
    </>
  );
}
