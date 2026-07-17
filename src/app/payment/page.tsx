import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PaymentForm from "@/components/payment/PaymentForm";
import CouponField from "@/components/payment/CouponField";
import { redirect } from "next/navigation";
import {
  getVillaById,
  getPackageById,
  getGuestRoomBookings,
  getRoomPlan,
  isPlanAvailable,
  isVillaAvailable,
  getOwnBookingForRange,
  getBookingForManage,
  getBookingToPay,
  parseServiceList,
  type PackageForBooking,
} from "@/lib/queries";
import { findCoupon, hasRedeemedCoupon } from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import { getCurrentUser } from "@/lib/session";
import {
  dayBudget,
  hasDayLimit,
  isGraduated,
  isRoomBased,
  neededSpan,
  planMaxRooms,
  planRoomNights,
  roomsForGuests,
  type RoomSegment,
} from "@/lib/rooms";
import {
  addDays,
  dayFromNow,
  formatDay,
  nightsBetween,
  parseDay,
  MAX_STAY_NIGHTS,
} from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { dialValueFor } from "@/lib/countries";
import { loginHref } from "@/lib/returnTo";
import type { VillaRow } from "@/lib/db";

export const metadata: Metadata = {
  title: "Confirm Payment",
  description: "Confirm and pay for your MyVilla booking.",
};

/* eslint-disable @next/next/no-img-element */

