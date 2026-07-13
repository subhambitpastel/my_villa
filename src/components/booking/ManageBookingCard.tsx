"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nightsBetween, formatRange } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { updateBookingAction, cancelBookingAction } from "@/lib/actions";
import DateRangeField from "@/components/home/DateRangeField";
import type { BookedRange } from "@/lib/queries";
import { fullyBookedRanges, type RoomBooking } from "@/lib/rooms";

/* eslint-disable @next/next/no-img-element */

export default function ManageBookingCard({
  bookingId,
  price,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
  maxGuests,
  today,
  bookedRanges,
  roomBased = false,
  totalRooms = 1,
  peoplePerRoom = 0,
  rooms = 1,
  roomBookings = [],
  discount = 0,
}: {
  bookingId: number;
  price: number;
  /** Host-set % off the nightly price (applied in the quote). */
  discount?: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxGuests: number;
  today: string;
  /** Confirmed stays that block dates — this booking is already excluded. */
  bookedRanges: BookedRange[];
  /** Hotels/resorts: this reservation holds a fixed number of rooms; dates and
   *  guests can change but the room count is set at booking time. */
  roomBased?: boolean;
  totalRooms?: number;
  peoplePerRoom?: number;
  rooms?: number;
  roomBookings?: RoomBooking[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Guest cap: the rooms this booking holds × people-per-room (hotels/resorts),
  // else the whole-villa capacity.
  const guestCap = roomBased
    ? Math.max(1, rooms * peoplePerRoom)
    : Math.max(1, maxGuests);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(
    Math.min(Math.max(1, initialGuests), guestCap),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Sold-out days (excluding this booking's own rooms) block the calendar.
  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const datesReady = nights >= 1 && checkIn >= today;
  const changed =
    checkIn !== initialCheckIn ||
    checkOut !== initialCheckOut ||
    guests !== initialGuests;
  const q = quote(price * (roomBased ? rooms : 1), nights, discount);

  function saveChanges() {
    if (!datesReady || !changed || pending) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateBookingAction(bookingId, {
        checkIn,
        checkOut,
        guests,
      });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({
        ok: true,
        text: `Booking updated to ${formatRange(checkIn, checkOut)} for ${guests} guest${guests === 1 ? "" : "s"}.`,
      });
      router.refresh();
    });
  }

  function cancelBooking() {
    if (pending) return;
    startTransition(async () => {
      const res = await cancelBookingAction(bookingId);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        setConfirmingCancel(false);
        return;
      }
      router.push("/profile/bookings");
      router.refresh();
    });
  }

  return (
    <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[48px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)] lg:mt-[60px]">
      <div className="flex items-center justify-between">
        <p className="text-black">
          <span className="text-[24px] font-semibold">${price} </span>
          <span className="text-[18px]">/ night</span>
        </p>
        <span className="rounded-[6px] bg-[#e9e8fd] px-3 py-1 text-[13px] font-semibold text-brand">
          Confirmed
        </span>
      </div>

      {/* Same calendar range picker as the villa page — this booking's own dates
          are NOT blocked, so the guest can keep or adjust them. */}
      <div className="mt-5">
        <DateRangeField
          variant="booking"
          checkIn={checkIn || null}
          checkOut={checkOut || null}
          bookedRanges={calendarBlocked}
          onChange={(nextIn, nextOut) => {
            setCheckIn(nextIn ?? "");
            setCheckOut(nextOut ?? "");
          }}
        />
      </div>

      {roomBased && (
        <div className="mt-[22px] flex items-center justify-between rounded-[10px] border-[1.5px] border-[#ddd] bg-[#faf9ff] p-[15px]">
          <span className="text-[18px] font-medium leading-[1.2] text-[#121212]">
            Rooms
          </span>
          <span className="text-[16px] leading-[1.2] text-[#4a4a4a]">
            {rooms} {rooms === 1 ? "room" : "rooms"} reserved
          </span>
        </div>
      )}

      {/* Guest picker — capped by the rooms this booking holds. */}
      <label
        htmlFor="manage-guests"
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
          id="manage-guests"
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
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
        onClick={saveChanges}
        disabled={!datesReady || !changed || pending}
        className="mt-[25px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        {pending ? "Saving…" : changed ? "Update Booking" : "No changes to save"}
      </button>

      {!confirmingCancel ? (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setConfirmingCancel(true);
          }}
          disabled={pending}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-[10px] border border-[#eb5757] text-[18px] font-medium text-[#eb5757] transition-colors hover:bg-[#eb5757]/5 disabled:opacity-50"
        >
          Cancel Booking
        </button>
      ) : (
        <div className="mt-4 rounded-[10px] border border-[#eb5757]/40 bg-[#fdecec] p-4">
          <p className="text-[15px] font-medium text-[#c0392b]">
            Cancel this booking? This can&apos;t be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={cancelBooking}
              disabled={pending}
              className="flex-1 rounded-[8px] bg-[#eb5757] px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
            >
              {pending ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={pending}
              className="flex-1 rounded-[8px] border border-[#c6c6c6] px-4 py-2.5 text-[15px] font-medium text-[#121212] transition-colors hover:bg-black/5 disabled:opacity-60"
            >
              Keep booking
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-4 rounded-[8px] px-4 py-3 text-[14px] ${
            message.ok
              ? "bg-brand/10 text-brand-dark"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <dl className="mt-[40px] space-y-[18px] text-[20px] leading-[1.2] text-black">
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
    </aside>
  );
}
