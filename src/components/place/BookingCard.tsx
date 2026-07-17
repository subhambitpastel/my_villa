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
import PickerField from "@/components/ui/PickerField";
import type { BookedRange } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import {
  bookedNights,
  dayBudget,
  fullyBookedRanges,
  hasDayLimit,
  isGraduated,
  neededSpan,
  nightsInRange,
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
  maxBookingDays = 0,
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
  /** Most distinct nights one guest may book here across all their stays
   *  (hotels/resorts). 0 = no limit. Beyond it the stay goes through the host. */
  maxBookingDays?: number;
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

  /* Rooms this guest already holds on EVERY night of the PICKED dates. When
     that's a uniform count (one earlier booking — the common case), the picker
     flips to "rooms to ADD": a guest holding 3 of a hotel's 4 rooms sees ONE
     option, "1 room", not a list of totals that reads as four bookable rooms.
     Internally the ask stays a TOTAL (held + added), so the top-up pricing,
     trimming and plan flows are untouched. */
  const heldNights =
    roomBased && datesReady ? nightsInRange(checkIn, checkOut) : [];
  const heldPerNight = heldNights.map((n) => roomsBookedOn(n, myRoomBookings));
  const heldMinOnSpan = heldPerNight.length ? Math.min(...heldPerNight) : 0;
  const heldMaxOnSpan = heldPerNight.length ? Math.max(...heldPerNight) : 0;
  // Uniform holdings let options be exact "add N" counts. Varying holds (an
  // extension past an existing stay) keep totals — "add 1" isn't one number
  // when different nights hold different counts.
  const heldUniform = heldMinOnSpan === heldMaxOnSpan ? heldMinOnSpan : null;
  // Free inventory on EACH picked night (the guest's own rooms already count as
  // taken in roomBookings). The most a single night could ADD.
  const freePerNight = heldNights.map((n) =>
    Math.max(0, totalRooms - roomsBookedOn(n, roomBookings)),
  );
  const maxAddable = freePerNight.length
    ? Math.max(...freePerNight)
    : totalRooms;
  /* ADD mode: the guest already holds rooms on the picked span, so the picker
     means "rooms to ADD" and each night takes as many of them as it has free —
     +4 where only 4 are free, +10 where 10 are. The result is a NEW, SEPARATE
     booking (never merged with the held one). A fresh guest (holds nothing) is
     the ordinary total flow, untouched. */
  const addMode = roomBased && datesReady && heldMaxOnSpan > 0;

  // What the guest wants each night: rooms to ADD (add mode) or the total (a
  // fresh booking). Both feed the plan below the same way.
  const roomsWanted = roomBased
    ? addMode
      ? Math.min(Math.max(1, roomsSel), Math.max(1, maxAddable))
      : Math.min(Math.max(1, roomsSel), roomsOfferable)
    : 1;
  /* The nights this booking must actually COVER. Rooms the guest already holds
     satisfy the ask on their nights, so a range that overlaps an existing stay
     books only the missing part — holding 4 rooms 24–26 and asking 4 rooms
     24–29 is "keep my rooms, stay longer": the booking to make is 26–29, not a
     refusal. Nights that only need a TOP-UP (ask 5 while holding 4) are kept;
     the plan below adds the difference there. */
  const span =
    roomBased && datesReady && !addMode
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
  // The property's per-guest night budget, measured against the PICKED dates and
  // what this guest already holds here. Over it, the stay is arranged by the
  // host on a call — exactly like an over-long stay. It caps NIGHTS, not rooms,
  // so it applies to every kind (whole-villa listings included), keyed off the
  // picked dates rather than any room math.
  const budget =
    datesReady && !covered
      ? dayBudget(maxBookingDays, myRoomBookings, checkIn, checkOut)
      : null;
  const overBudget = !!budget?.overBudget;
  const needsCall = overStay || overBudget;

  // What the calendar needs to paint over-budget nights yellow: how many more
  // nights this guest may still book here, measured off what they already hold
  // (independent of the in-progress selection). Null when the property has no
  // per-guest night limit.
  const nightBudget = hasDayLimit(maxBookingDays)
    ? {
        limit: maxBookingDays,
        remaining: Math.max(0, maxBookingDays - bookedNights(myRoomBookings).size),
        // Nights already theirs spend no budget again — a span crossing an
        // existing stay only pays for its NEW nights, matching the server.
        held: [...bookedNights(myRoomBookings)],
      }
    : null;

  // How the stay splits if the guest takes as many rooms as each night allows —
  // each night limited only by free inventory (rooms already theirs top up
  // toward the ask). When the stay needs the host (over the night budget or too
  // long), this preview still shows what would be booked so the request carries
  // real rooms/guests/price.
  const plan =
    roomBased && datesReady && !covered && !gapSplit && !soldOut
      ? addMode
        ? // ADD: legs are the rooms ADDED each night — min(add, free), free
          // already excluding the guest's held rooms (held=[] here, since
          // roomBookings counts them). No neededSpan trim: we add on every
          // picked night, so a partly-held night still gets its top-up.
          roomPlanFor(checkIn, checkOut, roomBookings, totalRooms, roomsWanted, [])
        : roomPlanFor(effIn, effOut, roomBookings, totalRooms, roomsWanted, myRoomBookings)
      : [];

  // Rooms the guest already holds on the nights being priced — shown alongside
  // the per-leg amounts so the totals read as "added on top of what you have",
  // never as if the held rooms vanished or were charged twice.
  const heldOverlaps = roomBased
    ? myRoomBookings.filter((b) => b.checkIn < effOut && b.checkOut > effIn)
    : [];
  // Room-value of those held rooms across the priced span — the "already paid"
  // line the totals subtract. Computed per NIGHT off the same data as the leg
  // lines, so legs-minus-this always equals the net subtotal being charged.
  const heldValue = roomBased
    ? nightsInRange(effIn, effOut).reduce(
        (sum, night) => sum + roomsBookedOn(night, myRoomBookings) * price,
        0,
      )
    : 0;
  // What those earlier checkouts actually CHARGED — room price, long-stay
  // discount and service fee, the same quote they paid (add-ons aside). This is
  // the figure the guest can find on their statement, the credit the server
  // stores at fulfilment, and the deduction the payment page shows — so the
  // preview here, the owner's preview and the final receipt all tell one story.
  const heldParts = heldOverlaps.map((b) =>
    quote(
      price * Math.max(1, b.rooms),
      Math.max(1, nightsBetween(b.checkIn, b.checkOut)),
      discount,
    ),
  );
  const heldPaid = heldParts.reduce((sum, p) => sum + p.total, 0);
  const heldFee = heldParts.reduce((sum, p) => sum + p.serviceFee, 0);
  const heldDiscount = heldParts.reduce((sum, p) => sum + p.discountAmount, 0);
  // The paid-amount framing only adds up when every earlier stay sits inside
  // the nights being priced; one poking outside falls back to deducting the
  // in-span room value, which stays exact there.
  const heldWithin =
    heldOverlaps.length > 0 &&
    heldOverlaps.every((b) => b.checkIn >= effIn && b.checkOut <= effOut);

  // The opt-in split is only OFFERED when self-serve could finish it — past the
  // cap the split still exists but it's the host's to arrange, so no radio.
  const canAdjust = isGraduated(plan) && !needsCall;
  // What the pricing/rooms/guests derive from: the guest's accepted split, or —
  // in call mode — the host-arranged split being previewed.
  const adjusted = (canAdjust && flexSel) || (needsCall && isGraduated(plan));
  // Show the receipt the way the payment page and the owner's preview show it:
  // full stay (fee included) minus the amount actually paid before. One story
  // on every surface, and the deduction matches the guest's bank statement.
  // NOT in add mode: that's a separate new booking whose legs are already just
  // the added rooms, so there is nothing to subtract.
  const paidFraming = adjusted && heldWithin && !addMode;

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
  // Occupancy: a flat stay sleeps rooms × per-room. An adjusted stay sums what
  // EACH leg sleeps — a 1-room leg (2 guests) plus a 6-room leg (12) offers 14,
  // not the peak leg's 12: the legs host on different nights, and holding the
  // whole stay to one leg's ceiling would undersell every other leg.
  const guestCap = roomBased
    ? Math.max(
        1,
        adjusted && plan.length > 0
          ? plan.reduce((sum, leg) => sum + leg.rooms * peoplePerRoom, 0)
          : rooms * peoplePerRoom,
      )
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
  // Add mode sends the rooms to ADD plus `add=1`, so the server books them as
  // a new separate stay (min(add, free) per night) instead of reading the
  // count as a total and refusing "you already hold these dates".
  const paymentUrl = `/payment?villa=${villaId}&in=${effIn}&out=${effOut}&guests=${guests}${
    roomBased ? `&rooms=${adjusted ? roomsWanted : rooms}` : ""
  }${adjusted ? "&flex=1" : ""}${addMode ? "&add=1" : ""}`;

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
          nightBudget={nightBudget}
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

      {/* Hotels/resorts sell individual rooms — pick how many, then guests.
          The whole inventory is offered, not just what's free every night —
          asking for more is what surfaces the adjusted-stay option below,
          instead of silently capping the guest at the leanest night. Rooms are
          never rationed per guest, so every count up to the inventory is a plain
          bookable option (rooms already theirs read dimmed). */}
      {roomBased && (
        <PickerField
          label="Rooms"
          ariaLabel="Number of rooms"
          value={roomsWanted}
          onChange={(n) => setRoomsSel(n)}
          disabled={soldOut}
          boxClassName={soldOut ? "border-[#f0c4c0]" : "border-[#ddd]"}
          options={
            addMode
              ? /* Adding to an existing stay — the picker counts ROOMS TO ADD.
                   Each night takes as many as it has free, so the max is the
                   best night's free inventory. */
                Array.from({ length: Math.max(1, maxAddable) }, (_, i) => i + 1).map(
                  (n) => ({
                    value: n,
                    label: `${n} ${n === 1 ? "room" : "rooms"}`,
                    hint: "to add",
                  }),
                )
              : Array.from({ length: roomsOfferable }, (_, i) => i + 1).map(
                  (n) => ({
                    value: n,
                    label: `${n} ${n === 1 ? "room" : "rooms"}`,
                  }),
                )
          }
          display={
            soldOut ? (
              <span className="font-medium text-[#c0392b]">
                Sold out for these dates
              </span>
            ) : (
              <span className="text-[#4a4a4a]">
                {roomsWanted} {roomsWanted === 1 ? "room" : "rooms"}
                {addMode ? " to add" : ""}
                {datesReady && (
                  <span className="text-[#8a8a94]">
                    {" "}
                    {addMode ? (
                      <>
                        · you hold{" "}
                        {heldUniform ?? `up to ${heldMaxOnSpan}`} here · up to{" "}
                        {maxAddable} more free
                      </>
                    ) : (
                      <>
                        · {roomsFree} available
                        {canAdjust ? " all nights" : ""}
                      </>
                    )}
                  </span>
                )}
                {/* The ask can't be met flat and there's no split to offer —
                    say what they'd actually get before the price shows it. */}
                {!needsCall &&
                  !canAdjust &&
                  !soldOut &&
                  flatRooms < roomsWanted && (
                    <span className="font-medium text-[#8a6a1f]">
                      {" "}
                      · only {flatRooms} bookable by you
                    </span>
                  )}
              </span>
            )
          }
        />
      )}

      {/* The ask can't be met and flexing wouldn't help either — EVERY night
          bottoms out at the same smaller count, so there's no adjustment to
          offer, just a smaller stay. Never bill it silently: say what they're
          actually getting and why before the price panel shows it. */}
      {roomBased &&
        datesReady &&
        !covered &&
        !gapSplit &&
        !soldOut &&
        !canAdjust &&
        !needsCall &&
        roomsWanted > rooms && (
          <div className="mt-[22px] rounded-[10px] border-[1.5px] border-[#e8d5a3] bg-[#fdf9f0] p-[15px] text-[14px] leading-[1.5] text-[#7a6a45]">
            <p className="text-[16px] font-semibold leading-[1.3] text-[#8a6a1f]">
              Only {rooms} room{rooms === 1 ? "" : "s"} a night for these dates
            </p>
            <p className="mt-1">
              {rooms < roomsFree
                ? `Some of these nights already have rooms booked in your name, so this stay adds ${rooms} a night.`
                : `You asked for ${roomsWanted}, but every night of ${formatRange(
                    effIn,
                    effOut,
                  )} has just ${rooms} room${rooms === 1 ? "" : "s"} left.`}{" "}
              The price below is for {rooms} room{rooms === 1 ? "" : "s"} — you
              only pay for what you actually get.
            </p>
          </div>
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
            {/* Say which limit bit: rooms already theirs vs the hotel simply
                not having them free every night. */}
            {planMaxRooms(plan) < roomsFree
              ? "Some of these nights already have rooms booked in your name — here's what you can add:"
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

          {/* No "ask the host" escape hatch here: rooms aren't rationed per
              guest, so this shortage is physical inventory — the missing rooms
              are genuinely booked (often by this guest), and no call can free
              them. The call flow belongs to POLICY limits only (night budget,
              too-long stays), which replace Reserve with it elsewhere. */}
        </div>
      )}

      <PickerField
        label="Guests"
        ariaLabel="Number of guests"
        value={guests}
        onChange={(n) => setGuestsSel(n)}
        options={Array.from({ length: guestCap }, (_, i) => i + 1).map((n) => ({
          value: n,
          label: `${n} ${n === 1 ? "guest" : "guests"}`,
        }))}
        display={
          <>
            {guests} {guests === 1 ? "guest" : "guests"}
          </>
        }
      />

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
            {overBudget && budget && (
              <li>
                {budget.used + budget.added} night
                {budget.used + budget.added === 1 ? "" : "s"} at this property —
                the host lets one guest book at most {maxBookingDays} online.
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
        {adjusted ? (
          /* Rooms vary night to night, so one "× N rooms × M nights" line would
             be a lie and a bare "21 room-nights" says nothing. Bill the FULL
             stay leg by leg — the combined room count, including rooms the
             guest already holds — then take what they already paid back off on
             its own line, so the total visibly IS "full stay minus what you've
             paid". The legs sum minus the deduction equals exactly the net
             room-nights the quote below charges. */
          <>
            {plan.map((seg) => {
              const legNights = Math.max(
                1,
                nightsBetween(seg.checkIn, seg.checkOut),
              );
              const held = roomsBookedOn(seg.checkIn, myRoomBookings);
              // Add mode: the leg IS the new rooms, billed on its own — no held
              // rooms folded in, nothing to subtract. Otherwise the leg is the
              // combined total and the held value comes off below.
              const combined = addMode ? seg.rooms : held + seg.rooms;
              return (
                <div key={seg.checkIn} className="flex items-start justify-between gap-4">
                  <dt className="min-w-0">
                    <span className="block text-[16px] text-[#7a7a85]">
                      {formatRange(seg.checkIn, seg.checkOut)}
                      {addMode
                        ? " · added to your stay"
                        : held > 0 && ` · ${held} of these are yours already`}
                    </span>
                    ${price} × {combined} room{combined === 1 ? "" : "s"} ×{" "}
                    {legNights} night{legNights === 1 ? "" : "s"}
                  </dt>
                  <dd className="shrink-0 font-light">
                    ${(price * combined * legNights).toFixed(2)}
                  </dd>
                </div>
              );
            })}
            {/* An earlier stay poking outside the priced nights can't be
                deducted at its full charged amount without the rows no longer
                adding up — deduct the in-span room value instead, which stays
                exact. Fully-covered stays take the clearer paid-amount rows
                after the fee below. Add mode bills the new rooms directly, so
                there is nothing to subtract. */}
            {!addMode && !heldWithin && heldValue > 0 && (
              <div className="flex items-start justify-between gap-4 text-[#1c7d5c]">
                <dt className="min-w-0">
                  Already paid — your {heldOverlaps[0]?.rooms ?? 0} room
                  {(heldOverlaps[0]?.rooms ?? 0) === 1 ? "" : "s"} (
                  {heldOverlaps[0]
                    ? formatRange(heldOverlaps[0].checkIn, heldOverlaps[0].checkOut)
                    : ""}
                  )
                </dt>
                <dd className="shrink-0 font-light">−${heldValue.toFixed(2)}</dd>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <dt>
              ${price}
              {roomBased ? ` × ${rooms} room${rooms === 1 ? "" : "s"}` : ""} ×{" "}
              {effNights} night{effNights === 1 ? "" : "s"}
            </dt>
            <dd className="font-light">${q.subtotal.toFixed(2)}</dd>
          </div>
        )}
        {q.discountAmount + (paidFraming ? heldDiscount : 0) > 0 && (
          <div className="flex items-center justify-between text-brand">
            <dt>{q.discount.label}</dt>
            <dd className="font-light">
              −${(q.discountAmount + (paidFraming ? heldDiscount : 0)).toFixed(2)}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt>Service Fee</dt>
          <dd className="font-light">
            ${(q.serviceFee + (paidFraming ? heldFee : 0)).toFixed(2)}
          </dd>
        </div>
        {paidFraming && (
          <>
            <div className="flex items-start justify-between gap-4">
              <dt className="min-w-0">
                <span className="block text-[16px] text-[#7a7a85]">
                  your earlier booking{heldOverlaps.length === 1 ? "" : "s"} and
                  this one together
                </span>
                Full stay
              </dt>
              <dd className="shrink-0 font-light">
                ${(q.total + heldPaid).toFixed(2)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 text-[#1c7d5c]">
              <dt className="min-w-0">
                <span className="block text-[16px] text-[#4f9c82]">
                  {heldOverlaps.length === 1
                    ? `your ${heldOverlaps[0].rooms}-room booking, ${formatRange(
                        heldOverlaps[0].checkIn,
                        heldOverlaps[0].checkOut,
                      )} · service fee included`
                    : `your ${heldOverlaps.length} earlier bookings on these nights · service fees included`}
                </span>
                You already paid
              </dt>
              <dd className="shrink-0 font-light">−${heldPaid.toFixed(2)}</dd>
            </div>
          </>
        )}
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
      {paidFraming && (
        <p className="mt-4 text-center text-[13px] text-[#7a7a85]">
          You only pay the difference — what you paid earlier is taken off
          above, service fee and all.
        </p>
      )}
      {hasLongStayPackages && (
        <p className="mt-4 text-center text-[13px] text-[#7a7a85]">
          Stay 7+ nights for 15% off, 28+ nights for 30% off — applied automatically.
        </p>
      )}
    </aside>
  );
}