function BookingSummary({
  villa,
  nights,
  extras,
  rooms = 1,
  roomBased = false,
  roomNights,
  plan = [],
  pkg = null,
  modify,
  pay,
  coupon = null,
  couponSlot = null,
}: {
  villa: VillaRow;
  nights: number;
  /** Extra services the guest picked in the Reserve dialog. */
  extras: VillaService[];
  /** Rooms reserved (hotels/resorts) — price scales per room per night. */
  rooms?: number;
  roomBased?: boolean;
  /** Room-nights held across the stay (rooms × nights for a flat stay). */
  roomNights: number;
  /** Per-leg room counts when the stay's rooms change mid-way; [] otherwise. */
  plan?: RoomSegment[];
  /** Set for a package booking — one all-inclusive price, no nightly breakdown. */
  pkg?: PackageForBooking | null;
  /** Set when this is a booking modification: shows the amount already paid and
   *  the balance due now (the top-up) instead of a single total. */
  modify?: { alreadyPaid: number; balanceDue: number };
  /** Set when settling an owner-arranged stay: the owner's discount, any credit
   *  from a merged (already-paid) stay, and the net amount due. */
  pay?: { hostDiscount: number; credit: number; amount: number };
  /** Coupon applied to a NEW checkout (validated server-side). Its discount
   *  can never take the total below $1 — the floor a coupon must respect. */
  coupon?: { code: string; pct: number; fixed: number } | null;
  /** The coupon input, rendered under the price rows (client component). */
  couponSlot?: React.ReactNode;
}) {
  // Charge the room-nights actually held. With a constant room count this is
  // identical to the old price × rooms, while the length-of-stay discount keeps
  // keying off real nights rather than room-nights.
  const q = quote(
    nights > 0 ? (villa.price * roomNights) / nights : 0,
    nights,
    villa.discount,
  );
  const extrasTotal = extras.reduce((sum, s) => sum + s.price, 0);
  const adjusted = plan.length > 0;
  // Coupon comes off the WHOLE checkout (stay + add-ons; a package: its
  // price), and can never push it below $1 — a $101 coupon on a $100 stay
  // leaves exactly $1 to pay.
  const round2c = (n: number) => Math.round(n * 100) / 100;
  const baseTotal = pkg ? pkg.price : q.total + extrasTotal;
  const couponDiscount = coupon
    ? Math.min(
        coupon.pct > 0 ? round2c((baseTotal * coupon.pct) / 100) : round2c(coupon.fixed),
        Math.max(0, round2c(baseTotal - 1)),
      )
    : 0;
  const dueTotal = round2c(baseTotal - couponDiscount);
  return (
    <aside className="h-fit w-full min-w-0 max-w-[758px] rounded-[10px] bg-white pb-12 shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:gap-[22px]">
        <div className="relative h-[236px] w-[238px] shrink-0 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)]">
          <Image
            src={villa.image}
            alt={`${villa.name}, ${villa.city}`}
            fill
            sizes="238px"
            className="object-cover"
          />
        </div>
        <div className="pt-[23px]">
          <h2 className="max-w-[438px] text-[24px] leading-[1.3] text-black">
            {villa.name}, {villa.city}
          </h2>
          <p className="mt-[10px] text-[18px] leading-[1.3] text-[#4a4a4a]">
            {villa.kind}
          </p>
          <p className="mt-[42px] flex items-center text-[16px] leading-[1.35] text-black">
            <img src="/icons/pay-star.svg" alt="" width={39} height={50} className="h-[50px] w-[39px]" />
            {villa.rating} Rating
            <img src="/icons/place/dot.svg" alt="" width={27} height={27} className="h-[27px] w-[27px]" />
            {villa.reviews} reviews
          </p>
        </div>
      </div>

      <hr className="mx-[25px] mt-[13px] border-t border-[#c6c6c6]" />

      <h3 className="mt-7 pl-[25px] text-[28px] font-medium leading-[1.3] text-black">
        {pkg ? "Package Details" : "Price Details"}
      </h3>
      {pkg ? (
        <div className="mt-6 pl-[39px] pr-[70px] text-[#121212]">
          <p className="text-[24px] font-semibold leading-[1.3]">{pkg.name}</p>
          <p className="mt-1 text-[18px] leading-[1.3] text-[#4a4a4a]">
            {pkg.nights} night{pkg.nights === 1 ? "" : "s"} · up to {pkg.maxGuests}{" "}
            guest{pkg.maxGuests === 1 ? "" : "s"} · all-inclusive
          </p>
          <ul className="mt-4 space-y-[10px] text-[18px] leading-[1.35]">
            {pkg.inclusions.map((inc) => (
              <li key={inc} className="flex items-center gap-[10px]">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-brand" />
                {inc}
              </li>
            ))}
          </ul>
          {coupon && (
            <div className="mt-6 flex items-center justify-between text-[20px] leading-[1.3] text-[#1c7d5c]">
              <span>{coupon.code ? `Coupon ${coupon.code}` : "Host’s discount"}</span>
              <span>−${couponDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-[#c6c6c6] pt-6 text-[26px] font-semibold leading-[1.3]">
            <span>Total (USD)</span>
            <span>${dueTotal.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <dl className="mt-8 space-y-[31px] pl-[39px] pr-[70px] text-[26px] leading-[1.3] text-[#121212]">
          {/* An adjusted stay holds different rooms on different nights — spell
              out each leg so the total is never a surprise. */}
          {adjusted && (
            <div className="rounded-[10px] border border-[#e8d5a3] bg-[#fdf9f0] p-4 text-[16px] leading-[1.35]">
              <p className="font-semibold text-[#8a6a1f]">
                Your rooms change during this stay
              </p>
              <ul className="mt-2 space-y-1">
                {plan.map((seg) => (
                  <li
                    key={seg.checkIn}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-[#121212]">
                      {formatDay(seg.checkIn)} – {formatDay(seg.checkOut)}
                    </span>
                    <span className="shrink-0 font-semibold text-[#121212]">
                      {seg.rooms} {seg.rooms === 1 ? "room" : "rooms"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[14px] text-[#7a6a45]">
                You&apos;re only charged for the rooms you have each night.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt>
              {adjusted ? (
                <>
                  ${villa.price.toFixed(2)} x {roomNights} room-night
                  {roomNights === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  ${villa.price.toFixed(2)}
                  {roomBased ? ` x ${rooms} room${rooms === 1 ? "" : "s"}` : ""} x{" "}
                  {nights} night{nights === 1 ? "" : "s"}
                </>
              )}
            </dt>
            <dd>${q.subtotal.toFixed(2)}</dd>
          </div>
          {q.discountAmount > 0 && (
            <div className="flex items-center justify-between text-brand">
              <dt>{q.discount.label}</dt>
              <dd>−${q.discountAmount.toFixed(2)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt>
              <Link href="#" className="underline">
                Service fee
              </Link>
            </dt>
            <dd>${q.serviceFee.toFixed(2)}</dd>
          </div>
          {extras.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-6">
              <dt className="min-w-0 truncate">{s.name}</dt>
              <dd className="shrink-0">
                {s.price > 0 ? `$${s.price.toFixed(2)}` : "Free"}
              </dd>
            </div>
          ))}
          {coupon && (
            <div className="flex items-center justify-between text-[#1c7d5c]">
              <dt>{coupon.code ? `Coupon ${coupon.code}` : "Host’s discount"}</dt>
              <dd>−${couponDiscount.toFixed(2)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between pt-8 font-semibold">
            <dt>{modify || pay ? "New total (USD)" : "Total (USD)"}</dt>
            <dd>${dueTotal.toFixed(2)}</dd>
          </div>
          {modify && (
            <>
              <div className="flex items-center justify-between text-[#4a4a4a]">
                <dt>Already paid</dt>
                <dd>−${modify.alreadyPaid.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between font-semibold text-brand">
                <dt>Balance due now</dt>
                <dd>${modify.balanceDue.toFixed(2)}</dd>
              </div>
            </>
          )}
          {/* An owner-arranged stay may carry the owner's promised discount and,
              on a merged upgrade, credit for the stay the guest already paid —
              each on its own line so the final figure explains itself. */}
          {pay && (
            <>
              {pay.hostDiscount > 0 && (
                <div className="flex items-center justify-between text-brand">
                  <dt>Host&rsquo;s discount</dt>
                  <dd>−${pay.hostDiscount.toFixed(2)}</dd>
                </div>
              )}
              {pay.credit > 0 && (
                <div className="flex items-center justify-between text-[#4a4a4a]">
                  <dt>Your earlier stay (already paid)</dt>
                  <dd>−${pay.credit.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between font-semibold text-brand">
                <dt>Due now</dt>
                <dd>${pay.amount.toFixed(2)}</dd>
              </div>
            </>
          )}
        </dl>
      )}
      {couponSlot && <div className="px-[25px]">{couponSlot}</div>}
    </aside>
  );
}

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    villa?: string;
    in?: string;
    out?: string;
    guests?: string;
    rooms?: string;
    /** "1" when the guest opted into an adjusted stay (rooms vary per night). */
    flex?: string;
    /** "1" when the guest already holds rooms on these dates and `rooms`
     *  counts rooms to ADD — booked as a new, separate stay. */
    add?: string;
    svc?: string;
    pkg?: string;
    /** Set when this checkout is the top-up for modifying an existing booking. */
    modify?: string;
    /** Set when settling an owner-made booking the guest still owes for. */
    pay?: string;
    /** Coupon code the guest applied at checkout. */
    coupon?: string;
  }>;
}) {
  const params = await searchParams;

  // Booking needs an account — send guests to sign in and bring them straight
  // back to this checkout (villa, dates, guests, rooms, services, package kept).
  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams();
    for (const key of ["villa", "in", "out", "guests", "rooms", "flex", "add", "svc", "pkg", "modify", "pay"] as const) {
      if (params[key]) qs.set(key, params[key]!);
    }
    redirect(loginHref(`/payment${qs.size ? "?" + qs.toString() : ""}`));
  }

  // The villa must be one the guest actually chose. Never fall back to a
  // "default" villa — otherwise a param-less /payment would let someone pay for
  // a place they never selected (which is exactly how a wrong-villa booking
  // slipped through before).
  // Pay mode: settling a booking the OWNER made for this guest. The stay already
  // exists, so its villa, dates, rooms, guests, add-ons and price are all read
  // off the row — nothing here comes from the URL. The query returns null unless
  // the booking is this guest's own and genuinely still unpaid, which is what
  // stops one guest paying (or reading) another's, or paying twice.
  const payId = Number(params.pay);
  const payBooking =
    Number.isInteger(payId) && payId > 0
      ? await getBookingToPay(payId, user.id)
      : null;
  if (params.pay && !payBooking) redirect("/profile/bookings");

  const villaId = payBooking ? payBooking.villaId : Number(params.villa);
  const villa = Number.isInteger(villaId) ? await getVillaById(villaId) : null;
  if (!villa) redirect("/search");

  // Owners can't book their own villa — send them to its manage view.
  if (villa.owner_id === user.id) redirect(`/place?id=${villa.id}`);

  // Locked: no NEW booking can be checked out here — back to the listing,
  // which explains it isn't taking bookings. A `modify` top-up is deliberately
  // still allowed through: on a locked stay the guest may add rooms/guests
  // and owes the difference, and modifyBookingAction is what enforces that its
  // dates don't move. Gating this on `modify` is what keeps that flow alive.
  // Paying for a stay that already exists is exempt for the same reason modify
  // is: the booking was made before (or despite) the lock, and the guest
  // still owes for it.
  if (villa.locked_at !== null && !params.modify && !payBooking)
    redirect(`/place?id=${villa.id}`);

  const roomBased = isRoomBased(villa.kind);

  // Package mode: a package fixes the duration, occupancy and price server-side
  // (the guest only chose a start date). Load it and verify it's this villa's.
  // A locked package can't start a new booking (packages have no top-up
  // flow — their price is fixed — so there's no modify exception to make).
  const pkgId = Number(params.pkg);
  const pkg = Number.isInteger(pkgId) ? await getPackageById(pkgId) : null;
  if (params.pkg && (!pkg || pkg.villaId !== villa.id || pkg.locked))
    redirect(`/place?id=${villa.id}`);

  let checkIn: string;
  let checkOut: string;
  let guests: number;
  let rooms: number;
  let svcIndices: number[] = [];
  let extras: VillaService[] = [];
  /** Set only for an adjusted stay — the per-leg room counts. Empty otherwise. */
  let plan: RoomSegment[] = [];

  if (payBooking) {
    // Nothing to choose: the owner already set these terms and the guest is
    // simply settling them. A stay the owner fulfilled night by night carries
    // its legs, so the summary itemizes them instead of pretending one count
    // fits every night.
    checkIn = payBooking.checkIn;
    checkOut = payBooking.checkOut;
    guests = payBooking.guests;
    rooms = payBooking.rooms;
    extras = payBooking.extras;
    plan = payBooking.plan ?? [];
  } else if (pkg) {
    // Only the start date is the guest's; it must be real and not in the past.
    // Everything else is derived from the package.
    if (!parseDay(params.in) || params.in! < dayFromNow(0))
      redirect(`/place?id=${villa.id}`);
    checkIn = params.in!;
    checkOut = addDays(checkIn, pkg.nights);
    guests = pkg.maxGuests;
    rooms = roomsForGuests(villa.kind, guests, villa.people_per_room);
  } else {
    // Hotels/resorts reserve rooms (each sleeping people_per_room); other kinds
    // book the whole place. Clamp the ask to the inventory — rooms aren't
    // rationed per guest, so this is the same clamp createBookingAction applies
    // and the price quoted here is for exactly the rooms that end up booked.
    const roomsParam = Number(params.rooms);
    const roomsWanted = roomBased
      ? Math.min(
          Math.max(1, villa.rooms),
          Number.isInteger(roomsParam) && roomsParam >= 1 ? roomsParam : 1,
        )
      : 1;
    const guestsParam = Number(params.guests);
    const guestsWanted =
      Number.isInteger(guestsParam) && guestsParam >= 1 ? guestsParam : 2;

    // Dates must be real, in the future, and chosen by the guest.
    const datesValid =
      !!parseDay(params.in) &&
      !!parseDay(params.out) &&
      nightsBetween(params.in!, params.out!) >= 1 &&
      nightsBetween(params.in!, params.out!) <= MAX_STAY_NIGHTS &&
      params.in! >= dayFromNow(0);
    if (!datesValid) redirect(`/place?id=${villa.id}&guests=${guestsWanted}`);
    checkIn = params.in!;
    checkOut = params.out!;

    // Nights the guest already covers with rooms held here are trimmed off, the
    // same way the booking card and createBookingAction trim them — so the price
    // shown is for exactly the nights that end up booked. A range that's fully
    // covered (or gapped) has nothing this checkout can charge for; send the
    // guest back to the villa page, which explains why.
    if (roomBased && !params.modify) {
      const mine = await getGuestRoomBookings(villa.id, user.id);
      // Over the property's per-guest night budget this isn't a checkout but a
      // host-arranged stay — bounce back to the villa page, which offers the
      // call. createBookingAction is the authority; this keeps the guest off a
      // checkout that would only be refused.
      if (
        hasDayLimit(villa.max_booking_days) &&
        dayBudget(villa.max_booking_days, mine, checkIn, checkOut).overBudget
      )
        redirect(
          `/place?id=${villa.id}&in=${checkIn}&out=${checkOut}&guests=${guestsWanted}`,
        );
      // Add mode: the ask is rooms ON TOP of ones the guest already holds,
      // wanted on every picked night — nothing to trim, the whole range books
      // as its own separate stay.
      if (params.add !== "1") {
        const span = neededSpan(checkIn, checkOut, roomsWanted, mine);
        if (!span || span.gap)
          redirect(
            `/place?id=${villa.id}&in=${checkIn}&out=${checkOut}&guests=${guestsWanted}`,
          );
        checkIn = span.checkIn;
        checkOut = span.checkOut;
      }
    }

    // Whole-villa listings enforce the same per-guest night budget, minus the
    // room-trim machinery above (a villa is one unit — no per-room top-ups).
    // Over budget it's a host-arranged stay, so bounce to the villa page.
    if (!roomBased && !params.modify) {
      const mine = await getGuestRoomBookings(villa.id, user.id);
      if (
        hasDayLimit(villa.max_booking_days) &&
        dayBudget(villa.max_booking_days, mine, checkIn, checkOut).overBudget
      )
        redirect(
          `/place?id=${villa.id}&in=${checkIn}&out=${checkOut}&guests=${guestsWanted}`,
        );
    }

    // Adjusted stay: the guest asked for more rooms than are free on every
    // night and chose to take what each night can give instead. The URL carries
    // only the ask and the opt-in — the actual split (and therefore the price)
    // is re-derived here from live availability, never trusted from the client.
    // Modifying an existing booking can't produce one, so it's excluded.
    if (roomBased && params.flex === "1") {
      // Passing the guest applies their own per-night allowance too, so the
      // split priced here is the one the booking card offered — and the one
      // createBookingAction will re-derive on submit. Add mode prices rooms
      // to ADD, so the plan is inventory-only (guest 0): min(add, free) per
      // night, the guest's held rooms already counting as taken. Modify mode
      // is inventory-only too, with the booking being edited excluded so its
      // own rooms return to the pool — the same plan modifyBookingAction will
      // re-derive on submit.
      const editingId = Number(params.modify);
      const derived = await getRoomPlan(
        villa.id,
        checkIn,
        checkOut,
        roomsWanted,
        Number.isInteger(editingId) && editingId > 0 ? editingId : 0,
        params.add === "1" || params.modify ? 0 : user.id,
      );
      // If the count doesn't actually change, it's just a normal flat stay.
      if (isGraduated(derived)) plan = derived;
    }

    rooms = plan.length > 0 ? planMaxRooms(plan) : roomsWanted;
    // Occupancy sums what EACH leg of an adjusted stay sleeps, matching the
    // booking card and createBookingAction — a 1-room leg plus a 6-room leg
    // offers 2 + 12 guests, not the peak leg's 12.
    const cap = roomBased
      ? Math.max(
          1,
          plan.length > 0
            ? plan.reduce((s, leg) => s + leg.rooms * villa.people_per_room, 0)
            : rooms * villa.people_per_room,
        )
      : Math.max(1, villa.max_guests);
    guests = Math.min(cap, guestsWanted);

    // Extra services picked on the villa page, as indices into the villa's
    // service list — prices always come from the DB, never the URL. Only paid
    // add-ons count (free ones come with the stay).
    const villaServices = parseServiceList(villa.services);
    svcIndices = [
      ...new Set(
        // Guard the empty string: "".split(",") is [""], and Number("") is 0
        // (not NaN), which would silently select service index 0.
        (params.svc ? params.svc.split(",") : [])
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < villaServices.length),
      ),
    ].filter((i) => villaServices[i].price > 0);
    extras = svcIndices.map((i) => villaServices[i]);
  }

  const nights = nightsBetween(checkIn, checkOut);
  // Room-nights the stay actually holds. For a flat stay this is just
  // rooms × nights, so pricing is unchanged; an adjusted stay sums its legs.
  const roomNights =
    plan.length > 0 ? planRoomNights(plan) : (roomBased ? rooms : 1) * nights;

  // Modify mode: the guest edited an existing nightly booking and this checkout
  // is the top-up for a HIGHER total. Confirm the booking is theirs, still active
  // and upcoming, then work out the balance due — the new total minus what
  // they've already paid, both priced at today's rate so the difference reflects
  // only their changes. Non-increases never route here (the manage card applies
  // those directly), so a ≤0 balance bounces back to the manage page.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const modifyId = Number(params.modify);
  const isModify = Number.isInteger(modifyId) && modifyId > 0;
  let alreadyPaid = 0;
  let balanceDue = 0;
  /** The modified booking's own discount (coupon or owner's) — re-applied to
   *  the new total so an edit never silently drops it. */
  let modifyDiscount: { code: string; pct: number; fixed: number } | null = null;
  if (isModify) {
    const today = dayFromNow(0);
    const mb = await getBookingForManage(modifyId, user.id);
    if (
      !mb ||
      mb.villaId !== villa.id ||
      mb.status !== "accepted" ||
      mb.checkOut < today ||
      mb.package !== null
    ) {
      redirect("/profile/bookings");
    }
    const villaServices = parseServiceList(villa.services);
    const oldExtrasTotal = mb.extras
      .map((e) => villaServices.findIndex((s) => s.name === e.name))
      .filter((i) => i >= 0)
      .reduce((sum, i) => sum + (villaServices[i]?.price ?? 0), 0);
    // Both sides of the reconciliation carry the booking's own discount — the
    // guest PAID the discounted figure, and their coupon (or the owner's
    // promise) survives the edit. A coupon still can't take a total below $1.
    const withBookingDiscount = (base: number) => {
      const raw =
        (base * Math.max(0, mb.discPct)) / 100 + Math.max(0, mb.discFixed);
      const cap = mb.couponCode ? Math.max(0, base - 1) : base;
      return round2(base - Math.min(cap, raw));
    };
    if (mb.discPct > 0 || mb.discFixed > 0)
      modifyDiscount = { code: mb.couponCode, pct: mb.discPct, fixed: mb.discFixed };
    // Both sides priced by ROOM-NIGHTS so a night-by-night stay reconciles
    // honestly: the old side sums the legs it actually held (flat stays are
    // just rooms × nights), the new side prices the freshly derived plan the
    // same way the plan block above and modifyBookingAction do.
    const oldNights = Math.max(1, nightsBetween(mb.checkIn, mb.checkOut));
    const oldRoomNights = mb.roomPlan
      ? planRoomNights(mb.roomPlan)
      : (roomBased ? mb.bookingRooms : 1) * oldNights;
    alreadyPaid = withBookingDiscount(
      round2(
        quote(
          (villa.price * oldRoomNights) / oldNights,
          oldNights,
          villa.discount,
        ).total + oldExtrasTotal,
      ),
    );
    const newTotal = withBookingDiscount(
      round2(
        quote(
          nights > 0 ? (villa.price * roomNights) / nights : 0,
          nights,
          villa.discount,
        ).total + extras.reduce((sum, e) => sum + e.price, 0),
      ),
    );
    balanceDue = round2(newTotal - alreadyPaid);
    if (balanceDue <= 0) redirect(`/booking?id=${modifyId}`);
  }

  /* Coupon (new checkouts only — settling or modifying an existing stay has
     its own money story). Resolved server-side from the URL: it must exist
     and belong to THIS property. The form carries the validated code to
     createBookingAction, which re-validates and snapshots it. */
  const couponParam = (params.coupon ?? "").trim();
  const couponAllowed = !payBooking && !isModify;
  const foundCoupon =
    couponAllowed && couponParam ? await findCoupon(couponParam) : null;
  const couponValid = !!foundCoupon && foundCoupon.villaId === villa.id;
  const couponInvalid = couponAllowed && !!couponParam && !couponValid;
  // One coupon, one use per guest — for good: a code that's real and for this
  // property but which this guest has ever applied to a booking doesn't apply,
  // even if that booking was later cancelled. It's its own state, not "invalid"
  // — the code is fine, they've just spent it.
  const couponUsed = couponValid && (await hasRedeemedCoupon(user.id, couponParam));
  // Only a coupon that's valid AND unspent actually discounts the checkout.
  const couponRedeemable = couponValid && !couponUsed;

  // The guest's own booking is excluded when modifying so its current dates never
  // read as a clash against the (possibly overlapping) new range. An adjusted
  // stay is checked leg by leg — a single bottleneck figure would reject the
  // very legs that ask for more rooms.
  // Paying IS the reservation for an owner-made booking — it's pending until
  // then and holds nothing — so its availability is checked like any other
  // checkout. Its own row is excluded, though a pending row is invisible to the
  // engine anyway. If the rooms went in the meantime, the guest is told here
  // rather than after being charged.
  const available = payBooking
    ? plan.length > 0
      ? // An owner-fulfilled adjusted stay: leg by leg here too — its `rooms`
        // column carries the PEAK night, and demanding that every night would
        // reject the very stay being paid for.
        await isPlanAvailable(villa.id, plan, payBooking.id)
      : await isVillaAvailable(
          villa.id,
          checkIn,
          checkOut,
          rooms,
          payBooking.id,
        )
    : plan.length > 0
      ? await isPlanAvailable(villa.id, plan, isModify ? modifyId : 0)
      : await isVillaAvailable(
          villa.id,
          checkIn,
          checkOut,
          rooms,
          isModify ? modifyId : 0,
        );
  // If the dates are taken, is it the guest's OWN booking? (e.g. they just paid
  // and refreshed, or came back to checkout.) Then reassure them instead of
  // telling them the villa was snatched away.
  const ownBooking = available
    ? null
    : await getOwnBookingForRange(user.id, villa.id, checkIn, checkOut);

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[60px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{"  /  "}</span>
            <Link href={`/place?id=${villa.id}`} className="underline">{villa.name}</Link>
            <span className="font-light">{" / "}</span>
            <span>Confirm Payment</span>
          </nav>

          <div className="mt-[45px] flex items-center justify-between">
            <h1 className="text-[36px] font-semibold leading-[1.3] text-[#121212]">
              Confirm Payment
            </h1>
            <Link
              href={isModify ? `/booking?id=${modifyId}` : `/place?id=${villa.id}`}
              className="text-[30px] leading-[1.35] text-black underline"
            >
              Cancel
            </Link>
          </div>

          {/* Figma: 777px form + 75px gap + 758px summary on a 1610px row */}
          <div className="mt-[35px] flex flex-col gap-12 lg:flex-row lg:gap-[4.66%]">
            <div className="w-full lg:w-[48.26%] lg:shrink-0">
              {available ? (
                <>
                  {payBooking ? (
                    /* Not an offer to book — the stay is already held. Say who
                       arranged it so the request isn't a surprise. */
                    <p
                      role="status"
                      className="mb-8 flex items-start gap-3 rounded-[10px] bg-[#fdf9f0] px-5 py-4 text-[16px] leading-[1.5] text-[#8a6a1f]"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
                        <path d="M12 8v5m0 3h.01M12 21a9 9 0 100-18 9 9 0 000 18Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>
                        {payBooking.upgraded ? (
                          <>
                            <span className="font-semibold">{payBooking.hostName}</span>{" "}
                            upgraded your existing stay at {villa.name} — it now
                            covers {formatDay(checkIn)} – {formatDay(checkOut)} with{" "}
                            {payBooking.rooms} room{payBooking.rooms === 1 ? "" : "s"}.
                            What you already paid is credited below; only the
                            difference is due.
                          </>
                        ) : (
                          /* A pending owner-made stay holds NOTHING until it's
                             paid — saying "already held" here would promise
                             rooms someone else can still take. */
                          <>
                            <span className="font-semibold">{payBooking.hostName}</span>{" "}
                            booked this stay for you at {villa.name} and is asking you
                            to pay for it. Paying is what reserves the room
                            {payBooking.rooms === 1 ? "" : "s"} for{" "}
                            {formatDay(checkIn)} – {formatDay(checkOut)} — until
                            then {payBooking.rooms === 1 ? "it isn't" : "they aren't"}{" "}
                            held.
                          </>
                        )}
                      </span>
                    </p>
                  ) : (
                    <p
                      role="status"
                      className="mb-8 flex items-center gap-3 rounded-[10px] bg-brand/10 px-5 py-4 text-[16px] text-brand-dark"
                    >
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="shrink-0">
                        <circle cx="11" cy="11" r="10" fill="#5D5FEF" />
                        <path d="M6.5 11.5l3 3 6-6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {villa.name} is available for {formatDay(checkIn)} –{" "}
                      {formatDay(checkOut)} ({nights} night{nights === 1 ? "" : "s"}).
                    </p>
                  )}
                  <PaymentForm
                    villaId={villa.id}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    /* A stay starting today has already begun, so it can never
                       be cancelled — warn before they pay, not after. Derived
                       here (server) so it can't drift from the guard. */
                    startsToday={checkIn === dayFromNow(0)}
                    guests={guests}
                    rooms={rooms}
                    roomBased={roomBased}
                    flex={plan.length > 0}
                    /* Rooms to ADD to a stay the guest already holds here —
                       booked as its own separate stay, never merged. */
                    add={!payBooking && !pkg && !isModify && params.add === "1"}
                    services={svcIndices}
                    packageId={pkg ? pkg.id : undefined}
                    couponCode={
                      couponRedeemable && foundCoupon ? foundCoupon.code : undefined
                    }
                    modify={
                      isModify ? { bookingId: modifyId, amountDue: balanceDue } : undefined
                    }
                    pay={
                      payBooking
                        ? { bookingId: payBooking.id, amountDue: payBooking.amount }
                        : undefined
                    }
                    profile={{
                      email: user.email,
                      phoneCode: dialValueFor(user.phone_code, user.country),
                      phoneNumber: user.phone_number,
                      country: user.country,
                    }}
                  />
                </>
              ) : ownBooking ? (
                <div className="rounded-[10px] bg-white px-8 py-14 text-center shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)]">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                    <svg width="30" height="30" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="10" fill="#5D5FEF" />
                      <path d="M6.5 11.5l3 3 6-6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h2 className="mt-6 text-[24px] font-semibold leading-[1.3] text-[#121212]">
                    Your stay is confirmed
                  </h2>
                  <p className="mx-auto mt-3 max-w-[480px] text-[16px] leading-[1.5] text-[#4a4a4a]">
                    You have a confirmed booking at {villa.name}, {villa.city} for{" "}
                    <span className="font-semibold">{formatDay(ownBooking.checkIn)}</span> to{" "}
                    <span className="font-semibold">{formatDay(ownBooking.checkOut)}</span>.
                    View or manage it any time in My Bookings.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                      href="/profile/bookings"
                      className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      View in My Bookings
                    </Link>
                    <Link
                      href={`/place?id=${villa.id}`}
                      className="rounded-[8px] border border-brand px-6 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
                    >
                      Book different dates
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-[10px] bg-white px-8 py-14 text-center shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)]">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#eb5757" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <rect x="3.5" y="5" width="17" height="15" rx="1.8" />
                      <path d="M3.5 9.5h17M8 3v4M16 3v4M9 14.5l6 0" />
                    </svg>
                  </span>
                  <h2 className="mt-6 text-[24px] font-semibold leading-[1.3] text-[#121212]">
                    Already booked for these dates
                  </h2>
                  <p className="mx-auto mt-3 max-w-[480px] text-[16px] leading-[1.5] text-[#4a4a4a]">
                    {villa.name}, {villa.city} is taken from{" "}
                    <span className="font-semibold">{formatDay(checkIn)}</span> to{" "}
                    <span className="font-semibold">{formatDay(checkOut)}</span>.
                    Pick different dates to book this villa, or find a similar
                    place that&apos;s free.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                      href={`/place?id=${villa.id}`}
                      className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Pick different dates
                    </Link>
                    <Link
                      href={`/search?q=${encodeURIComponent(villa.city)}`}
                      className="rounded-[8px] border border-brand px-6 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
                    >
                      Similar villas in {villa.city}
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <BookingSummary
              villa={villa}
              nights={nights}
              extras={extras}
              rooms={rooms}
              roomBased={roomBased}
              roomNights={roomNights}
              plan={plan}
              pkg={pkg}
              coupon={
                couponRedeemable && foundCoupon
                  ? {
                      code: foundCoupon.code,
                      pct: foundCoupon.pct,
                      fixed: foundCoupon.fixed,
                    }
                  : modifyDiscount
              }
              couponSlot={
                couponAllowed ? (
                  <CouponField
                    applied={
                      couponRedeemable && foundCoupon ? foundCoupon.code : null
                    }
                    invalid={couponInvalid}
                    alreadyUsed={couponUsed}
                  />
                ) : null
              }
              modify={isModify ? { alreadyPaid, balanceDue } : undefined}
              pay={
                payBooking
                  ? {
                      hostDiscount: payBooking.hostDiscount,
                      credit: payBooking.credit,
                      amount: payBooking.amount,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
