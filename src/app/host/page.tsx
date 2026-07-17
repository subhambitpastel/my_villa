import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import HostWizard from "@/components/host/HostWizard";
import { formatDay } from "@/lib/dates";
import {
  DEFAULT_DRAFT,
  FACILITY_CHIPS,
  SERVICES,
  type Draft,
} from "@/components/host/draft";
import { getCurrentUser } from "@/lib/session";
import { getVillaBookingLock, getVillaDetail, type BookingLock } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Add your Villa",
  description:
    "Register your villa for renting on MyVilla — add your details, photos, pricing and the account where you'll receive guest payments.",
};

/** Shown instead of the edit wizard when the villa still has live bookings.
 *  Reached only by typing the URL — My Properties already hides the Edit link. */
function LockedNotice({ villa, lock }: { villa: string; lock: BookingLock }) {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-20">
        <div className="mx-auto max-w-2xl px-6 pt-16">
          <div className="rounded-[12px] border border-line/60 bg-white p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3d6] text-[#a06a00]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0110 0v3M5 10h14v11H5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="mt-4 text-[20px] font-semibold text-[#121212]">
              This listing can&rsquo;t be edited yet
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#4a4a4a]">
              <span className="font-semibold">{villa}</span> has{" "}
              <span className="font-semibold">
                {lock.active} active booking{lock.active === 1 ? "" : "s"}
              </span>
              . Guests booked it exactly as it&rsquo;s listed, so its details
              stay put until those stays are done
              {lock.lastCheckOut ? (
                <>
                  {" "}
                  — the last one checks out on{" "}
                  <span className="font-semibold">{formatDay(lock.lastCheckOut)}</span>
                </>
              ) : null}
              . You can wait for them to complete, or cancel them all in Rent
              Requests to edit now.
            </p>
            {/* Two different things are called "locked" on this page: editing is
                frozen BY the live bookings, whereas locking the listing is the
                owner's own switch — and that switch always works. It's the
                answer for an owner who only wants the bookings to stop, without
                waiting out the calendar or cancelling on anyone. */}
            <div className="mx-auto mt-5 max-w-md rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] p-4 text-left">
              <p className="text-[13px] font-semibold text-[#8a6a1f]">
                Just want to stop taking further bookings?
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#7a6a45]">
                Lock the listing from{" "}
                <Link href="/profile/properties" className="underline">
                  My Properties
                </Link>{" "}
                instead — that switch always works, even while editing is
                frozen. It won&rsquo;t affect the {lock.active} booking
                {lock.active === 1 ? "" : "s"} already made (those stays go ahead
                as planned), and no new bookings can come in. You can unlock it
                whenever you like.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/profile/requests"
                className="rounded-[8px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Go to Rent Requests
              </Link>
              <Link
                href="/profile/properties"
                className="text-[13px] text-[#7a7a85] underline hover:opacity-80"
              >
                Back to My Properties
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await getCurrentUser();

  const personal = user
    ? {
        fullName: user.full_name,
        gender: user.gender,
        email: user.email,
        dob: user.dob,
        address: user.address,
      }
    : undefined;

  // Personal details are only asked once — returning hosts whose profile
  // already covers the required fields go straight to Villa Details.
  const personalComplete = !!(
    user &&
    user.full_name.trim() &&
    user.gender &&
    user.dob.trim() &&
    user.address.trim()
  );

  // Edit mode: prefill the wizard from the villa being edited (owner only).
  let editId: number | undefined;
  let editDraft: Draft | undefined;
  // A villa with live bookings is frozen — guests booked it as it stands, so
  // nothing about it may change until those stays finish. My Properties hides
  // the Edit link, but the URL is guessable, so gate here too (and
  // updateVillaAction is the final authority).
  if (edit && user) {
    const villa = await getVillaDetail(Number(edit));
    if (villa && villa.owner_id === user.id) {
      const bookingLock = await getVillaBookingLock(villa.id);
      if (bookingLock.active > 0)
        return <LockedNotice villa={villa.name} lock={bookingLock} />;
      editId = villa.id;
      // Prefill the Payment step from the host's stored payout details, so
      // editing it round-trips instead of overwriting the card with a blank.
      let payMethods = DEFAULT_DRAFT.payment.methods;
      try {
        const parsed = JSON.parse(user.pay_methods || "[]");
        if (Array.isArray(parsed) && parsed.length)
          payMethods = parsed.filter((m): m is string => typeof m === "string");
      } catch {
        /* corrupt value — keep the default method set */
      }
      editDraft = {
        ...DEFAULT_DRAFT,
        personal: personal!,
        villa: {
          kind: villa.kind,
          name: villa.name,
          description: villa.description,
          area: villa.area,
          address: villa.address,
          // Old rows derived city from the address; don't prefill that junk.
          city: villa.city === villa.name ? "" : villa.city,
          rooms: String(villa.rooms),
          maxGuests: String(villa.max_guests),
          peoplePerRoom: villa.people_per_room ? String(villa.people_per_room) : "",
          maxBookingDays: villa.max_booking_days ? String(villa.max_booking_days) : "",
          facilities: villa.facilityList,
        },
        images: villa.gallery,
        services: {
          selected: villa.serviceList.map((s) => s.name),
          prices: Object.fromEntries(
            villa.serviceList
              .filter((s) => s.price > 0)
              .map((s) => [s.name, String(s.price)]),
          ),
          customs: villa.serviceList
            .map((s) => s.name)
            .filter((n) => !SERVICES.includes(n) && !FACILITY_CHIPS.includes(n)),
        },
        price: villa.price,
        discount: villa.discount,
        payment: {
          methods: payMethods,
          accountType: user.pay_account_type || DEFAULT_DRAFT.payment.accountType,
          cardNumber: user.card_number,
        },
      };
    }
  }

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <HostWizard
            authed={user !== null}
            initialPersonal={personal}
            avatarUrl={user?.avatar}
            editId={editId}
            editDraft={editDraft}
            skipPersonal={personalComplete}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
