import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import { getCurrentUser } from "@/lib/session";
import { getBookingForManage } from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";
import { formatDay, nightsBetween } from "@/lib/dates";
import { bookingReference } from "@/lib/pricing";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "Booking confirmed",
  description: "Your MyVilla booking is confirmed.",
};

// The single confirmation page every booking lands on — villas and hotels
// alike — reached from checkout via ?ref=MV-000016. Reads the booking back so
// the page survives a refresh or a shared link, and only ever shows the signed-
// in guest their own booking.
export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    /** "modified" when this confirms a booking change (vs a fresh booking). */
    mode?: string;
    /** Amount refunded (change lowered the total) or paid (change raised it). */
    refund?: string;
    paid?: string;
  }>;
}) {
  const { ref, mode, refund, paid } = await searchParams;
  const isModified = mode === "modified";
  const refundAmt = Math.max(0, Number(refund) || 0);
  const paidAmt = Math.max(0, Number(paid) || 0);

  const user = await getCurrentUser();
  if (!user) redirect(loginHref(`/booking/confirmed${ref ? `?ref=${ref}` : ""}`));

  // "MV-000016" → 16; anything unparseable falls back to the bookings list.
  const bookingId = Number((ref ?? "").replace(/\D/g, ""));
  const booking =
    Number.isInteger(bookingId) && bookingId > 0
      ? await getBookingForManage(bookingId, user.id)
      : null;
  if (!booking) redirect("/profile/bookings");

  const roomBased = isRoomBased(booking.kind);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[80px]">
        <div className="mx-auto w-full max-w-[760px] px-6 pt-16">
          <div className="rounded-[16px] bg-white px-6 py-12 text-center shadow-[0px_15px_50px_0px_rgba(0,0,0,0.12)] sm:px-10">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
              <svg width="40" height="40" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="10" fill="#5D5FEF" />
                <path d="M6.5 11.5l3 3 6-6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="mt-6 text-[30px] font-semibold leading-[1.3] text-[#121212]">
              {isModified ? "Booking updated" : "Booking confirmed"}
            </h1>
            <p className="mt-2 text-[16px] leading-[1.5] text-[#4a4a4a]">
              {isModified
                ? "Your booking has been updated and the host has been notified."
                : "Your stay is booked and the host has been notified."}
            </p>
            {isModified && refundAmt > 0 && (
              <p className="mt-3 inline-block rounded-[8px] bg-emerald-50 px-4 py-2 text-[15px] font-medium text-emerald-700">
                We&apos;ll refund ${refundAmt.toFixed(2)} to your original payment
                method.
              </p>
            )}
            {isModified && paidAmt > 0 && (
              <p className="mt-3 inline-block rounded-[8px] bg-brand/10 px-4 py-2 text-[15px] font-medium text-brand-dark">
                You paid an additional ${paidAmt.toFixed(2)} for the changes.
              </p>
            )}
            <p className="mt-3 text-[15px] text-[#4a4a4a]">
              Reference{" "}
              <span className="font-semibold text-[#121212]">
                {bookingReference(booking.id)}
              </span>
            </p>

            <div className="mx-auto mt-8 flex max-w-[480px] items-center gap-4 rounded-[12px] border border-line/60 p-4 text-left">
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[10px]">
                <Image
                  src={booking.villaImage}
                  alt={`${booking.villaName}, ${booking.villaCity}`}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-[#121212]">
                  {booking.villaName}, {booking.villaCity}
                </p>
                <p className="mt-1 text-[14px] text-[#4a4a4a]">
                  {formatDay(booking.checkIn)} – {formatDay(booking.checkOut)} ·{" "}
                  {nights} night{nights === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-[14px] text-[#4a4a4a]">
                  {booking.guests} guest{booking.guests === 1 ? "" : "s"}
                  {roomBased
                    ? ` · ${booking.bookingRooms} room${booking.bookingRooms === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/profile/bookings"
                className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                View in My Bookings
              </Link>
              <Link
                href="/"
                className="rounded-[8px] border border-line px-6 py-2.5 text-[14px] font-semibold text-[#4a4a4a] transition-colors hover:bg-line/20"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
