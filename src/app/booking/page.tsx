import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import VillaDetailView from "@/components/place/VillaDetailView";
import ManageBookingCard from "@/components/booking/ManageBookingCard";
import { getCurrentUser } from "@/lib/session";
import {
  getBookingForManage,
  getBookedRanges,
  getRoomBookings,
  getVillaDetail,
  getVillaReviews,
  getVillaReviewDistribution,
} from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";
import { dayFromNow } from "@/lib/dates";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "Manage your booking",
  description:
    "Review your stay, update your dates or number of guests, or cancel your MyVilla booking.",
};

export default async function ManageBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(loginHref(`/booking${id ? `?id=${id}` : ""}`));

  const bookingId = Number(id);
  const booking = Number.isInteger(bookingId)
    ? await getBookingForManage(bookingId, user.id)
    : null;
  if (!booking) redirect("/profile/bookings");

  // Only an active, upcoming stay can be changed. Past/cancelled/completed
  // bookings go back to the list (nothing to manage).
  const today = dayFromNow(0);
  const manageable =
    booking.status === "accepted" &&
    booking.checkOut !== "" &&
    booking.checkOut >= today;
  if (!manageable) redirect("/profile/bookings");

  const villa = await getVillaDetail(booking.villaId);
  if (!villa) redirect("/profile/bookings");

  const reviews = await getVillaReviews(villa.id);
  const distribution = await getVillaReviewDistribution(villa.id);
  // Other guests' stays block dates; this booking is excluded so its own dates
  // stay selectable while the guest adjusts them. Hotels/resorts block only
  // sold-out days (room inventory); other kinds block any overlapping stay.
  const roomBased = isRoomBased(villa.kind);
  const roomBookings = roomBased
    ? await getRoomBookings(booking.villaId, booking.id)
    : [];
  const bookedRanges = roomBased
    ? []
    : await getBookedRanges(booking.villaId, booking.id);

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
              <Link href="/profile/bookings" className="underline">My Bookings</Link>
              <span className="font-light">{" / "}</span>
              <span>Manage booking</span>
            </>
          }
          topActions={
            <span className="rounded-[6px] bg-[#e9e8fd] px-4 py-1.5 text-[16px] font-semibold text-brand">
              Managing your booking
            </span>
          }
          rightColumn={
            <ManageBookingCard
              bookingId={booking.id}
              price={villa.price}
              checkIn={booking.checkIn}
              checkOut={booking.checkOut}
              guests={booking.guests}
              maxGuests={villa.max_guests}
              today={today}
              bookedRanges={bookedRanges}
              roomBased={roomBased}
              totalRooms={villa.rooms}
              peoplePerRoom={villa.people_per_room}
              rooms={booking.bookingRooms}
              roomBookings={roomBookings}
              discount={villa.discount}
              packageStay={
                booking.package
                  ? { nights: booking.package.nights, price: booking.package.price }
                  : null
              }
            />
          }
        />
      </main>
      <Footer />
    </>
  );
}
