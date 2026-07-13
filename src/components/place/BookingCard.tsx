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
  // Hotels/resorts: start with enough rooms to seat the guests carried from
  // search (e.g. 14 guests at 2 people/room → 7 rooms), capped at the inventory.
  const [roomsSel, setRoomsSel] = useState(
    roomBased
      ? Math.min(
          Math.max(1, totalRooms),
          Math.max(1, Math.ceil(Math.max(1, defaultGuests) / Math.max(1, peoplePerRoom))),
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

  // Extra services chosen in the Reserve dialog (indices into `services`). Only
  // paid services are offered — free ones come with the stay, so there's nothing
  // to opt into. Original indices are kept so checkout resolves prices from the
  // villa server-side.
  const paidServices = services
    .map((s, i) => ({ service: s, index: i }))
    .filter(({ service }) => service.price > 0);
  const [showServices, setShowServices] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  const chosenTotal = chosen.reduce((sum, i) => sum + (services[i]?.price ?? 0), 0);

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
    if (paidServices.length > 0) {
      setShowServices(true);
      return;
    }
    goToPayment([]);
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
          className="relative mt-[22px] flex cursor-pointer items-center justify-between rounded-[10px] border-[1.5px] border-[#ddd] p-[15px]"
        >
          <span className="min-w-0">
            <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
              Rooms
            </span>
            <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
              {rooms} {rooms === 1 ? "room" : "rooms"}
              {datesReady && (
                <span className="text-[#8a8a94]"> · {roomsMax} available</span>
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
            aria-label="Number of rooms"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
      </dl>
      <hr className="mt-[25px] border-t border-[#c6c6c6]" />
      <div className="mt-5 flex items-center justify-between text-[20px] font-semibold leading-[1.2] text-[#121212]">
        <p>Total before taxes</p>
        <p>${q.total.toFixed(2)}</p>
      </div>
      {hasLongStayPackages && (
        <p className="mt-4 text-center text-[13px] text-[#7a7a85]">
          Stay 7+ nights for 15% off, 28+ nights for 30% off — applied automatically.
        </p>
      )}

      {showServices && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add extra services"
          onClick={(e) => e.target === e.currentTarget && setShowServices(false)}
        >
          <div className="w-full max-w-[460px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <h3 className="text-[18px] font-semibold text-[#121212]">
              Add extra services
            </h3>
            <p className="mt-1 text-[13px] text-[#7a7a85]">
              Optional paid add-ons for your stay — pick any you&apos;d like and
              they&apos;re added to your total.
            </p>
            <ul className="mt-4 max-h-[300px] space-y-3 overflow-y-auto">
              {paidServices.map(({ service: s, index: i }) => (
                <li key={s.name}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#121212]">
                    <input
                      type="checkbox"
                      checked={chosen.includes(i)}
                      onChange={() =>
                        setChosen((cur) =>
                          cur.includes(i)
                            ? cur.filter((x) => x !== i)
                            : [...cur, i],
                        )
                      }
                      className="checkbox-brand"
                    />
                    <span className="min-w-0 flex-1">{s.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-brand">
                      +${s.price.toFixed(2)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <hr className="mt-4 border-t border-[#e3e3e8]" />
            <div className="mt-3 flex items-center justify-between text-[15px] font-semibold text-[#121212]">
              <span>Total before taxes</span>
              <span>${(q.total + chosenTotal).toFixed(2)}</span>
            </div>
            <div className="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => goToPayment([])}
                className="text-[14px] text-[#7a7a85] underline"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => goToPayment(chosen)}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
