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
  getGuestRoomBookings,
  getRoomBookings,
  getVillaDetail,
  getVillaReviews,
  getVillaReviewDistribution,
} from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";
import { dayFromNow, nightsBetween } from "@/lib/dates";
import { quote } from "@/lib/pricing";
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
  // This guest's OTHER rooms here — the per-guest cap counts against them on the
  // edit page exactly as it does when booking, so the picker can't offer rooms
  // modifyBookingAction would then refuse. This booking is excluded, so
  // re-saving its own rooms never counts against itself.
  const myRoomBookings =
    roomBased && user
      ? await getGuestRoomBookings(booking.villaId, user.id, booking.id)
      : [];
  const bookedRanges = roomBased
    ? []
    : await getBookedRanges(booking.villaId, booking.id);

  // What this booking's stay currently totals at TODAY's price — the figure the
  // modify flow reconciles the new total against. Both are computed at the same
  // (current) price + service prices, so the difference reflects only the guest's
  // changes (nights/rooms/guests/add-ons), never a price drift. Add-ons are
  // matched back to the villa's live service list by name for their indices.
  const originalExtras = booking.extras
    .map((e) => villa.serviceList.findIndex((s) => s.name === e.name))
    .filter((i) => i >= 0);
  const oldNights = Math.max(1, nightsBetween(booking.checkIn, booking.checkOut));
  const oldExtrasTotal = originalExtras.reduce(
    (sum, i) => sum + (villa.serviceList[i]?.price ?? 0),
    0,
  );
  const originalTotal =
    quote(
      villa.price * (roomBased ? booking.bookingRooms : 1),
      oldNights,
      villa.discount,
    ).total + oldExtrasTotal;

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
            /* One flex child only: the two-column layout sizes the right rail
               as a single unit, so the banner and card must share a wrapper —
               side by side as siblings they'd split the rail. The card brings
               its own lg top margin; the wrapper takes it over instead. */
            <div className="flex w-full min-w-0 flex-col gap-5 lg:mt-[60px] lg:[&>aside]:mt-0">
              {/* An open balance outranks everything else on this page — the
                  stay reads "Confirmed" below, and without this box nothing
                  here would say money is still owed or why. */}
              {booking.paymentDue && booking.pay && (
                <aside className="w-full max-w-[576px] rounded-[10px] border border-[#e8d5a3] bg-[#fdf9f0] p-5">
                  <p className="text-[15px] font-semibold text-[#8a6a1f]">
                    {booking.status === "pending"
                      ? "Payment pending — this stay isn't reserved yet"
                      : "Balance due — your host upgraded this stay"}
                  </p>
                  <dl className="mt-3 space-y-1.5 text-[13px] leading-[1.5] text-[#7a6a45]">
                    <div className="flex items-center justify-between gap-4">
                      <dt>Full stay</dt>
                      <dd>${booking.pay.fullStay.toFixed(2)}</dd>
                    </div>
                    {booking.pay.hostDiscount > 0 && (
                      <div className="flex items-center justify-between gap-4 text-brand">
                        <dt>Host&rsquo;s discount</dt>
                        <dd>−${booking.pay.hostDiscount.toFixed(2)}</dd>
                      </div>
                    )}
                    {booking.pay.alreadyPaid > 0 && (
                      <div className="flex items-center justify-between gap-4 text-[#1c7d5c]">
                        <dt>You already paid</dt>
                        <dd>−${booking.pay.alreadyPaid.toFixed(2)}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#e8d5a3] pt-3">
                    <p className="text-[14px] font-semibold text-[#121212]">
                      Due now ${booking.pay.due.toFixed(2)}
                    </p>
                    <Link
                      href={`/payment?pay=${booking.id}`}
                      className="rounded-[8px] bg-brand px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Pay now
                    </Link>
                  </div>
                </aside>
              )}
              <ManageBookingCard
              bookingId={booking.id}
              villaId={villa.id}
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
              myRoomBookings={myRoomBookings}
              discount={villa.discount}
              services={villa.serviceList}
              originalExtras={originalExtras}
              originalTotal={originalTotal}
              locked={booking.locked}
              roomPlan={booking.roomPlan}
              packageStay={
                booking.package
                  ? { nights: booking.package.nights, price: booking.package.price }
                  : null
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
