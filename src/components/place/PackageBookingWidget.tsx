"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginHref } from "@/lib/returnTo";
import { addDays, addMonths, formatDay, BOOKING_WINDOW_MONTHS } from "@/lib/dates";
import {
  roomsForGuests,
  roomsFreeForRange,
  type RoomBooking,
} from "@/lib/rooms";
import type { BookedRange } from "@/lib/queries";
import StartDateField from "@/components/place/StartDateField";

/** Right-column booking card on the package detail page: the nights and guests
 *  are fixed by the package (shown, not chosen); the guest only picks a start
 *  date. Confirms to checkout with the package id — price/occupancy come from
 *  the DB server-side. */
export default function PackageBookingWidget({
  packageId,
  villaId,
  villaKind,
  nights,
  maxGuests,
  price,
  authed,
  today,
  bookedRanges,
  roomBookings,
  roomBased,
  totalRooms,
  peoplePerRoom,
  defaultStart = "",
}: {
  packageId: number;
  villaId: number;
  villaKind: string;
  nights: number;
  maxGuests: number;
  price: number;
  authed: boolean;
  today: string;
  bookedRanges: BookedRange[];
  roomBookings: RoomBooking[];
  roomBased: boolean;
  totalRooms: number;
  peoplePerRoom: number;
  /** Start date to preselect — set when returning here via checkout's "Edit". */
  defaultStart?: string;
}) {
  const router = useRouter();
  const [start, setStart] = useState(defaultStart);
  const checkOut = start ? addDays(start, nights) : "";
  const roomsNeeded = roomsForGuests(villaKind, maxGuests, peoplePerRoom);
  // Bookings can only start within the next few months — the calendar stops
  // there and a start beyond it is treated as unbookable.
  const maxDate = addMonths(today, BOOKING_WINDOW_MONTHS);

  // Can a fixed-length stay starting on `day` be booked? Drives both the chosen
  // date's validity and which start dates the calendar greys out.
  function spanAvailable(day: string): boolean {
    if (!day || day < today || day > maxDate) return false;
    const co = addDays(day, nights);
    return roomBased
      ? roomsFreeForRange(day, co, roomBookings, totalRooms) >= roomsNeeded
      : !bookedRanges.some((r) => r.checkIn < co && r.checkOut > day);
  }

  const available = !!start && spanAvailable(start);

  function book() {
    if (!start || !available) return;
    const url = `/payment?villa=${villaId}&in=${start}&pkg=${packageId}`;
    router.push(authed ? url : loginHref(url));
  }

  return (
    <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[40px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)] lg:mt-[60px]">
      <p className="text-black">
        <span className="text-[28px] font-semibold">${price}</span>{" "}
        <span className="text-[16px] text-[#4a4a4a]">all-inclusive</span>
      </p>

      {/* Fixed by the package — shown, not editable. */}
      <dl className="mt-5 space-y-3 text-[16px] text-[#121212]">
        <div className="flex items-center justify-between">
          <dt className="text-[#4a4a4a]">Duration</dt>
          <dd className="font-medium">
            {nights} night{nights === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[#4a4a4a]">Guests</dt>
          <dd className="font-medium">
            Up to {maxGuests} guest{maxGuests === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[#4a4a4a]">Reserves</dt>
          <dd className="font-medium">
            {roomBased
              ? `${roomsNeeded} room${roomsNeeded === 1 ? "" : "s"}`
              : "The whole villa"}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <StartDateField
          value={start}
          onChange={setStart}
          today={today}
          maxDate={maxDate}
          nights={nights}
          isUnavailable={(day) => !spanAvailable(day)}
          hasBlockedDates={bookedRanges.length > 0 || roomBookings.length > 0}
        />
      </div>
      {start && checkOut && (
        <p className="mt-2 text-[15px] text-[#4a4a4a]">
          {formatDay(start)} → {formatDay(checkOut)} ({nights} night
          {nights === 1 ? "" : "s"})
        </p>
      )}

      <button
        type="button"
        onClick={book}
        disabled={!available}
        className="mt-6 flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        Book this package
      </button>
      <p className="mt-3 text-center text-[13px] text-[#7a7a85]">
        One price covers the whole stay and every inclusion.
      </p>
    </aside>
  );
}
