"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DateRangeField from "@/components/home/DateRangeField";
import GuestPicker from "@/components/host/GuestPicker";
import PickerField from "@/components/ui/PickerField";
import { createOwnerBookingAction, resolveCallRequestAction } from "@/lib/actions";
import { BOOKING_WINDOW_MONTHS, formatRange, nightsBetween } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import type { GuestOption } from "@/lib/guests";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import {
  fullyBookedRanges,
  isGraduated,
  planMinRooms,
  planRoomNights,
  roomPlanFor,
  roomsFreeForRange,
  type RoomBooking,
} from "@/lib/rooms";



/**
 * The owner's own booking form — the counter version of the guest's BookingCard.
 * Same calendar, same rooms/add-ons, and the same pricing (so a 7+ night stay
 * still picks up its automatic discount). The differences are deliberate:
 *
 *  - it books FOR someone, so it starts with a guest picker;
 *  - the guest-facing caps don't apply (any length, any number of the
 *    property's rooms — but never more PEOPLE than those rooms sleep: beds
 *    are physics, not policy);
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
  roomBookingsExclGuest,
  guestHeld = [],
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
  /** Availability with the prefilled guest's own stays left out — their
   *  overlapping rooms fold into this booking rather than blocking it. Only
   *  meaningful while booking for that guest. */
  roomBookingsExclGuest?: RoomBooking[];
  /** The prefilled guest's own holdings here, to preview the fold. */
  guestHeld?: RoomBooking[];
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
  // Owner's discount for this booking: percent of the total, or a fixed amount.
  const [discMode, setDiscMode] = useState<"pct" | "fixed">("pct");
  const [discVal, setDiscVal] = useState("");
  const discNum = Math.max(0, Number(discVal) || 0);
  // When the ask can't be held every night: true = fulfil with what each night
  // has (the graduated plan), false = drop to the flat count that fits.
  const [flexSel, setFlexSel] = useState(true);

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  // No upper bound on nights — an owner may book as long a stay as they like.
  const datesReady = nights >= 1 && checkIn >= today;

  // While booking for the PREFILLED guest, their own stays don't block: an
  // overlapping one is folded into this booking (upgraded in place, what they
  // paid credited), so its rooms are available to the upgrade. Switching to a
  // different guest falls back to the full picture.
  const forPrefilled =
    !!guest && !!defaultGuest && guest.id === defaultGuest.id;
  const bookings =
    forPrefilled && roomBookingsExclGuest ? roomBookingsExclGuest : roomBookings;
  // The prefilled guest's stays that overlap the picked dates — these are what
  // the booking would absorb. Shown so the owner confirms the fold knowingly.
  const folded = forPrefilled
    ? guestHeld.filter((b) => b.checkIn < checkOut && b.checkOut > checkIn)
    : [];
  const foldedRooms = folded.reduce((max, b) => Math.max(max, b.rooms), 0);
  const unionIn = folded.reduce((d, b) => (b.checkIn < d ? b.checkIn : d), checkIn);
  const unionOut = folded.reduce(
    (d, b) => (b.checkOut > d ? b.checkOut : d),
    checkOut,
  );

  const calendarBlocked = roomBased
    ? fullyBookedRanges(bookings, totalRooms)
    : bookedRanges;

  const roomsFree = roomBased
    ? datesReady
      ? roomsFreeForRange(checkIn, checkOut, bookings, totalRooms)
      : totalRooms
    : 1;
  const soldOut = roomBased && datesReady && roomsFree === 0;
  // The whole property is offerable — the per-guest allowance that limits guests
  // doesn't apply to the owner.
  const rooms = roomBased ? Math.min(Math.max(1, roomsSel), Math.max(1, totalRooms)) : 1;

  /* The ask isn't free every night but each night still has SOMETHING: the same
     graduated plan a guest can self-serve, bounded by inventory alone (a host
     has no per-guest allowance). Left out while a fold is in play — an upgrade
     replaces the guest's stay with one flat count, and stacking a varying plan
     on top would change what the merge stores. */
  const plan =
    roomBased && datesReady && !soldOut && folded.length === 0
      ? roomPlanFor(checkIn, checkOut, bookings, totalRooms, rooms, [], Infinity)
      : [];
  const canAdjust = isGraduated(plan);
  const adjusted = canAdjust && flexSel;
  // What a FLAT fulfilment holds: the leanest night. Only differs from the ask
  // when the calendar can't meet it.
  const effRooms = adjusted ? rooms : canAdjust ? planMinRooms(plan) : rooms;

  // What the picked rooms actually sleep — same sum the guest's booking card
  // uses (an adjusted stay sums what EACH leg sleeps), so the owner sees the
  // property's real capacity rather than a guess.
  const listedCapacity = roomBased
    ? Math.max(
        1,
        adjusted
          ? plan.reduce((s, leg) => s + leg.rooms * Math.max(1, peoplePerRoom), 0)
          : effRooms * Math.max(1, peoplePerRoom),
      )
    : Math.max(1, maxGuests);
  // And the owner IS held to it: the rooms sleep what they sleep. A call
  // request asking for more people than the picked rooms hold simply clamps —
  // the owner adds rooms (or arranges differently), never oversells beds.
  const guests = Math.max(1, Math.min(guestsSel, listedCapacity));

  const unavailable =
    datesReady &&
    (calendarBlocked.some((r) => r.checkIn < checkOut && r.checkOut > checkIn) ||
      // An adjusted plan is feasible by construction — the bottleneck test only
      // applies to flat stays.
      (roomBased && !adjusted && roomsFree < effRooms));

  const paidServices = services
    .map((s, i) => ({ service: s, index: i }))
    .filter(({ service }) => service.price > 0);
  const chosenTotal = chosen.reduce((sum, i) => sum + (services[i]?.price ?? 0), 0);
  const toggleService = (i: number) =>
    setChosen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  // An adjusted stay bills its real room-nights (the same unit-price trick the
  // guest card uses); flat stays price exactly as before.
  const roomNights = adjusted
    ? planRoomNights(plan)
    : effRooms * Math.max(1, nights);
  const q = quote(
    roomBased ? (price * roomNights) / Math.max(1, nights) : price,
    nights,
    discount,
  );
  const fullTotal = q.total + chosenTotal;

  // What the guest already paid for the stays this booking folds in — the same
  // quote their checkout used, so this preview matches the credit the server
  // stores at fulfilment (their add-ons aside). Comes off what they're asked
  // to pay, since that money has already changed hands.
  const creditPreview = folded.reduce(
    (sum, b) =>
      sum +
      quote(
        roomBased ? price * Math.max(1, b.rooms) : price,
        Math.max(1, nightsBetween(b.checkIn, b.checkOut)),
        discount,
      ).total,
    0,
  );

  // The owner's own discount — a % of the total or a fixed amount off, whatever
  // was agreed on the phone. Stored on the booking so the guest's payment page
  // shows exactly this figure.
  const discAmount =
    discMode === "pct"
      ? Math.round(((fullTotal * Math.min(90, discNum)) / 100) * 100) / 100
      : Math.min(fullTotal, Math.round(discNum * 100) / 100);

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
        // Adjusted: send the ASK with the flex flag — the server re-derives
        // the same plan in its transaction. Flat: send what actually fits.
        rooms: adjusted ? rooms : effRooms,
        services: chosen,
        discPct: discMode === "pct" ? Math.min(90, Math.trunc(discNum)) : 0,
        discFixed: discMode === "fixed" ? discNum : 0,
        flex: adjusted,
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

      {/* The whole inventory, with no per-guest allowance in the way. */}
      {roomBased && (
        <PickerField
          label="Rooms"
          ariaLabel="Number of rooms"
          value={rooms}
          onChange={(n) => setRoomsSel(n)}
          disabled={soldOut}
          boxClassName={soldOut ? "border-[#f0c4c0]" : "border-[#ddd]"}
          options={Array.from({ length: Math.max(1, totalRooms) }, (_, i) => i + 1).map(
            (n) => ({
              value: n,
              label: `${n} ${n === 1 ? "room" : "rooms"}`,
            }),
          )}
          display={
            soldOut ? (
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
            )
          }
        />
      )}

      {/* The ask can't be held every night — show what each night has and let
          the owner fulfil exactly that (the same adjusted stay guests can book,
          minus the per-guest cap). The guest pays only for the rooms they get. */}
      {canAdjust && (
        <div className="mt-[22px] rounded-[10px] border-[1.5px] border-[#e8d5a3] bg-[#fdf9f0] p-[15px]">
          <p className="text-[16px] font-semibold leading-[1.3] text-[#8a6a1f]">
            {rooms} rooms aren&apos;t free every night
          </p>
          <p className="mt-1 text-[14px] leading-[1.4] text-[#7a6a45]">
            Here&apos;s what the calendar has across these dates:
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {plan.map((seg) => (
              <li
                key={seg.checkIn}
                className="flex items-center justify-between gap-3 text-[15px] leading-[1.3]"
              >
                <span className="text-[#5a5a64]">
                  {formatRange(seg.checkIn, seg.checkOut)}
                </span>
                <span className="font-semibold text-[#121212]">
                  {seg.rooms} room{seg.rooms === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
          <fieldset className="mt-3.5 space-y-2 border-t border-[#e8d5a3] pt-3">
            <legend className="sr-only">How to fulfil these dates</legend>
            <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.35] text-[#121212]">
              <input
                type="radio"
                name="owner-room-plan"
                checked={flexSel}
                onChange={() => setFlexSel(true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">Book it with this adjustment</span>
                <span className="block text-[13.5px] text-[#7a6a45]">
                  Every night gets all the rooms it has — the guest pays only
                  for the rooms they get.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.35] text-[#121212]">
              <input
                type="radio"
                name="owner-room-plan"
                checked={!flexSel}
                onChange={() => setFlexSel(false)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">
                  Keep {planMinRooms(plan)} room
                  {planMinRooms(plan) === 1 ? "" : "s"} for the whole stay
                </span>
                <span className="block text-[13.5px] text-[#7a6a45]">
                  The same rooms every night, nothing changes mid-stay.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      )}

      {/* Same picker as the guest's booking card — capped at what the picked
          rooms actually sleep. No over-capacity entries: an owner can add
          rooms, not beds. */}
      <PickerField
        label="Guests"
        ariaLabel="Number of guests"
        value={guests}
        onChange={(n) => setGuestsSel(n)}
        options={Array.from({ length: listedCapacity }, (_, i) => i + 1).map(
          (n) => ({
            value: n,
            label: `${n} ${n === 1 ? "guest" : "guests"}`,
          }),
        )}
        display={
          <>
            {guests} {guests === 1 ? "guest" : "guests"}
            {roomBased && (
              <span className="text-[#8a8a94]">
                {" "}
                ·{" "}
                {adjusted
                  ? "across its legs this stay sleeps"
                  : `${effRooms} ${effRooms === 1 ? "room" : "rooms"} sleep`}{" "}
                {listedCapacity}
              </span>
            )}
          </>
        }
      />

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

      {/* The owner's own discount, as agreed with the guest — % or a fixed
          amount. It's stored on the booking and the guest sees this exact
          figure at payment, so what was promised is what appears. */}
      <div className="mt-[22px]">
        <p className="text-[18px] font-medium leading-[1.2] text-[#121212]">
          Discount{" "}
          <span className="text-[14px] font-normal text-[#8a8a94]">(optional)</span>
        </p>
        <div className="mt-3 flex items-stretch gap-2.5">
          {/* Two clearly labelled halves, not two cramped glyphs: the active
              mode is filled brand, the other stays clickable-looking. */}
          <div className="flex shrink-0 overflow-hidden rounded-[8px] border-[1.5px] border-[#c9c9d4]">
            <button
              type="button"
              onClick={() => setDiscMode("pct")}
              aria-pressed={discMode === "pct"}
              title="Percent off the total"
              className={`min-w-[64px] px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                discMode === "pct"
                  ? "bg-brand text-white"
                  : "bg-white text-[#4a4a4a] hover:bg-brand/5"
              }`}
            >
              % off
            </button>
            <button
              type="button"
              onClick={() => setDiscMode("fixed")}
              aria-pressed={discMode === "fixed"}
              title="Fixed amount off the total"
              className={`min-w-[64px] border-l-[1.5px] border-[#c9c9d4] px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                discMode === "fixed"
                  ? "bg-brand text-white"
                  : "bg-white text-[#4a4a4a] hover:bg-brand/5"
              }`}
            >
              $ off
            </button>
          </div>
          <input
            value={discVal}
            onChange={(e) => setDiscVal(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder={discMode === "pct" ? "e.g. 10 (% off)" : "e.g. 150 ($ off)"}
            aria-label={discMode === "pct" ? "Discount percent" : "Discount amount"}
            className="w-full rounded-[8px] border-[1.5px] border-[#c9c9d4] px-3.5 py-2.5 text-[15px] text-[#121212] placeholder:text-[#9d9da6] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        {discAmount > 0 && (
          <p className="mt-1.5 text-[13px] text-[#1c7d5c]">
            The guest will see −${discAmount.toFixed(2)} at payment.
          </p>
        )}
      </div>

      {/* The fold: this booking absorbs the guest's overlapping stay, growing it
          into ONE booking rather than stacking a second on top. Spelled out so
          the owner confirms it knowingly, and so "their 5 rooms became 7" is
          never a surprise to either side. */}
      {folded.length > 0 && datesReady && (
        <div className="mt-[22px] rounded-[10px] border border-[#c9d8ee] bg-[#f2f7fd] px-4 py-3.5 text-[14px] leading-[1.5] text-[#2c5b8f]">
          <p className="font-semibold">
            This upgrades their existing stay ({foldedRooms} room
            {foldedRooms === 1 ? "" : "s"}, {formatRange(folded[0].checkIn, folded[0].checkOut)})
          </p>
          <p className="mt-1 text-[#4a6b8a]">
            It becomes one booking of {rooms} room{rooms === 1 ? "" : "s"} for{" "}
            {formatRange(unionIn, unionOut)}. What they already paid is credited
            — they&rsquo;re only asked for the difference.
          </p>
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
        {adjusted ? (
          /* Rooms vary night to night — bill each leg for what it holds, the
             same itemization the guest sees, so "the guest pays accordingly"
             is visible before the request is ever sent. */
          plan.map((seg) => {
            const legNights = Math.max(1, nightsBetween(seg.checkIn, seg.checkOut));
            return (
              <div key={seg.checkIn} className="flex items-start justify-between gap-4">
                <dt className="min-w-0">
                  <span className="block text-[16px] text-[#7a7a85]">
                    {formatRange(seg.checkIn, seg.checkOut)}
                  </span>
                  ${price} × {seg.rooms} room{seg.rooms === 1 ? "" : "s"} ×{" "}
                  {legNights} night{legNights === 1 ? "" : "s"}
                </dt>
                <dd className="shrink-0 font-light">
                  ${(price * seg.rooms * legNights).toFixed(2)}
                </dd>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-between">
            <dt>
              ${price}
              {roomBased ? ` × ${effRooms} room${effRooms === 1 ? "" : "s"}` : ""} ×{" "}
              {nights} night{nights === 1 ? "" : "s"}
            </dt>
            <dd className="font-light">${q.subtotal.toFixed(2)}</dd>
          </div>
        )}
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
        <p>{creditPreview > 0 ? "Full stay (before taxes)" : "Total before taxes"}</p>
        <p>${fullTotal.toFixed(2)}</p>
      </div>
      {discAmount > 0 && (
        <div className="mt-3 flex items-center justify-between text-[18px] leading-[1.2] text-brand">
          <p>Your discount{discMode === "pct" ? ` (${Math.min(90, Math.trunc(discNum))}%)` : ""}</p>
          <p>−${discAmount.toFixed(2)}</p>
        </div>
      )}
      {/* Folding in their existing stay: what they paid for it comes straight
          off — the guest is asked only for the difference, and the owner sees
          that figure BEFORE sending the request, not after the guest complains. */}
      {creditPreview > 0 && (
        <div className="mt-3 flex items-start justify-between gap-4 text-[18px] leading-[1.2] text-[#1c7d5c]">
          <div className="min-w-0">
            <p>Guest already paid</p>
            <p className="mt-1 text-[14px] leading-[1.4] text-[#4f9c82]">
              their {foldedRooms}-room booking (
              {formatRange(folded[0].checkIn, folded[0].checkOut)}) — the exact
              amount they were charged, service fee included
            </p>
          </div>
          <p className="shrink-0">−${creditPreview.toFixed(2)}</p>
        </div>
      )}
      {(discAmount > 0 || creditPreview > 0) && (
        <div className="mt-3 flex items-start justify-between gap-4 text-[20px] font-semibold leading-[1.2] text-[#121212]">
          <div className="min-w-0">
            <p>Guest pays</p>
            <p className="mt-1 text-[13px] font-normal leading-[1.4] text-[#7a7a85]">
              only the difference — this is what their payment request asks for
            </p>
          </div>
          <p className="shrink-0">
            ${Math.max(0, fullTotal - discAmount - creditPreview).toFixed(2)}
          </p>
        </div>
      )}
    </aside>
  );
}
