import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import OwnerBookingCard from "@/components/host/OwnerBookingCard";
import VillaDetailView from "@/components/place/VillaDetailView";
import { getCurrentUser } from "@/lib/session";
import {
  getBookedRanges,
  getRoomBookings,
  getGuestOption,
  getVillaDetail,
  getVillaReviewDistribution,
  getVillaReviews,
} from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";
import { dayFromNow, nightsBetween, parseDay } from "@/lib/dates";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "Create a booking",
  description: "Book a stay on your listing on a guest's behalf.",
};

/**
 * The owner's counter-booking page: the same listing view a guest sees, with the
 * owner's own booking form in place of the guest's checkout flow.
 */
export default async function OwnerBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    villa?: string;
    in?: string;
    out?: string;
    /** Prefill, as sent by "Fulfil this request" on a call request: who asked,
     *  and what they asked for. All of it stays editable — it's a starting
     *  point, not a commitment, and the action re-validates regardless. */
    guest?: string;
    rooms?: string;
    guests?: string;
    /** Paid add-ons to pre-tick, as indices into the villa's service list. */
    svc?: string;
    /** The call request being fulfilled — closed once the booking is made. */
    call?: string;
  }>;
}) {
  const {
    villa: villaParam,
    in: inParam,
    out: outParam,
    guest: guestParam,
    rooms: roomsParam,
    guests: guestsParam,
    svc: svcParam,
    call: callParam,
  } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(`/host/booking?villa=${villaParam ?? ""}`));

  const villaId = Number(villaParam);
  const villa = Number.isInteger(villaId) ? await getVillaDetail(villaId) : null;
  // Ownership is enforced here, not just by hiding the entry point — the URL is
  // guessable. createOwnerBookingAction re-checks it as the real authority.
  if (!villa || villa.owner_id !== user.id) redirect("/profile/properties");

  const roomBased = isRoomBased(villa.kind);
  const roomBookings = roomBased ? await getRoomBookings(villa.id) : [];
  const bookedRanges = roomBased ? [] : await getBookedRanges(villa.id);

  // Dates may be carried in the URL (same as the guest's /place page), so a
  // booking can be linked to already scoped to the dates in question. No upper
  // bound on length here — that limit is the guests'.
  const carriedDates = !!(
    parseDay(inParam) &&
    parseDay(outParam) &&
    nightsBetween(inParam!, outParam!) >= 1 &&
    inParam! >= dayFromNow(0)
  );

  // The guest to prefill "Booking for" with. Looked up server-side so the name,
  // email and customer ID come from the record rather than the URL — the link
  // carries an id, nothing that could be spoofed into the picker. The owner
  // themselves is never a valid guest.
  const guestId = Number(guestParam);
  const prefillGuest =
    Number.isInteger(guestId) && guestId > 0 && guestId !== user.id
      ? await getGuestOption(guestId)
      : null;
  const prefillRooms = Number(roomsParam);
  const prefillGuests = Number(guestsParam);
  const callRequestId = Number(callParam);
  // Add-on indices to pre-tick. Kept only if they point at a real paid service
  // on this villa — a stale index would otherwise tick the wrong thing.
  const villaPaidServices = villa.serviceList;
  const prefillServices = [
    ...new Set(
      (svcParam ? svcParam.split(",") : [])
        .map(Number)
        .filter(
          (i) =>
            Number.isInteger(i) &&
            i >= 0 &&
            i < villaPaidServices.length &&
            villaPaidServices[i].price > 0,
        ),
    ),
  ];

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <VillaDetailView
          villa={villa}
          reviews={await getVillaReviews(villa.id)}
          distribution={await getVillaReviewDistribution(villa.id)}
          breadcrumb={
            <>
              <Link href="/" className="underline">
                Home
              </Link>
              <span className="font-light">{"  /  "}</span>
              <Link href="/profile/properties" className="underline">
                My Property
              </Link>
              <span className="font-light">{" / "}</span>
              <span>Create a booking</span>
            </>
          }
          rightColumn={
            <div className="w-full max-w-[576px] lg:mt-[60px]">
              <div className="mb-4 rounded-[10px] bg-brand/10 px-5 py-4 text-[14px] leading-[1.5] text-brand-dark">
                You&rsquo;re booking{" "}
                <span className="font-semibold">{villa.name}</span> for a guest.
                The usual limits on length, headcount and rooms don&rsquo;t apply
                here — only what&rsquo;s actually free does.
              </div>
              {villa.archived_at !== null && (
                <p className="mb-4 rounded-[10px] bg-[#fff6e5] px-5 py-4 text-[14px] leading-[1.5] text-[#a06a00]">
                  This listing is <span className="font-semibold">archived</span>,
                  so guests can&rsquo;t book it themselves. You can still book it
                  for someone directly.
                </p>
              )}
              <OwnerBookingCard
                villaId={villa.id}
                price={villa.price}
                discount={villa.discount}
                today={dayFromNow(0)}
                maxGuests={villa.max_guests}
                bookedRanges={bookedRanges}
                services={villa.serviceList}
                roomBased={roomBased}
                totalRooms={villa.rooms}
                roomBookings={roomBookings}
                peoplePerRoom={villa.people_per_room}
                defaultServices={prefillServices}
                defaultCheckIn={carriedDates ? inParam! : dayFromNow(0)}
                defaultCheckOut={carriedDates ? outParam! : dayFromNow(1)}
                defaultGuest={prefillGuest}
                callRequestId={
                  Number.isInteger(callRequestId) && callRequestId > 0
                    ? callRequestId
                    : undefined
                }
                defaultRooms={
                  Number.isInteger(prefillRooms) && prefillRooms >= 1
                    ? prefillRooms
                    : undefined
                }
                defaultGuests={
                  Number.isInteger(prefillGuests) && prefillGuests >= 1
                    ? prefillGuests
                    : undefined
                }
              />
            </div>
          }
        />
      </main>
      <Footer />
    </>
  );
}
