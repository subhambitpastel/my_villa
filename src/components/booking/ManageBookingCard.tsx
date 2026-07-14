"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, nightsBetween, formatRange, formatMonthDay } from "@/lib/dates";
import { quote, bookingReference } from "@/lib/pricing";
import {
  updateBookingAction,
  cancelBookingAction,
  modifyBookingAction,
} from "@/lib/actions";
import StartDateField from "@/components/place/StartDateField";
import DateRangeField from "@/components/home/DateRangeField";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import { fullyBookedRanges, roomsFreeForRange, type RoomBooking } from "@/lib/rooms";

/* eslint-disable @next/next/no-img-element */

const round2 = (n: number) => Math.round(n * 100) / 100;

type Message = { ok: boolean; text: string } | null;

/** Props the two sub-cards share (transition, messaging, navigation, footer). */
type Shared = {
  bookingId: number;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setMessage: (m: Message) => void;
  router: ReturnType<typeof useRouter>;
  footer: React.ReactNode;
};

export default function ManageBookingCard({
  bookingId,
  villaId,
  price,
  checkIn,
  checkOut,
  guests,
  maxGuests,
  today,
  bookedRanges,
  roomBased = false,
  totalRooms = 1,
  peoplePerRoom = 0,
  rooms = 1,
  roomBookings = [],
  discount = 0,
  packageStay = null,
  services = [],
  originalExtras = [],
  originalTotal = 0,
}: {
  bookingId: number;
  villaId: number;
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
  /** Hotels/resorts: this reservation holds a number of rooms; on a nightly stay
   *  the guest may now change the room count too. */
  roomBased?: boolean;
  totalRooms?: number;
  peoplePerRoom?: number;
  rooms?: number;
  roomBookings?: RoomBooking[];
  /** Set when this booking is a package: its length, occupancy and price are
   *  fixed, so the guest may only shift the start date. */
  packageStay?: { nights: number; price: number } | null;
  /** The villa's paid add-ons, offered here so the guest can add/remove them. */
  services?: VillaService[];
  /** Indices (into `services`) of the add-ons this booking currently has. */
  originalExtras?: number[];
  /** What this booking's stay currently totals at today's price — the figure the
   *  new total is reconciled against (pay the difference / refund the difference). */
  originalTotal?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

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

  // Refund-policy windows for the cancel warning — the same ones checkout showed:
  // free cancellation up to 2 days before check-in (12:00 PM), then a partial
  // refund (minus the first night + service fee) up to 1 day before.
  const freeCancelBy = formatMonthDay(addDays(checkIn, -2));
  const partialCancelBy = formatMonthDay(addDays(checkIn, -1));

  // Once the check-in date has passed, the stay has begun and can no longer be
  // cancelled — so the cancel option is dropped for it.
  const startPassed = checkIn < today;

  // Shared footer: cancel + back + message. Rendered by whichever sub-card runs.
  const footer = (
    <>
      {!startPassed && (
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
      )}

      <button
        type="button"
        onClick={() => router.push("/profile/bookings")}
        disabled={pending}
        className="mt-4 w-full text-center text-[15px] font-medium text-[#4a4a4a] underline transition-colors hover:text-[#121212] disabled:opacity-50"
      >
        Back to My Bookings
      </button>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-4 rounded-[8px] px-4 py-3 text-[14px] ${
            message.ok ? "bg-brand/10 text-brand-dark" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Confirmation popup: warns how the refund works before cancelling. */}
      {confirmingCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm cancelling your booking"
          onClick={(e) =>
            e.target === e.currentTarget && !pending && setConfirmingCancel(false)
          }
        >
          <div className="w-full max-w-[460px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdecec] text-[#eb5757]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Cancel this booking?
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Free cancellation before 12:00 PM on{" "}
                  <span className="font-semibold text-[#121212]">{freeCancelBy}</span>.
                  After that, cancel before 12:00 PM on{" "}
                  <span className="font-semibold text-[#121212]">
                    {partialCancelBy}
                  </span>{" "}
                  and get a full refund, minus the first night and service fee.
                </p>
                <p className="mt-2 text-[13px] font-medium text-[#c0392b]">
                  This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={cancelBooking}
                disabled={pending}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Yes, cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const shared: Shared = { bookingId, pending, startTransition, setMessage, router, footer };

  if (packageStay) {
    return (
      <PackageManageCard
        {...shared}
        packageStay={packageStay}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        today={today}
        bookedRanges={bookedRanges}
        roomBased={roomBased}
        totalRooms={totalRooms}
        rooms={rooms}
        roomBookings={roomBookings}
      />
    );
  }

  return (
    <NightlyManageCard
      {...shared}
      villaId={villaId}
      price={price}
      checkIn={checkIn}
      checkOut={checkOut}
      guests={guests}
      maxGuests={maxGuests}
      today={today}
      bookedRanges={bookedRanges}
      roomBased={roomBased}
      totalRooms={totalRooms}
      peoplePerRoom={peoplePerRoom}
      rooms={rooms}
      roomBookings={roomBookings}
      discount={discount}
      services={services}
      originalExtras={originalExtras}
      originalTotal={originalTotal}
    />
  );
}

/* ─────────────────────────── Nightly: full editor ─────────────────────────── */
// Change any part of the stay — dates, length, rooms, guests, add-ons — then
// reconcile: a higher total sends the guest to checkout to pay the difference,
// a lower total is applied at once with a refund of the difference.
function NightlyManageCard({
  bookingId,
  villaId,
  price,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
  maxGuests,
  today,
  bookedRanges,
  roomBased,
  totalRooms,
  peoplePerRoom,
  rooms: initialRooms,
  roomBookings,
  discount,
  services,
  originalExtras,
  originalTotal,
  pending,
  startTransition,
  setMessage,
  router,
  footer,
}: Shared & {
  villaId: number;
  price: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxGuests: number;
  today: string;
  bookedRanges: BookedRange[];
  roomBased: boolean;
  totalRooms: number;
  peoplePerRoom: number;
  rooms: number;
  roomBookings: RoomBooking[];
  discount: number;
  services: VillaService[];
  originalExtras: number[];
  originalTotal: number;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [roomsSel, setRoomsSel] = useState(Math.max(1, initialRooms));
  const [guestsSel, setGuestsSel] = useState(Math.max(1, initialGuests));
  const paidServices = services
    .map((s, i) => ({ service: s, index: i }))
    .filter(({ service }) => service.price > 0);
  const [chosen, setChosen] = useState<number[]>(() => {
    const paid = new Set(paidServices.map((p) => p.index));
    return originalExtras.filter((i) => paid.has(i));
  });
  const [showUnavailable, setShowUnavailable] = useState(false);

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const datesReady = nights >= 1 && checkIn >= today;

  // This booking's own rooms are already excluded from the ranges passed in.
  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;
  const roomsFree = roomBased
    ? datesReady
      ? roomsFreeForRange(checkIn, checkOut, roomBookings, totalRooms)
      : totalRooms
    : 1;
  const roomsMax = Math.max(1, roomsFree);
  const rooms = roomBased ? Math.min(roomsSel, roomsMax) : 1;
  const soldOut = roomBased && datesReady && roomsFree === 0;
  const guestCap = roomBased
    ? Math.max(1, rooms * peoplePerRoom)
    : Math.max(1, maxGuests);
  const guests = Math.min(Math.max(1, guestsSel), guestCap);

  const unavailable =
    datesReady &&
    (calendarBlocked.some((r) => r.checkIn < checkOut && r.checkOut > checkIn) ||
      (roomBased && roomsFree < rooms));

  const q = quote(roomBased ? price * rooms : price, nights, discount);
  const chosenTotal = chosen.reduce((sum, i) => sum + (services[i]?.price ?? 0), 0);
  const newTotal = round2(q.total + chosenTotal);
  const delta = round2(newTotal - originalTotal);

  const chosenKey = [...chosen].sort((a, b) => a - b).join(",");
  const origKey = [...originalExtras].sort((a, b) => a - b).join(",");
  const changed =
    checkIn !== initialCheckIn ||
    checkOut !== initialCheckOut ||
    rooms !== initialRooms ||
    guests !== initialGuests ||
    chosenKey !== origKey;

  const toggleService = (i: number) =>
    setChosen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  function handleUpdate() {
    if (!datesReady || !changed || pending) return;
    if (unavailable) {
      setShowUnavailable(true);
      return;
    }
    setMessage(null);
    // A higher total sends the guest to checkout to pay the difference; the
    // booking is only rewritten once that top-up is confirmed there.
    if (delta > 0) {
      const svc = chosen.length > 0 ? `&svc=${chosen.join(",")}` : "";
      router.push(
        `/payment?villa=${villaId}&in=${checkIn}&out=${checkOut}&guests=${guests}` +
          `${roomBased ? `&rooms=${rooms}` : ""}${svc}&modify=${bookingId}`,
      );
      return;
    }
    // Same or lower total: apply now and refund the difference (if any).
    startTransition(async () => {
      const res = await modifyBookingAction(bookingId, {
        checkIn,
        checkOut,
        guests,
        rooms,
        serviceIdx: chosen,
      });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      const refund = delta < 0 ? -delta : 0;
      router.push(
        `/booking/confirmed?ref=${bookingReference(bookingId)}&mode=modified&refund=${refund.toFixed(2)}`,
      );
      router.refresh();
    });
  }

  const updateLabel = pending
    ? "Processing…"
    : !changed
      ? "No changes to save"
      : delta > 0
        ? `Pay $${delta.toFixed(2)} more`
        : delta < 0
          ? `Update & refund $${(-delta).toFixed(2)}`
          : "Update Booking";

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

      {roomBased && (
        <label
          htmlFor="manage-rooms"
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
            id="manage-rooms"
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
        onClick={handleUpdate}
        disabled={!datesReady || !changed || pending}
        className="mt-[25px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        {updateLabel}
      </button>

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

      {footer}

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
        {chosenTotal > 0 && (
          <div className="flex items-center justify-between">
            <dt>Extra services</dt>
            <dd className="font-light">+${chosenTotal.toFixed(2)}</dd>
          </div>
        )}
      </dl>
      <hr className="mt-[25px] border-t border-[#c6c6c6]" />
      <div className="mt-5 flex items-center justify-between text-[20px] font-semibold leading-[1.2] text-[#121212]">
        <p>New total before taxes</p>
        <p>${newTotal.toFixed(2)}</p>
      </div>

      {changed && delta !== 0 && (
        <p
          className={`mt-4 rounded-[8px] px-4 py-3 text-[15px] font-medium ${
            delta > 0 ? "bg-brand/10 text-brand-dark" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {delta > 0
            ? `That's $${delta.toFixed(2)} more than you've paid — you'll settle the difference on the next step.`
            : `That's $${(-delta).toFixed(2)} less — we'll refund $${(-delta).toFixed(2)} to your original payment method.`}
        </p>
      )}
    </aside>
  );
}

/* ─────────────────────── Package: start-date only ─────────────────────── */
// A package's length/occupancy/price are fixed — the guest may only move the
// start date (the whole span shifts, price unchanged).
function PackageManageCard({
  bookingId,
  packageStay,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests,
  today,
  bookedRanges,
  roomBased,
  totalRooms,
  rooms,
  roomBookings,
  pending,
  startTransition,
  setMessage,
  router,
  footer,
}: Shared & {
  packageStay: { nights: number; price: number };
  checkIn: string;
  checkOut: string;
  guests: number;
  today: string;
  bookedRanges: BookedRange[];
  roomBased: boolean;
  totalRooms: number;
  rooms: number;
  roomBookings: RoomBooking[];
}) {
  const stayNights = packageStay.nights;
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);

  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;

  function spanAvailable(day: string): boolean {
    if (!day || day < today) return false;
    const co = addDays(day, stayNights);
    return roomBased
      ? roomsFreeForRange(day, co, roomBookings, totalRooms) >= rooms
      : !calendarBlocked.some((r) => r.checkIn < co && r.checkOut > day);
  }

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const datesReady = nights >= 1 && checkIn >= today;
  const changed = checkIn !== initialCheckIn || checkOut !== initialCheckOut;

  function saveChanges() {
    if (!datesReady || !changed || pending) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateBookingAction(bookingId, { checkIn, checkOut, guests });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
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
          <span className="text-[24px] font-semibold">
            ${packageStay.price.toFixed(2)}{" "}
          </span>
          <span className="text-[18px]">all-inclusive</span>
        </p>
        <span className="rounded-[6px] bg-[#e9e8fd] px-3 py-1 text-[13px] font-semibold text-brand">
          Confirmed
        </span>
      </div>

      <div className="mt-5">
        <StartDateField
          value={checkIn}
          onChange={(day) => {
            setCheckIn(day);
            setCheckOut(addDays(day, stayNights));
          }}
          today={today}
          nights={stayNights}
          isUnavailable={(day) => !spanAvailable(day)}
          hasBlockedDates={calendarBlocked.length > 0}
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

      <div className="mt-[22px] flex items-center justify-between rounded-[10px] border-[1.5px] border-[#ddd] bg-[#faf9ff] p-[15px]">
        <span className="text-[18px] font-medium leading-[1.2] text-[#121212]">
          Guests
        </span>
        <span className="text-[16px] leading-[1.2] text-[#4a4a4a]">
          {guests} {guests === 1 ? "guest" : "guests"} · set by package
        </span>
      </div>

      <button
        type="button"
        onClick={saveChanges}
        disabled={!datesReady || !changed || pending}
        className="mt-[25px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/40"
      >
        {pending ? "Saving…" : changed ? "Update Booking" : "No changes to save"}
      </button>

      {footer}

      <dl className="mt-[40px] space-y-[18px] text-[20px] leading-[1.2] text-black">
        <div className="flex items-center justify-between">
          <dt>
            {packageStay.nights} night{packageStay.nights === 1 ? "" : "s"} ·
            all-inclusive
          </dt>
          <dd className="font-light">${packageStay.price.toFixed(2)}</dd>
        </div>
      </dl>
      <hr className="mt-[25px] border-t border-[#c6c6c6]" />
      <div className="mt-5 flex items-center justify-between text-[20px] font-semibold leading-[1.2] text-[#121212]">
        <p>Total (USD)</p>
        <p>${packageStay.price.toFixed(2)}</p>
      </div>
    </aside>
  );
}
