"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  nightsBetween,
  formatRange,
  BOOKING_WINDOW_MONTHS,
  MAX_STAY_NIGHTS,
} from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { loginHref } from "@/lib/returnTo";
import { MAX_CALL_MESSAGE } from "@/lib/callRequest";
import { requestCallAction } from "@/lib/actions";
import DateRangeField from "@/components/home/DateRangeField";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import {
  fullyBookedRanges,
  isGraduated,
  MAX_ROOMS_PER_GUEST,
  neededSpan,
  planMaxRooms,
  planMinRooms,
  planRoomNights,
  roomPlanFor,
  roomsBookedOn,
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
  myRoomBookings = [],
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
  /** Just THIS guest's own rooms here — what the per-guest cap counts against,
   *  so the picker never offers rooms the booking would then refuse. */
  myRoomBookings?: RoomBooking[];
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
  // When the asked-for rooms aren't free all stay, take what each night offers
  // rather than being capped at the leanest night. On by default — it's the
  // closest we can get to what the guest actually asked for — but they can drop
  // back to a fixed smaller stay instead.
  const [flexSel, setFlexSel] = useState(true);
  const router = useRouter();
  // Availability isn't announced up front — the message only appears if the
  // guest tries to reserve a range that's actually taken (checked on click).
  const [showUnavailable, setShowUnavailable] = useState(false);
  // The "request a call" ask, when the guest wants more rooms than they can
  // book online. Idle until they click.
  const [callPending, startCallRequest] = useTransition();
  const [callState, setCallState] = useState<
    { status: "idle" | "sending" | "sent" } | { status: "error"; message: string }
  >({ status: "idle" });
  // The guest's own note to the host. Optional — the dates/rooms/guests go
  // either way, so this is only for what those numbers can't say.
  const [callMessage, setCallMessage] = useState("");

  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  // Stay length is NOT part of "ready" — a stay longer than the nightly flow
  // books is still a real ask, it just goes through the host (see needsCall).
  const datesReady = nights >= 1 && checkIn >= today;

  // Whole-villa stays block their entire range; hotels/resorts block only days
  // where every room is taken (rendered struck-through on the calendar).
  const calendarBlocked = roomBased
    ? fullyBookedRanges(roomBookings, totalRooms)
    : bookedRanges;

  // The picker offers the hotel's whole inventory — deliberately NOT clamped to
  // the allowance. Asking for more than one guest may book online isn't refused;
  // it's routed to the host (see needsCall), and the guest can't ask for that
  // unless the picker lets them say it. The guest's own remaining allowance is
  // applied per NIGHT by `plan` below, not as one flat ceiling here.
  const roomsOfferable = roomBased ? Math.max(1, totalRooms) : 1;

  // What the guest wants to HOLD each night, counting rooms they already have
  // here — not an amount to add on top. Can exceed what a night has free, which
  // is what opens the adjusted stay.
  const roomsWanted = roomBased
    ? Math.min(Math.max(1, roomsSel), roomsOfferable)
    : 1;
  /* The nights this booking must actually COVER. Rooms the guest already holds
     satisfy the ask on their nights, so a range that overlaps an existing stay
     books only the missing part — holding 4 rooms 24–26 and asking 4 rooms
     24–29 is "keep my rooms, stay longer": the booking to make is 26–29, not a
     refusal. Nights that only need a TOP-UP (ask 5 while holding 4) are kept;
     the plan below adds the difference there. */
  const span =
    roomBased && datesReady
      ? neededSpan(checkIn, checkOut, roomsWanted, myRoomBookings)
      : { checkIn, checkOut, gap: false };
  // Every picked night is already covered — there is nothing to book. The
  // existing stay is the thing to change (from My Bookings), not a new booking.
  const covered = roomBased && datesReady && span === null;
  // Covered nights sit BETWEEN nights that need rooms — one booking can't skip
  // its own middle, so the two ends have to be booked separately.
  const gapSplit = span !== null && span.gap;
  const effIn = span?.checkIn ?? checkIn;
  const effOut = span?.checkOut ?? checkOut;
  const effNights = Math.max(0, nightsBetween(effIn, effOut));
  // The picked range shrank to just the nights that need rooms — say so, and
  // price/book only those nights.
  const trimmed =
    roomBased && datesReady && !covered && (effIn !== checkIn || effOut !== checkOut);

  // Rooms free on EVERY night this booking covers — the most a single flat
  // booking could hold.
  const roomsFree = roomBased
    ? datesReady && !covered
      ? roomsFreeForRange(effIn, effOut, roomBookings, totalRooms)
      : totalRooms
    : 1;
  // Every room is taken for the needed range — no inventory to offer.
  const soldOut = roomBased && datesReady && !covered && roomsFree === 0;

  // How the stay splits if the guest takes as many rooms as each night allows —
  // limited by free inventory AND by their own remaining allowance, so nights
  // where they already hold rooms offer only what's left of the six.
  const plan =
    roomBased && datesReady && !covered && !gapSplit && !soldOut
      ? roomPlanFor(
          effIn,
          effOut,
          roomBookings,
          totalRooms,
          roomsWanted,
          myRoomBookings,
          MAX_ROOMS_PER_GUEST,
        )
      : [];
  /* Where an ask that self-serve can't take goes. Only these two are dead ends
     the HOST can still fix, so the Reserve button becomes "request a call"
     rather than a refusal:
       • longer than the nightly flow books (measured on the nights actually
         being booked — covered nights don't count against the guest);
       • more rooms than one guest may ever book online (no split reaches it).
     A partial shortfall is NOT here: it becomes the adjusted stay below (some
     nights fewer rooms), which the guest opts into — that's the whole point of
     offering it rather than losing them. Inventory shortfalls aren't here
     either: a call can't conjure rooms the hotel doesn't have (that's soldOut).
     Both are backstopped server-side; this only picks the button. */
  const overStay = datesReady && !covered && effNights > MAX_STAY_NIGHTS;
  const overRoomCap = roomBased && datesReady && roomsWanted > MAX_ROOMS_PER_GUEST;
  const needsCall = overStay || overRoomCap;

  // Worth offering only when the count actually changes part-way through AND
  // self-serve could finish it. Asking over the cap graduates the plan too (the
  // allowance caps the good nights at six while lean nights give less), but
  // adjusting can't rescue an ask that's out of bounds to begin with — that goes
  // to the host, so don't offer a split next to a button that says it can't.
  const canAdjust = isGraduated(plan) && !needsCall;
  const adjusted = canAdjust && flexSel;

  // The most a FLAT stay can hold: the same count every night, so it's the
  // tightest night once BOTH the hotel's inventory and this guest's own
  // allowance are counted — which is exactly planMinRooms, since the plan caps
  // each night by both. (Using roomsFree here would be inventory-only and would
  // offer rooms the guest's allowance can't take, which the server then
  // refuses.)
  const flatRooms = roomBased
    ? plan.length > 0
      ? planMinRooms(plan)
      : Math.min(roomsWanted, Math.max(1, roomsFree))
    : 1;
  // Rooms held: an adjusted stay peaks at the plan's best night; a flat stay
  // sits at the bottleneck.
  const rooms = roomBased ? (adjusted ? planMaxRooms(plan) : flatRooms) : 1;
  // Occupancy follows the rooms the stay PEAKS at, not its thinnest leg: an
  // adjusted stay is offered so a party doesn't have to shrink to the leanest
  // night, and capping guests there would defeat that — a 4-room party would be
  // held to a 2-room cap by two tight nights. They're told the split before
  // confirming and can ask the host for the full count on every night instead.
  const guestCap = roomBased
    ? Math.max(1, rooms * peoplePerRoom)
    : Math.max(1, maxGuests);
  const guests = Math.min(Math.max(1, guestsSel), guestCap);

  const unavailable =
    datesReady &&
    (calendarBlocked.some((r) => r.checkIn < effOut && r.checkOut > effIn) ||
      (roomBased && !adjusted && roomsFree < rooms));
  // Room-nights actually held, over the nights actually being booked. This
  // generalizes rooms × nights: when the count is constant the two agree
  // exactly, so flat stays price as they always have.
  const roomNights = adjusted ? planRoomNights(plan) : rooms * effNights;
  const unitPrice =
    roomBased && effNights > 0 ? (price * roomNights) / effNights : price;
  const q = quote(unitPrice, effNights, discount);

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

  // Checkout gets the nights actually being booked (the trimmed span), so what
  // the guest pays for is exactly what the card showed. An adjusted stay sends
  // the rooms the guest ASKED for plus the opt-in; the server re-derives the
  // per-night plan from live availability, so the split (and its price) is
  // never taken from the client.
  const paymentUrl = `/payment?villa=${villaId}&in=${effIn}&out=${effOut}&guests=${guests}${
    roomBased ? `&rooms=${adjusted ? roomsWanted : rooms}` : ""
  }${adjusted ? "&flex=1" : ""}`;

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
    if (!datesReady || needsCall || covered || gapSplit) return;
    if (unavailable) {
      setShowUnavailable(true);
      return;
    }
    // Extra services are picked inline on this card, so go straight to checkout.
    goToPayment(chosen);
  }

  // Ask the host to ring about a stay the self-serve flow won't take — too many
  // rooms for one guest, or too long. Signed-out guests sign in and land back
  // here. Sends what they ACTUALLY asked for, so the host can act on it without
  // a back-and-forth.
  function handleRequestCall() {
    if (callPending) return;
    if (!authed) {
      router.push(loginHref(`/place?id=${villaId}&in=${checkIn}&out=${checkOut}`));
      return;
    }
    setCallState({ status: "sending" });
    startCallRequest(async () => {
      const res = await requestCallAction({
        villaId,
        checkIn,
        checkOut,
        rooms: roomsWanted,
        guests,
        message: callMessage,
        // The add-ons they'd already ticked here — carried so the host doesn't
        // have to ask again, and so fulfilling the request restores them.
        services: chosen,
      });
      setCallState(
        res.ok
          ? { status: "sent" }
          : { status: "error", message: res.error },
      );
    });
  }

  // The "ask the host" form. It appears in two places — when self-serve can't
  // take the booking at all, and inside the adjusted-stay panel for a guest who
  // would rather hold the full room count every night than accept the split.
  // It's the same request either way (their dates, rooms, guests + note), so
  // it's built once here rather than duplicated into both panels.
  const callAsk =
    callState.status === "sent" ? (
      <p className="rounded-[8px] bg-[#e6f7f1] px-3 py-2 text-[14px] font-medium text-[#1c7d5c]">
        Call requested — the host will be in touch soon.
      </p>
    ) : (
      <>
        {/* Say what's already going, so the note is for the rest — not for
            retyping the dates. */}
        <p className="text-[13px] leading-[1.4] text-[#7a6a45]">
          Your dates ({formatRange(checkIn, checkOut)}), {roomsWanted}{" "}
          {roomsWanted === 1 ? "room" : "rooms"} and {guests}{" "}
          {guests === 1 ? "guest" : "guests"} are sent with the request.
        </p>
        <label className="mt-2 block">
          <span className="sr-only">Message for the host</span>
          <textarea
            value={callMessage}
            onChange={(e) => setCallMessage(e.target.value)}
            maxLength={MAX_CALL_MESSAGE}
            rows={3}
            placeholder="Anything else the host should know? (optional)"
            className="w-full resize-none rounded-[8px] border border-[#e0cf9a] bg-white p-2.5 text-[14px] text-[#121212] placeholder:text-[#a89a72] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <button
          type="button"
          onClick={handleRequestCall}
          disabled={callPending}
          className="mt-2 rounded-[8px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {callPending ? "Requesting…" : "Request a call from the host"}
        </button>
        {callState.status === "error" && (
          <p className="mt-2 text-[13px] font-medium text-[#a33b2c]">
            {callState.message}
          </p>
        )}
      </>
    );

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
        {/* No maxNights: a longer stay than the nightly flow books is allowed to
            be PICKED — it turns Reserve into "request a call" rather than being
            un-selectable. windowMonths still bounds how far ahead you can book. */}
        <DateRangeField
          variant="booking"
          windowMonths={BOOKING_WINDOW_MONTHS}
          /* Hotels/resorts show how many rooms each night still has; a
             whole-villa stay has nothing to count, so it stays a bare calendar. */
          roomsFreeOn={
            roomBased
              ? (key) => Math.max(0, totalRooms - roomsBookedOn(key, roomBookings))
              : undefined
          }
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
            soldOut
              ? "cursor-not-allowed border-[#f0c4c0]"
              : "cursor-pointer border-[#ddd]"
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
                  {roomsWanted} {roomsWanted === 1 ? "room" : "rooms"}
                  {datesReady && (
                    <span className="text-[#8a8a94]">
                      {" "}
                      · {roomsFree} available
                      {canAdjust ? " all nights" : ""}
                    </span>
                  )}
                  {/* Not an error — it just means this ask goes via the host.
                      Same ☎ mark the dropdown option carried, so the closed box
                      keeps telling the same story. */}
                  {overRoomCap && (
                    <span
                      className="font-medium text-[#8a6a1f]"
                      title={`More than ${MAX_ROOMS_PER_GUEST} rooms can't be booked online — request a call below and the host will arrange it with you.`}
                    >
                      {" "}
                      · ☎ over the {MAX_ROOMS_PER_GUEST}-room online limit
                    </span>
                  )}
                  {/* The ask is short but evenly so, i.e. there's no split to
                      offer — say what they'd actually get rather than quietly
                      booking them fewer rooms than the picker shows. */}
                  {!overRoomCap && !canAdjust && !soldOut && flatRooms < roomsWanted && (
                    <span className="font-medium text-[#8a6a1f]">
                      {" "}
                      · only {flatRooms} bookable by you
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
          {/* The whole inventory is offered, not just what's free every night —
              asking for more is what surfaces the adjusted-stay option below,
              instead of silently capping the guest at the leanest night. It's
              not capped by the per-guest allowance either: going past that is a
              legitimate ask, it just gets arranged on a call. */}
          <select
            id="booking-rooms"
            value={roomsWanted}
            onChange={(e) => setRoomsSel(Number(e.target.value))}
            disabled={soldOut}
            aria-label="Number of rooms"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          >
            {Array.from({ length: roomsOfferable }, (_, i) => i + 1).map((n) => {
              // Counts over the online cap are still offered (the host can
              // arrange them), but they must READ different before the guest
              // picks one: dimmed, marked with a phone, and a hover tooltip
              // saying how such a block actually gets booked.
              const viaHost = n > MAX_ROOMS_PER_GUEST;
              return (
                <option
                  key={n}
                  value={n}
                  title={
                    viaHost
                      ? `More than ${MAX_ROOMS_PER_GUEST} rooms can't be booked online — pick this and request a call, and the host will arrange it with you.`
                      : undefined
                  }
                  style={viaHost ? { color: "#a8a8b0" } : undefined}
                >
                  {n} {n === 1 ? "room" : "rooms"}
                  {viaHost ? " · ☎ host arranges" : ""}
                </option>
              );
            })}
          </select>
        </label>
      )}

      {/* The asked-for rooms aren't free every night, but the stay is still
          possible if the room count flexes — show exactly what's free when, and
          let the guest decide rather than quietly giving them less. */}
      {canAdjust && (
        <div className="mt-[22px] rounded-[10px] border-[1.5px] border-[#e8d5a3] bg-[#fdf9f0] p-[15px]">
          <p className="text-[16px] font-semibold leading-[1.3] text-[#8a6a1f]">
            We can&apos;t hold {roomsWanted} rooms for every night
          </p>
          <p className="mt-1 text-[14px] leading-[1.4] text-[#7a6a45]">
            {/* Say which limit bit. "Sold out" and "you've used your six" look
                identical on the calendar but mean very different things. */}
            {planMaxRooms(plan) < roomsFree
              ? `Some of these nights already have rooms booked in your name — one guest can hold ${MAX_ROOMS_PER_GUEST} a night. Here's what you can add:`
              : "Here's what's free across your dates:"}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {plan.map((seg) => (
              <li
                key={seg.checkIn}
                className="flex items-center justify-between gap-3 text-[15px] leading-[1.3]"
              >
                <span className="text-[#121212]">
                  {formatRange(seg.checkIn, seg.checkOut)}
                </span>
                <span
                  className={`shrink-0 font-semibold ${
                    seg.rooms < roomsWanted ? "text-[#b8860b]" : "text-[#2e7d32]"
                  }`}
                >
                  {seg.rooms} {seg.rooms === 1 ? "room" : "rooms"}
                </span>
              </li>
            ))}
          </ul>

          <fieldset className="mt-3.5 space-y-2 border-t border-[#e8d5a3] pt-3">
            <legend className="sr-only">How to book these dates</legend>
            <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.35] text-[#121212]">
              <input
                type="radio"
                name="room-plan"
                checked={flexSel}
                onChange={() => setFlexSel(true)}
                className="mt-[3px] shrink-0"
              />
              <span>
                Book with this adjustment
                <span className="block text-[13px] text-[#7a6a45]">
                  Keep all {effNights} night{effNights === 1 ? "" : "s"} and pay only
                  for the rooms you have each night.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.35] text-[#121212]">
              <input
                type="radio"
                name="room-plan"
                checked={!flexSel}
                onChange={() => setFlexSel(false)}
                className="mt-[3px] shrink-0"
              />
              <span>
                Keep {flatRooms} room{flatRooms === 1 ? "" : "s"} for the whole
                stay
                <span className="block text-[13px] text-[#7a6a45]">
                  The same {flatRooms} room{flatRooms === 1 ? "" : "s"} every
                  night, nothing changes mid-stay.
                </span>
              </span>
            </label>
          </fieldset>

          {/* Both options above are compromises. A guest who actually needs all
              {roomsWanted} rooms on every night shouldn't have to accept one of
              them or walk — the host can arrange it, so offer that right here
              rather than making them go hunting for it. */}
          <div className="mt-3.5 border-t border-[#e8d5a3] pt-3">
            <p className="text-[14px] font-medium leading-[1.35] text-[#8a6a1f]">
              Need all {roomsWanted} rooms for every night?
            </p>
            <p className="mt-0.5 text-[13px] leading-[1.4] text-[#7a6a45]">
              Ask the host to set it up for you instead.
            </p>
            <div className="mt-2">{callAsk}</div>
          </div>
        </div>
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

      {/* Over one of the self-serve lines, the ask is still real — it just can't
          be completed online. Swap Reserve for the way forward (the host
          arranging it on a call) rather than showing a button that can't work. */}
      {needsCall ? (
        <div className="mt-[25px] rounded-[10px] border border-[#e8d5a3] bg-[#fdf9f0] px-4 py-3.5">
          <p className="flex items-start gap-2.5 text-[15px] font-medium leading-[1.45] text-[#8a6a1f]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
              <path d="M12 9v4.5M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>The host arranges this one with you directly.</span>
          </p>
          <ul className="mt-2 space-y-1 pl-[28px] text-[14px] leading-[1.45] text-[#7a6a45]">
            {overStay && (
              <li>
                {effNights} nights for {formatRange(effIn, effOut)} —{" "}
                {MAX_STAY_NIGHTS} nights is the longest stay bookable online.
              </li>
            )}
            {overRoomCap && (
              <li>
                {roomsWanted} rooms — one guest can book at most{" "}
                {MAX_ROOMS_PER_GUEST} online.
              </li>
            )}
          </ul>
          <div className="mt-3 pl-[28px]">{callAsk}</div>
        </div>
      ) : covered ? (
        /* Every picked night is already covered by rooms they hold — there is
           nothing to book. The doorway they want is their existing stay. */
        <div className="mt-[25px] rounded-[10px] border border-[#c9d8ee] bg-[#f2f7fd] px-4 py-3.5">
          <p className="text-[15px] font-medium leading-[1.45] text-[#2c5b8f]">
            You already have {roomsWanted} room{roomsWanted === 1 ? "" : "s"} for
            all of these dates
          </p>
          <p className="mt-1 text-[14px] leading-[1.45] text-[#4a6b8a]">
            Your existing booking covers {formatRange(checkIn, checkOut)}. To
            change or extend that stay, manage it from{" "}
            <Link href="/profile/bookings" className="font-semibold underline">
              My Bookings
            </Link>
            , or pick a higher room count here to add rooms.
          </p>
        </div>
      ) : gapSplit ? (
        /* Their rooms cover the MIDDLE of the picked range. One booking can't
           skip its own middle nights, so the two ends must be booked one at a
           time — say so instead of failing mysteriously. */
        <div className="mt-[25px] rounded-[10px] border border-[#c9d8ee] bg-[#f2f7fd] px-4 py-3.5">
          <p className="text-[15px] font-medium leading-[1.45] text-[#2c5b8f]">
            Your rooms already cover the middle of these dates
          </p>
          <p className="mt-1 text-[14px] leading-[1.45] text-[#4a6b8a]">
            A single booking can&rsquo;t skip nights you already have. Book the
            nights before your existing stay and the nights after it as two
            separate bookings, or pick a higher room count to top up every
            night.
          </p>
        </div>
      ) : (
        <>
          {/* The picked range shrank to the nights that still need rooms — the
              guest sees exactly what this booking covers and pays for before
              they commit to it. */}
          {trimmed && (
            <div className="mt-[25px] rounded-[10px] border border-[#c9d8ee] bg-[#f2f7fd] px-4 py-3.5">
              <p className="text-[15px] font-medium leading-[1.45] text-[#2c5b8f]">
                Your rooms already cover part of these dates
              </p>
              <p className="mt-1 text-[14px] leading-[1.45] text-[#4a6b8a]">
                This booking adds{" "}
                <span className="font-semibold">{formatRange(effIn, effOut)}</span>{" "}
                ({effNights} night{effNights === 1 ? "" : "s"}) — you already
                have rooms for the rest, and you only pay for the new nights.
              </p>
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
        </>
      )}

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
            {adjusted ? (
              // Rooms vary night to night, so "× N rooms × M nights" would be a
              // lie — bill the room-nights actually held instead.
              <>
                ${price} × {roomNights} room-night{roomNights === 1 ? "" : "s"}
              </>
            ) : (
              <>
                ${price}
                {roomBased ? ` × ${rooms} room${rooms === 1 ? "" : "s"}` : ""} ×{" "}
                {effNights} night{effNights === 1 ? "" : "s"}
              </>
            )}
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
