"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DateRangeField from "@/components/home/DateRangeField";
import GuestPicker from "@/components/host/GuestPicker";
import { createOwnerBookingAction, resolveCallRequestAction } from "@/lib/actions";
import { BOOKING_WINDOW_MONTHS, formatRange, nightsBetween } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import type { GuestOption } from "@/lib/guests";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import { fullyBookedRanges, roomsFreeForRange, type RoomBooking } from "@/lib/rooms";

/* eslint-disable @next/next/no-img-element */

/** How far past the listed capacity the guest dropdown keeps going. The owner
 *  isn't bound by the listing's own occupancy, so the list has to reach beyond
 *  it — but a dropdown still needs an end, and a bounded run of options stays
 *  usable where an unbounded one wouldn't. */
const GUEST_HEADROOM = 10;

/**
 * The owner's own booking form — the counter version of the guest's BookingCard.
 * Same calendar, same rooms/add-ons, and the same pricing (so a 7+ night stay
 * still picks up its automatic discount). The differences are deliberate:
 *
 *  - it books FOR someone, so it starts with a guest picker;
 *  - the guest-facing caps don't apply (any length, any headcount, any number of
 *    the property's rooms);
 *  - there's no checkout HERE — the owner sends a payment request, and the
 *    guest's payment is what actually reserves the rooms. Until then the stay is
 *    pending and holds nothing, so this form can't take rooms off the market on
 *    a guest who may never pay.
 *
 * Rooms are still bounded by the inventory, and dates by what's actually free:
 * those aren't policies to waive, they're the building.
 */
