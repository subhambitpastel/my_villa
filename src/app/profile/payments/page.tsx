import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getBookingsForGuest } from "@/lib/queries";
import { bookingReference } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Payment Pending",
  description: "Stays your host booked for you that are waiting to be paid.",
};

/**
 * Stays a host arranged on the guest's behalf that nobody has paid for yet.
 *
 * Its own section rather than a corner of My Bookings, because it's the one
 * place in the app with a deadline attached: these bookings hold no rooms until
 * they're paid, so an unnoticed one quietly turns into a lost stay.
 */
export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const bookings = await getBookingsForGuest(user.id);
  // Two payable shapes, and the page must show BOTH: 'pending' stays the host
  // arranged (unpaid, holding nothing), and 'accepted' stays with a balance —
  // upgrades that absorbed an already-paid booking, whose rooms ARE held.
  const due = bookings.filter(
    (b) => b.paymentDue && (b.status === "pending" || b.status === "accepted"),
  );
  const unheld = due.filter((b) => b.status === "pending");
  const total = due.reduce((sum, b) => sum + b.amountPaid, 0);

  if (due.length === 0) {
    return (
      <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
        <h1 className="text-[16px] font-semibold text-[#121212]">
          Payment Pending
        </h1>
        <div className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f2f2f5] text-[#a1a1a2]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 7h18v10H3zM3 11h18M7 15h3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="mt-4 text-[14px] font-medium text-[#121212]">
            Nothing to pay for
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-[1.6] text-[#a1a1a2]">
            When a host books a stay on your behalf, the request to pay for it
            shows up here. Stays you book yourself are paid at checkout, so they
            never appear.
          </p>
          <Link
            href="/profile/bookings"
            className="mt-5 inline-block text-[13px] font-medium text-brand underline"
          >
            Go to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">
            {String(due.length).padStart(2, "0")}
          </span>{" "}
          Payment Pending
        </h1>
        <p className="text-[14px] font-semibold text-[#121212]">
          ${total.toFixed(2)} due
        </p>
      </div>

      {/* The whole point of this page: pending ones are not reservations yet. */}
      {unheld.length > 0 && (
        <p className="mt-3 rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] px-4 py-3 text-[13px] leading-[1.6] text-[#7a6a45]">
          Your host booked {unheld.length === 1 ? "this stay" : "these stays"}{" "}
          for you.{" "}
          <span className="font-semibold text-[#8a6a1f]">
            The room{unheld.length === 1 ? " isn't" : "s aren't"} held until you
            pay
          </span>{" "}
          — the booking stays pending, and someone else can still take{" "}
          {unheld.length === 1 ? "it" : "them"} in the meantime.
        </p>
      )}
      {due.length > unheld.length && (
        <p className="mt-3 rounded-[8px] border border-[#bfe0d2] bg-[#f1faf6] px-4 py-3 text-[13px] leading-[1.6] text-[#3d6b58]">
          Upgraded stays keep their rooms —{" "}
          <span className="font-semibold text-[#1c7d5c]">
            your host grew a booking you already paid for
          </span>
          , so what you paid is taken off and only the difference is owed.
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {due.map((b) => (
          <li
            key={b.id}
            className="rounded-[8px] border border-[#dfdfdf] p-4 transition-colors hover:border-brand/40"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-heading">{b.villa}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#a1a1a2]">
                  <span className="rounded-[3px] bg-[#e9e8fd] px-1.5 py-0.5 text-brand">
                    {b.kind}
                  </span>
                  {b.status === "pending" ? (
                    <span className="rounded-[3px] bg-[#fff3d6] px-1.5 py-0.5 font-semibold text-[#a06a00]">
                      Payment pending · rooms not held yet
                    </span>
                  ) : (
                    <span className="rounded-[3px] bg-[#e5f4ee] px-1.5 py-0.5 font-semibold text-[#1c7d5c]">
                      Balance due · your rooms are held
                    </span>
                  )}
                  <span>{bookingReference(b.id)}</span>
                </p>
                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#a1a1a2]">
                      Stay
                    </dt>
                    <dd className="mt-0.5 text-[#121212]">
                      {b.dates}
                      {b.nights > 0 && (
                        <span className="text-[#a1a1a2]">
                          {" "}
                          · {b.nights} night{b.nights === 1 ? "" : "s"}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#a1a1a2]">
                      Guests
                    </dt>
                    <dd className="mt-0.5 text-[#121212]">{b.guests}</dd>
                  </div>
                  {b.rooms > 1 && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-[#a1a1a2]">
                        Rooms
                      </dt>
                      <dd className="mt-0.5 text-[#121212]">{b.rooms}</dd>
                    </div>
                  )}
                  {b.extras.length > 0 && (
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-[#a1a1a2]">
                        Add-ons
                      </dt>
                      <dd className="mt-0.5 text-[#121212]">
                        {b.extras.map((e) => e.name).join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                {/* The receipt behind the figure — the same three rows the host
                    saw when arranging it, so the number is never a surprise. */}
                {b.pay && (b.pay.hostDiscount > 0 || b.pay.alreadyPaid > 0) && (
                  <dl className="space-y-1 text-[12px] leading-[1.4] text-[#6a6a72]">
                    <div className="flex justify-between gap-6">
                      <dt>Full stay</dt>
                      <dd>${b.pay.fullStay.toFixed(2)}</dd>
                    </div>
                    {b.pay.hostDiscount > 0 && (
                      <div className="flex justify-between gap-6 text-brand">
                        <dt>{b.couponCode ? `Coupon ${b.couponCode}` : "Host’s discount"}</dt>
                        <dd>−${b.pay.hostDiscount.toFixed(2)}</dd>
                      </div>
                    )}
                    {b.pay.alreadyPaid > 0 && (
                      <div className="flex justify-between gap-6 text-[#1c7d5c]">
                        <dt>You already paid</dt>
                        <dd>−${b.pay.alreadyPaid.toFixed(2)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className="text-[20px] font-semibold leading-none text-[#121212]">
                  ${b.amountPaid.toFixed(2)}
                </p>
                <Link
                  href={`/payment?pay=${b.id}`}
                  className="rounded-[8px] bg-brand px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Pay now
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[12px] leading-[1.6] text-[#a1a1a2]">
        Don&rsquo;t recognise one of these? You won&rsquo;t be charged for
        anything you leave unpaid — ask your host about it
        {unheld.length > 0 ? "; pending stays reserve nothing until paid" : ""}.
      </p>
    </div>
  );
}
