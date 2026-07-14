import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PaymentForm from "@/components/payment/PaymentForm";
import { redirect } from "next/navigation";
import {
  getVillaById,
  getPackageById,
  isVillaAvailable,
  getOwnBookingForRange,
  getBookingForManage,
  parseServiceList,
  type PackageForBooking,
} from "@/lib/queries";
import type { VillaService } from "@/components/host/draft";
import { getCurrentUser } from "@/lib/session";
import { isRoomBased, roomsForGuests } from "@/lib/rooms";
import { addDays, dayFromNow, formatDay, nightsBetween, parseDay } from "@/lib/dates";
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
  pkg = null,
  modify,
}: {
  villa: VillaRow;
  nights: number;
  /** Extra services the guest picked in the Reserve dialog. */
  extras: VillaService[];
  /** Rooms reserved (hotels/resorts) — price scales per room per night. */
  rooms?: number;
  roomBased?: boolean;
  /** Set for a package booking — one all-inclusive price, no nightly breakdown. */
  pkg?: PackageForBooking | null;
  /** Set when this is a booking modification: shows the amount already paid and
   *  the balance due now (the top-up) instead of a single total. */
  modify?: { alreadyPaid: number; balanceDue: number };
}) {
  const q = quote(villa.price * (roomBased ? rooms : 1), nights, villa.discount);
  const extrasTotal = extras.reduce((sum, s) => sum + s.price, 0);
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
          <div className="mt-8 flex items-center justify-between border-t border-[#c6c6c6] pt-6 text-[26px] font-semibold leading-[1.3]">
            <span>Total (USD)</span>
            <span>${pkg.price.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <dl className="mt-8 space-y-[31px] pl-[39px] pr-[70px] text-[26px] leading-[1.3] text-[#121212]">
          <div className="flex items-center justify-between">
            <dt>
              ${villa.price.toFixed(2)}
              {roomBased ? ` x ${rooms} room${rooms === 1 ? "" : "s"}` : ""} x{" "}
              {nights} night{nights === 1 ? "" : "s"}
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
          <div className="flex items-center justify-between pt-8 font-semibold">
            <dt>{modify ? "New total (USD)" : "Total (USD)"}</dt>
            <dd>${(q.total + extrasTotal).toFixed(2)}</dd>
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
        </dl>
      )}
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
    svc?: string;
    pkg?: string;
    /** Set when this checkout is the top-up for modifying an existing booking. */
    modify?: string;
  }>;
}) {
  const params = await searchParams;

  // Booking needs an account — send guests to sign in and bring them straight
  // back to this checkout (villa, dates, guests, rooms, services, package kept).
  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams();
    for (const key of ["villa", "in", "out", "guests", "rooms", "svc", "pkg", "modify"] as const) {
      if (params[key]) qs.set(key, params[key]!);
    }
    redirect(loginHref(`/payment${qs.size ? "?" + qs.toString() : ""}`));
  }

  // The villa must be one the guest actually chose. Never fall back to a
  // "default" villa — otherwise a param-less /payment would let someone pay for
  // a place they never selected (which is exactly how a wrong-villa booking
  // slipped through before).
  const villaId = Number(params.villa);
  const villa = Number.isInteger(villaId) ? await getVillaById(villaId) : null;
  if (!villa) redirect("/search");

  // Owners can't book their own villa — send them to its manage view.
  if (villa.owner_id === user.id) redirect(`/place?id=${villa.id}`);

  const roomBased = isRoomBased(villa.kind);

  // Package mode: a package fixes the duration, occupancy and price server-side
  // (the guest only chose a start date). Load it and verify it's this villa's.
  const pkgId = Number(params.pkg);
  const pkg = Number.isInteger(pkgId) ? await getPackageById(pkgId) : null;
  if (params.pkg && (!pkg || pkg.villaId !== villa.id))
    redirect(`/place?id=${villa.id}`);

  let checkIn: string;
  let checkOut: string;
  let guests: number;
  let rooms: number;
  let svcIndices: number[] = [];
  let extras: VillaService[] = [];

  if (pkg) {
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
    // book the whole place. Clamp rooms to inventory, then cap guests.
    const roomsParam = Number(params.rooms);
    rooms = roomBased
      ? Math.min(
          Math.max(1, villa.rooms),
          Number.isInteger(roomsParam) && roomsParam >= 1 ? roomsParam : 1,
        )
      : 1;
    const cap = roomBased
      ? Math.max(1, rooms * villa.people_per_room)
      : Math.max(1, villa.max_guests);
    const guestsParam = Number(params.guests);
    guests = Math.min(
      cap,
      Number.isInteger(guestsParam) && guestsParam >= 1 ? guestsParam : 2,
    );

    // Dates must be real, in the future, and chosen by the guest.
    const datesValid =
      !!parseDay(params.in) &&
      !!parseDay(params.out) &&
      nightsBetween(params.in!, params.out!) >= 1 &&
      params.in! >= dayFromNow(0);
    if (!datesValid) redirect(`/place?id=${villa.id}&guests=${guests}`);
    checkIn = params.in!;
    checkOut = params.out!;

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
    alreadyPaid = round2(
      quote(
        villa.price * (roomBased ? mb.bookingRooms : 1),
        Math.max(1, nightsBetween(mb.checkIn, mb.checkOut)),
        villa.discount,
      ).total + oldExtrasTotal,
    );
    const newTotal = round2(
      quote(villa.price * (roomBased ? rooms : 1), nights, villa.discount).total +
        extras.reduce((sum, e) => sum + e.price, 0),
    );
    balanceDue = round2(newTotal - alreadyPaid);
    if (balanceDue <= 0) redirect(`/booking?id=${modifyId}`);
  }

  // The guest's own booking is excluded when modifying so its current dates never
  // read as a clash against the (possibly overlapping) new range.
  const available = await isVillaAvailable(
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
                  <PaymentForm
                    villaId={villa.id}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    guests={guests}
                    rooms={rooms}
                    roomBased={roomBased}
                    services={svcIndices}
                    packageId={pkg ? pkg.id : undefined}
                    modify={
                      isModify ? { bookingId: modifyId, amountDue: balanceDue } : undefined
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
              pkg={pkg}
              modify={isModify ? { alreadyPaid, balanceDue } : undefined}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
