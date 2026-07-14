"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nightsBetween, formatRange } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { loginHref } from "@/lib/returnTo";
import DateRangeField from "@/components/home/DateRangeField";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import {
  fullyBookedRanges,
  roomsFreeForRange,
  type RoomBooking,
} from "@/lib/rooms";

/* eslint-disable @next/next/no-img-element */

export default function BookingCard({
  villaId,
  price,
  rating,
  reviews,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests = 2,
  defaultRooms,
  defaultServices = [],
  maxGuests,
  today,
  bookedRanges,
  authed,
  services = [],
  roomBased = false,
  totalRooms = 1,
  peoplePerRoom = 0,
  roomBookings = [],
  discount = 0,
  hasLongStayPackages = false,
}: {
  villaId: number;
  price: number;
  rating: number;
  reviews: number;
  /** Host-set % off the nightly price (applied in the quote). */
  discount?: number;
  defaultCheckIn: string;
  defaultCheckOut: string;
  defaultGuests?: number;
  /** Rooms to preselect (carried back when editing a hotel/resort from checkout). */
  defaultRooms?: number;
  /** Paid-service indices to preselect (carried back when editing from checkout). */
  defaultServices?: number[];
  /** Guest capacity the villa owner set — caps the guest picker. */
  maxGuests: number;
  today: string;
  bookedRanges: BookedRange[];
  authed: boolean;
  /** Extra services the host offers; picked in a dialog on Reserve. */
  services?: VillaService[];
  /** Hotels/resorts sell rooms individually — enables the Rooms picker,
   *  per-room pricing, and sold-out-only calendar blocking. */
  roomBased?: boolean;
  totalRooms?: number;
  peoplePerRoom?: number;
  /** Accepted reservations (with room counts) used to compute availability. */
  roomBookings?: RoomBooking[];
  /** Whether this villa offers a Weekly Escape / Monthly Retreat package — only
   *  then is the long-stay discount note advertised on the booking card. */
  hasLongStayPackages?: boolean;
}) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  // Hotels/resorts: start with the rooms carried back from checkout if any,
  // else enough to seat the guests carried from search (e.g. 14 guests at 2
  // people/room → 7 rooms), capped at the inventory.
  const [roomsSel, setRoomsSel] = useState(
    roomBased
      ? Math.min(
          Math.max(1, totalRooms),
          Math.max(
            1,
            defaultRooms ||
              Math.ceil(Math.max(1, defaultGuests) / Math.max(1, peoplePerRoom)),
          ),
        )
      : 1,
  );
  const [guestsSel, setGuestsSel] = useState(Math.max(1, defaultGuests));
  const router = useRouter();
  // Availability isn't announced up front — the message only appears if the
  // guest tries to reserve a range that's actually taken (checked on click).
  const [showUnavailable, setShowUnavailable] = useState(false);

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const datesReady = nights >= 1 && checkIn >= today;

  // Whole-villa stays block their entire range; hotels/resorts block only days
  // where every room is taken (rendered struck-through on the calendar).
  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;

  // Rooms the guest may take for the chosen range, and the resulting guest cap.
  const roomsFree = roomBased
    ? datesReady
      ? roomsFreeForRange(checkIn, checkOut, roomBookings, totalRooms)
      : totalRooms
    : 1;
  const roomsMax = Math.max(1, roomsFree);
  const rooms = roomBased ? Math.min(roomsSel, roomsMax) : 1;
  // Every room is taken for the chosen range — no inventory to offer.
  const soldOut = roomBased && datesReady && roomsFree === 0;
  const guestCap = roomBased
    ? Math.max(1, rooms * peoplePerRoom)
    : Math.max(1, maxGuests);
  const guests = Math.min(Math.max(1, guestsSel), guestCap);

  const unavailable =
    datesReady &&
    (calendarBlocked.some((r) => r.checkIn < checkOut && r.checkOut > checkIn) ||
      (roomBased && roomsFree < rooms));
  const unitPrice = roomBased ? price * rooms : price;
  const q = quote(unitPrice, nights, discount);

  // Extra services the guest ticks inline on this card (indices into `services`).
  // Only paid services are offered — free ones come with the stay, so there's
  // nothing to opt into. Original indices are kept so checkout resolves prices
  // from the villa server-side.
  const paidServices = services
    .map((s, i) => ({ service: s, index: i }))
    .filter(({ service }) => service.price > 0);
  // Preselect any paid services carried back from checkout (edit flow), keeping
  // only indices that are real paid services on this villa.
  const [chosen, setChosen] = useState<number[]>(() => {
    const paid = new Set(paidServices.map((p) => p.index));
    return defaultServices.filter((i) => paid.has(i));
  });
  const chosenTotal = chosen.reduce((sum, i) => sum + (services[i]?.price ?? 0), 0);
  const toggleService = (i: number) =>
    setChosen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const paymentUrl = `/payment?villa=${villaId}&in=${checkIn}&out=${checkOut}&guests=${guests}${
    roomBased ? `&rooms=${rooms}` : ""
  }`;

  // Checkout carries the picked services as indices; prices are re-read from
  // the villa on the server, so the client can never set its own amounts.
  function goToPayment(serviceIdx: number[]) {
    const url =
      serviceIdx.length > 0 ? `${paymentUrl}&svc=${serviceIdx.join(",")}` : paymentUrl;
    // Booking requires an account — signed-out guests sign in first and land
    // back on this exact checkout.
    router.push(authed ? url : loginHref(url));
  }

  function handleReserve() {
    if (!datesReady) return;
    if (unavailable) {
      setShowUnavailable(true);
      return;
    }
    // Extra services are picked inline on this card, so go straight to checkout.
    goToPayment(chosen);
  }

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
          bookedRanges={calendarBlocked}
          onChange={(nextIn, nextOut) => {
            setCheckIn(nextIn ?? "");
            setCheckOut(nextOut ?? "");
            setShowUnavailable(false);
          }}
        />
      </div>

      {/* Hotels/resorts sell individual rooms — pick how many, then guests. */}
      {roomBased && (
        <label
          htmlFor="booking-rooms"
          className={`relative mt-[22px] flex items-center justify-between rounded-[10px] border-[1.5px] p-[15px] ${
            soldOut ? "cursor-not-allowed border-[#f0c4c0]" : "cursor-pointer border-[#ddd]"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
              Rooms
            </span>
            <span className="mt-0.5 block text-[16px] leading-[1.2]">
              {soldOut ? (
                <span className="font-medium text-[#c0392b]">
                  Sold out for these dates
                </span>
              ) : (
                <span className="text-[#4a4a4a]">
                  {rooms} {rooms === 1 ? "room" : "rooms"}
                  {datesReady && (
                    <span className="text-[#8a8a94]"> · {roomsFree} available</span>
                  )}
                </span>
              )}
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
            id="booking-rooms"
            value={rooms}
            onChange={(e) => setRoomsSel(Number(e.target.value))}
            disabled={soldOut}
            aria-label="Number of rooms"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          >
            {Array.from({ length: roomsMax }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "room" : "rooms"}
              </option>
            ))}
          </select>
        </label>
      )}

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
          onChange={(e) => setGuestsSel(Number(e.target.value))}
          aria-label="Number of guests"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {Array.from({ length: guestCap }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>

      {/* Paid add-ons, pickable right here on the details page — the choices
          carry into checkout (and back again if the guest edits their booking). */}
      {paidServices.length > 0 && (
        <div className="mt-[22px]">
          <p className="text-[18px] font-medium leading-[1.2] text-[#121212]">
            Extra Services{" "}
            <span className="text-[14px] font-normal text-[#8a8a94]">(optional)</span>
          </p>
          <ul className="mt-3 max-h-[220px] space-y-2.5 overflow-y-auto">
            {paidServices.map(({ service: s, index: i }) => (
              <li key={s.name}>
                <label className="flex cursor-pointer items-center gap-2.5 text-[16px] text-[#121212]">
                  <input
                    type="checkbox"
                    checked={chosen.includes(i)}
                    onChange={() => toggleService(i)}
                    className="checkbox-brand"
                  />
                  <span className="min-w-0 flex-1">{s.name}</span>
                  <span className="shrink-0 text-[15px] font-semibold text-brand">
                    +${s.price.toFixed(2)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleReserve}
        disabled={!datesReady}
        className="mt-[25px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        Reserve
      </button>

      {/* Only shown when the guest actually tries to book a taken range. */}
      {showUnavailable && unavailable && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2.5 rounded-[10px] bg-[#fdecec] px-4 py-3 text-[15px] font-medium text-[#c0392b]"
        >
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c0392b] text-[13px] leading-none text-white"
          >
            !
          </span>
          <span>
            {roomBased
              ? `No rooms left for ${formatRange(checkIn, checkOut)}. Try fewer rooms or different dates.`
              : `This villa is already booked for ${formatRange(checkIn, checkOut)}. Please choose different dates.`}
          </span>
        </p>
      )}

      <dl className="mt-[45px] space-y-[18px] text-[20px] leading-[1.2] text-black">
        <div className="flex items-center justify-between">
          <dt>
            ${price}
            {roomBased ? ` × ${rooms} room${rooms === 1 ? "" : "s"}` : ""} ×{" "}
            {nights} night{nights === 1 ? "" : "s"}
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
        {chosenTotal > 0 && (
          <div className="flex items-center justify-between">
            <dt>Extra services</dt>
            <dd className="font-light">+${chosenTotal.toFixed(2)}</dd>
          </div>
        )}
      </dl>
      <hr className="mt-[25px] border-t border-[#c6c6c6]" />
      <div className="mt-5 flex items-center justify-between text-[20px] font-semibold leading-[1.2] text-[#121212]">
        <p>Total before taxes</p>
        <p>${(q.total + chosenTotal).toFixed(2)}</p>
      </div>
      {hasLongStayPackages && (
        <p className="mt-4 text-center text-[13px] text-[#7a7a85]">
          Stay 7+ nights for 15% off, 28+ nights for 30% off — applied automatically.
        </p>
      )}
    </aside>
  );
}