export default function OwnerBookingCard({
  villaId,
  price,
  discount = 0,
  today,
  maxGuests,
  bookedRanges,
  services = [],
  roomBased = false,
  totalRooms = 1,
  peoplePerRoom = 0,
  roomBookings = [],
  defaultCheckIn,
  defaultCheckOut,
  defaultGuest = null,
  defaultRooms,
  defaultGuests,
  defaultServices = [],
  callRequestId,
}: {
  villaId: number;
  price: number;
  discount?: number;
  today: string;
  /** The listing's own guest capacity — shown as a hint, never enforced here. */
  maxGuests: number;
  bookedRanges: BookedRange[];
  services?: VillaService[];
  roomBased?: boolean;
  totalRooms?: number;
  /** Hotels/resorts: occupancy of one room — sizes the guest dropdown. */
  peoplePerRoom?: number;
  roomBookings?: RoomBooking[];
  defaultCheckIn: string;
  defaultCheckOut: string;
  /** Prefilled when fulfilling a call request — the guest who asked. Still
   *  changeable: the host may have agreed something else on the phone. */
  defaultGuest?: GuestOption | null;
  defaultRooms?: number;
  defaultGuests?: number;
  /** Paid add-ons to pre-tick, as indices into `services`. */
  defaultServices?: number[];
  /** The call request this booking answers. Closed once the booking is made, so
   *  a fulfilled request stops asking to be called back. */
  callRequestId?: number;
}) {
  const router = useRouter();
  const [guest, setGuest] = useState<GuestOption | null>(defaultGuest);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [roomsSel, setRoomsSel] = useState(Math.max(1, defaultRooms ?? 1));
  const [guestsSel, setGuestsSel] = useState(Math.max(1, defaultGuests ?? 2));
  const [chosen, setChosen] = useState<number[]>(() => {
    // Keep only indices that really are paid add-ons on this villa.
    const paid = new Set(
      services.map((s, i) => (s.price > 0 ? i : -1)).filter((i) => i >= 0),
    );
    return defaultServices.filter((i) => paid.has(i));
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startBooking] = useTransition();

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  // No upper bound on nights — an owner may book as long a stay as they like.
  const datesReady = nights >= 1 && checkIn >= today;

  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;

  const roomsFree = roomBased
    ? datesReady
      ? roomsFreeForRange(checkIn, checkOut, roomBookings, totalRooms)
      : totalRooms
    : 1;
  const soldOut = roomBased && datesReady && roomsFree === 0;
  // The whole property is offerable — the per-guest allowance that limits guests
  // doesn't apply to the owner.
  const rooms = roomBased ? Math.min(Math.max(1, roomsSel), Math.max(1, totalRooms)) : 1;

  // What the picked rooms actually sleep — same sum the guest's booking card
  // uses, so the owner sees the property's real capacity rather than a guess.
  const listedCapacity = roomBased
    ? Math.max(1, rooms * Math.max(1, peoplePerRoom))
    : Math.max(1, maxGuests);
  // The owner isn't held to it, though: the dropdown runs past the listed
  // capacity so they can seat a party the listing wouldn't advertise, and it
  // always covers whatever's already selected (a call request may ask for more
  // than the rooms nominally sleep).
  const guestOptions = Math.max(listedCapacity + GUEST_HEADROOM, guestsSel);
  const guests = Math.max(1, Math.min(guestsSel, guestOptions));
  const overCapacity = guests > listedCapacity;

  const unavailable =
    datesReady &&
    (calendarBlocked.some((r) => r.checkIn < checkOut && r.checkOut > checkIn) ||
      (roomBased && roomsFree < rooms));

  const paidServices = services
    .map((s, i) => ({ service: s, index: i }))
    .filter(({ service }) => service.price > 0);
  const chosenTotal = chosen.reduce((sum, i) => sum + (services[i]?.price ?? 0), 0);
  const toggleService = (i: number) =>
    setChosen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const q = quote(roomBased ? price * rooms : price, nights, discount);

  function handleReserve() {
    setError(null);
    if (!guest) {
      setError("Choose the guest this booking is for.");
      return;
    }
    if (!datesReady) {
      setError("Pick valid check-in and check-out dates.");
      return;
    }
    startBooking(async () => {
      const res = await createOwnerBookingAction({
        villaId,
        guestId: guest.id,
        checkIn,
        checkOut,
        guests,
        rooms,
        services: chosen,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Booking it answers the call request, so close it. Deliberately after
      // the booking and not gated on: if this fails the stay still stands, and
      // a request left open is a nuisance, not a broken booking.
      if (callRequestId) await resolveCallRequestAction(callRequestId);
      router.push(`/profile/requests?created=${res.reference}`);
    });
  }

  return (
    <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[48px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)]">
      <p className="text-black">
        <span className="text-[24px] font-semibold">${price} </span>
        <span className="text-[18px]">/ night</span>
      </p>

      <div className="mt-5">
        <p className="mb-2 text-[18px] font-medium leading-[1.2] text-[#121212]">
          Booking for
        </p>
        <GuestPicker value={guest} onChange={setGuest} invalid={!!error && !guest} />
      </div>

      {/* No maxNights: an owner-made booking has no length limit. */}
      <div className="mt-[22px]">
        <DateRangeField
          variant="booking"
          windowMonths={BOOKING_WINDOW_MONTHS}
          checkIn={checkIn || null}
          checkOut={checkOut || null}
          bookedRanges={calendarBlocked}
          onChange={(nextIn, nextOut) => {
            setCheckIn(nextIn ?? "");
            setCheckOut(nextOut ?? "");
            setError(null);
          }}
        />
      </div>

      {roomBased && (
        <label
          htmlFor="owner-rooms"
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
          {/* The whole inventory, with no per-guest allowance in the way. */}
          <select
            id="owner-rooms"
            value={rooms}
            onChange={(e) => setRoomsSel(Number(e.target.value))}
            aria-label="Number of rooms"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {Array.from({ length: Math.max(1, totalRooms) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "room" : "rooms"}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Same picker as the guest's booking card — the count is derived from the
          rooms picked above, and the invisible native select covers the whole box
          so clicking anywhere in it opens the list. */}
      <label
        htmlFor="owner-guests"
        className="relative mt-[22px] flex cursor-pointer items-center justify-between rounded-[10px] border-[1.5px] border-[#ddd] p-[15px]"
      >
        <span className="min-w-0">
          <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
            Guests
          </span>
          <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
            {guests} {guests === 1 ? "guest" : "guests"}
            {roomBased && (
              <span className="text-[#8a8a94]">
                {" "}
                · {rooms} {rooms === 1 ? "room" : "rooms"} sleep{" "}
                {listedCapacity}
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
          id="owner-guests"
          value={guests}
          onChange={(e) => setGuestsSel(Number(e.target.value))}
          aria-label="Number of guests"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {Array.from({ length: guestOptions }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
              {n > listedCapacity ? " (over capacity)" : ""}
            </option>
          ))}
        </select>
      </label>
      {overCapacity && (
        <p className="mt-2 text-[13px] leading-[1.4] text-[#a06a00]">
          That&rsquo;s more than the {listedCapacity} this listing advertises
          {roomBased ? " for that many rooms" : ""} — allowed here, just
          double-check it&rsquo;s what you meant.
        </p>
      )}

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
        disabled={!datesReady || pending || unavailable}
        className="mt-[25px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        {pending ? "Sending…" : "Send payment request"}
      </button>
      <p className="mt-2.5 text-center text-[13px] leading-[1.5] text-[#7a7a85]">
        The guest gets a payment request for this stay.{" "}
        <span className="font-medium text-[#a06a00]">
          The room{rooms === 1 ? " isn't" : "s aren't"} held until they pay
        </span>{" "}
        — until then it stays pending and someone else can still book{" "}
        {rooms === 1 ? "it" : "them"}.
      </p>

      {(error || unavailable) && (
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
            {error ??
              (roomBased
                ? `Only ${roomsFree} room${roomsFree === 1 ? "" : "s"} free for ${formatRange(checkIn, checkOut)}.`
                : `Already booked for ${formatRange(checkIn, checkOut)}.`)}
          </span>
        </p>
      )}

      <dl className="mt-[35px] space-y-[18px] text-[20px] leading-[1.2] text-black">
        <div className="flex items-center justify-between">
          <dt>
            ${price}
            {roomBased ? ` × ${rooms} room${rooms === 1 ? "" : "s"}` : ""} × {nights}{" "}
            night{nights === 1 ? "" : "s"}
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
    </aside>
  );
}
