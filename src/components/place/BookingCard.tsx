"use client";

import { useState } from "react";
import Link from "next/link";
import { nightsBetween, formatRange } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { loginHref } from "@/lib/returnTo";
import DateRangeField from "@/components/home/DateRangeField";
import type { BookedRange } from "@/lib/queries";

/* eslint-disable @next/next/no-img-element */

export default function BookingCard({
  villaId,
  price,
  rating,
  reviews,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests = 2,
  maxGuests,
  today,
  bookedRanges,
  authed,
}: {
  villaId: number;
  price: number;
  rating: number;
  reviews: number;
  defaultCheckIn: string;
  defaultCheckOut: string;
  defaultGuests?: number;
  /** Guest capacity the villa owner set — caps the guest picker. */
  maxGuests: number;
  today: string;
  bookedRanges: BookedRange[];
  authed: boolean;
}) {
  // The guest picker runs 1..maxGuests (owner-defined); at least 1 option.
  const guestOptions = Math.max(1, maxGuests);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(
    Math.min(Math.max(1, defaultGuests), guestOptions),
  );

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const unavailable =
    nights >= 1 &&
    bookedRanges.some((r) => r.checkIn < checkOut && r.checkOut > checkIn);
  const valid = nights >= 1 && !unavailable && checkIn >= today;
  const q = quote(price, nights);

  const paymentUrl = `/payment?villa=${villaId}&in=${checkIn}&out=${checkOut}&guests=${guests}`;
  // Booking requires an account — signed-out guests sign in first and land
  // back on this exact checkout.
  const reserveHref = valid
    ? authed
      ? paymentUrl
      : loginHref(paymentUrl)
    : undefined;

  return (
    <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[48px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)] lg:mt-[60px]">
      <div className="flex items-center justify-between">
        <p className="text-black">
          <span className="text-[24px] font-semibold">${price} </span>
          <span className="text-[18px]">/ night</span>
        </p>
        <p className="flex items-center text-[16px] leading-[1.2] text-black">
          <img src="/icons/place/star-small.svg" alt="" width={22} height={21} className="h-[21px] w-[22px]" />
          {rating}
          <Link href="#reviews" className="p-[10px] underline">
            {reviews} Reviews
          </Link>
        </p>
      </div>

      {/* Same calendar range picker as the home search, with this villa's
          confirmed bookings greyed out. */}
      <div className="mt-5">
        <DateRangeField
          variant="booking"
          checkIn={checkIn || null}
          checkOut={checkOut || null}
          bookedRanges={bookedRanges}
          onChange={(nextIn, nextOut) => {
            setCheckIn(nextIn ?? "");
            setCheckOut(nextOut ?? "");
          }}
        />
      </div>

      {/* The native select overlays the whole box (invisible) so clicking
          anywhere — label, value, or the chevron — opens the dropdown. */}
      <label
        htmlFor="booking-guests"
        className="relative mt-[22px] flex cursor-pointer items-center justify-between rounded-[10px] border-[1.5px] border-[#ddd] p-[15px]"
      >
        <span className="min-w-0">
          <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
            Guests
          </span>
          <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
            {guests} {guests === 1 ? "guest" : "guests"}
          </span>
        </span>
        <img
          src="/icons/place/dropdown.svg"
          alt=""
          width={49}
          height={49}
          className="pointer-events-none h-[49px] w-[49px] shrink-0"
        />
        <select
          id="booking-guests"
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          aria-label="Number of guests"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {Array.from({ length: guestOptions }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>

      {/* Availability is spelled out before the guest ever reaches payment:
          green when the chosen range is free, red when it clashes with a
          confirmed stay. */}
      {nights >= 1 && checkIn >= today && (
        <p
          role="status"
          className={`mt-[22px] flex items-center gap-2.5 rounded-[10px] px-4 py-3 text-[15px] font-medium ${
            unavailable
              ? "bg-[#fdecec] text-[#c0392b]"
              : "bg-[#eafaf1] text-[#1b8a4b]"
          }`}
        >
          <span
            aria-hidden
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] leading-none text-white ${
              unavailable ? "bg-[#c0392b]" : "bg-[#1b8a4b]"
            }`}
          >
            {unavailable ? "!" : "✓"}
          </span>
          <span>
            {unavailable
              ? `Already booked for ${formatRange(checkIn, checkOut)}`
              : `Available for ${formatRange(checkIn, checkOut)}`}
          </span>
        </p>
      )}

      {reserveHref ? (
        <Link
          href={reserveHref}
          className="mt-[25px] flex h-16 items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Reserve
        </Link>
      ) : (
        <p className="mt-[25px] flex h-16 items-center justify-center rounded-[10px] bg-brand/40 px-4 text-center text-[16px] font-medium text-white">
          {unavailable
            ? "Choose different dates to reserve"
            : "Pick valid dates to reserve"}
        </p>
      )}

      <dl className="mt-[45px] space-y-[18px] text-[20px] leading-[1.2] text-black">
        <div className="flex items-center justify-between">
          <dt>
            ${price} × {nights} night{nights === 1 ? "" : "s"}
          </dt>
          <dd className="font-light">${q.subtotal.toFixed(2)}</dd>
        </div>
        {q.discountAmount > 0 && (
          <div className="flex items-center justify-between text-brand">
            <dt>{q.discount.label}</dt>
            <dd className="font-light">−${q.discountAmount.toFixed(2)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt>Service Fee</dt>
          <dd className="font-light">${q.serviceFee.toFixed(2)}</dd>
        </div>
      </dl>
      <hr className="mt-[25px] border-t border-[#c6c6c6]" />
      <div className="mt-5 flex items-center justify-between text-[20px] font-semibold leading-[1.2] text-[#121212]">
        <p>Total before taxes</p>
        <p>${q.total.toFixed(2)}</p>
      </div>
      <p className="mt-4 text-center text-[13px] text-[#7a7a85]">
        Stay 7+ nights for 15% off, 28+ nights for 30% off — applied automatically.
      </p>
    </aside>
  );
}
