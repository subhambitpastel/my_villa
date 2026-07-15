"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  nightsBetween,
  formatRange,
  BOOKING_WINDOW_MONTHS,
  MAX_STAY_NIGHTS,
} from "@/lib/dates";
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
import {
  allowanceFree,
  fullyBookedRanges,
  MAX_ROOMS_PER_GUEST,
  roomsFreeForRange,
  type RoomBooking,
} from "@/lib/rooms";

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
  /** The listing has been archived: this stay still goes ahead, but its dates are
   *  frozen (the server refuses a re-date). Rooms, guests and add-ons stay
   *  editable, and cancelling is always allowed. */
  archived: boolean;
};

/** Shown in place of the date picker on an archived listing. */
function ArchivedDatesNotice({ packageStay }: { packageStay: boolean }) {
  return (
    <p className="mt-3 rounded-[10px] bg-[#fff6e5] px-4 py-3 text-[14px] leading-[1.5] text-[#a06a00]">
      The host has stopped taking new bookings here, so these dates are fixed.
      Your stay goes ahead exactly as booked
      {packageStay
        ? "."
        : " — you can still change rooms, guests and add-ons below."}{" "}
      If the dates no longer work, cancel the booking instead.
    </p>
  );
}

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
  myRoomBookings = [],
  discount = 0,
  packageStay = null,
  services = [],
  originalExtras = [],
  originalTotal = 0,
  archived = false,
}: {
  bookingId: number;
  villaId: number;
  price: number;
  /** The villa (or this stay's package) is archived — dates frozen, the rest of
   *  the booking still editable. Mirrors the server-side guard. */
  archived?: boolean;
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
  /** This guest's OTHER rooms at the villa (this booking excluded). The per-guest
   *  cap counts against them here exactly as it does when booking, so editing
   *  can't offer rooms modifyBookingAction would refuse. */
  myRoomBookings?: RoomBooking[];
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

  // Cancellation is only allowed while the whole stay is still ahead — strictly
  // before the check-in (start) date. On or after check-in the stay has begun,
  // so the cancel option is dropped. (Check-out is always later than check-in,
  // so this also guarantees both dates are in the future.)
  const canCancel = checkIn > today;

  // Shared footer: cancel + back + message. Rendered by whichever sub-card runs.
  const footer = (
    <>
      {canCancel && (
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
                  A booking can only be cancelled before its check-in date.
                  Cancel now and you&apos;ll get a{" "}
                  <span className="font-semibold text-[#121212]">50% refund</span>{" "}
                  of your booking total. Once your stay begins it can no longer be
                  cancelled.
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

  const shared: Shared = {
    bookingId,
    pending,
    startTransition,
    setMessage,
    router,
    footer,
    archived,
  };

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
      myRoomBookings={myRoomBookings}
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
  myRoomBookings,
  discount,
  services,
  originalExtras,
  originalTotal,
  pending,
  startTransition,
  setMessage,
  router,
  footer,
  archived,
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
  myRoomBookings: RoomBooking[];
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
  const datesReady = nights >= 1 && nights <= MAX_STAY_NIGHTS && checkIn >= today;

  // This booking's own rooms are already excluded from the ranges passed in.
  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;
  const roomsFree = roomBased
    ? datesReady
      ? roomsFreeForRange(checkIn, checkOut, roomBookings, totalRooms)
      : totalRooms
    : 1;
  // What's left of this guest's per-night allowance, counting their OTHER stays
  // here (this booking is excluded, so re-saving its own rooms never counts
  // against itself — same exclusion modifyBookingAction uses).
  const allowanceLeft = roomBased
    ? datesReady
      ? allowanceFree(checkIn, checkOut, myRoomBookings)
      : MAX_ROOMS_PER_GUEST
    : 1;
  // The ceiling is the SAME here as when booking: the hotel's free inventory and
  // the guest's own allowance, whichever is tighter. Offering the full inventory
  // would let someone edit their way to 12 rooms when booking caps them at 6 —
  // and modifyBookingAction would refuse it anyway.
  const roomsMax = roomBased
    ? Math.max(1, Math.min(roomsFree, allowanceLeft))
    : 1;
  const rooms = roomBased ? Math.min(roomsSel, roomsMax) : 1;
  // They're pinned below the inventory by their own rooms elsewhere — say so,
  // rather than letting the picker just stop for no visible reason.
  const cappedByAllowance = roomBased && datesReady && allowanceLeft < roomsFree;
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

      {/* Archived: the dates are settled, so show them read-only rather than a
          picker that would only be refused on save. Everything below stays
          editable — that's the whole point of the narrower rule. */}
      <div className="mt-5">
        {archived ? (
          <>
            <div className="rounded-[10px] border-[1.5px] border-[#ddd] p-[15px]">
              <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
                Your dates
              </span>
              <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
                {formatRange(checkIn, checkOut)} · {nights} night
                {nights === 1 ? "" : "s"}
              </span>
            </div>
            <ArchivedDatesNotice packageStay={false} />
          </>
        ) : (
          /* No maxNights — same as the booking card: a longer stay is allowed
             to be PICKED, and the note under the button explains it's arranged
             through the host rather than leaving days mysteriously dead. */
          <DateRangeField
            variant="booking"
            windowMonths={BOOKING_WINDOW_MONTHS}
            checkIn={checkIn || null}
            checkOut={checkOut || null}
            bookedRanges={calendarBlocked}
            onChange={(nextIn, nextOut) => {
              setCheckIn(nextIn ?? "");
              setCheckOut(nextOut ?? "");
              setShowUnavailable(false);
            }}
          />
        )}
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
                  {/* Say WHY the picker stops short of the inventory. */}
                  {cappedByAllowance && (
                    <span className="text-[#8a6a1f]">
                      {" "}
                      · you can hold {allowanceLeft} more here
                    </span>
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

      {/* Same line the booking card draws: online stays cap at MAX_STAY_NIGHTS.
          A silent disabled button reads as broken — say why, and where a longer
          stay CAN be arranged. */}
      {nights > MAX_STAY_NIGHTS && (
        <p className="mt-[22px] rounded-[10px] border border-[#e8d5a3] bg-[#fdf9f0] px-4 py-3 text-[14px] leading-[1.45] text-[#7a6a45]">
          <span className="font-medium text-[#8a6a1f]">
            {nights} nights is longer than the {MAX_STAY_NIGHTS}-night online
            limit.
          </span>{" "}
          To stay longer, request a call from the host on the property&rsquo;s
          page and they&rsquo;ll arrange it directly.
        </p>
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
  archived,
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
  // Rebooking a package stay is capped to the same window as a fresh booking.
  const maxDate = addMonths(today, BOOKING_WINDOW_MONTHS);

  function spanAvailable(day: string): boolean {
    if (!day || day < today || day > maxDate) return false;
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

      {/* Archived package (or villa): the start date is frozen, and a package
          fixes everything else already — so there's nothing left to edit here
          beyond cancelling. */}
      <div className="mt-5">
        {archived ? (
          <>
            <div className="rounded-[10px] border-[1.5px] border-[#ddd] p-[15px]">
              <span className="block text-[15px] font-medium leading-[1.2] text-[#121212]">
                Your start date
              </span>
              <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
                {formatRange(checkIn, checkOut)} · {stayNights} night
                {stayNights === 1 ? "" : "s"}
              </span>
            </div>
            <ArchivedDatesNotice packageStay />
          </>
        ) : (
          <StartDateField
            value={checkIn}
            onChange={(day) => {
              setCheckIn(day);
              setCheckOut(addDays(day, stayNights));
            }}
            today={today}
            maxDate={maxDate}
            nights={stayNights}
            isUnavailable={(day) => !spanAvailable(day)}
            hasBlockedDates={calendarBlocked.length > 0}
          />
        )}
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
