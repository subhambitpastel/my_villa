"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rateStayAction, updateReviewAction } from "@/lib/actions";
import Dropdown from "@/components/ui/Dropdown";
import AccountSearch from "@/components/account/AccountSearch";
import { matchesSearch } from "@/lib/textSearch";
import type { BookingItem } from "@/lib/queries";
import { bookingReference } from "@/lib/pricing";
import { formatRange } from "@/lib/dates";
import { isRoomBased } from "@/lib/rooms";

/* eslint-disable @next/next/no-img-element */

function Star({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <img
      src={filled ? "/icons/star-filled.svg" : "/icons/star-unfilled.svg"}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

/** Five clickable stars until rated, then a read-only row of the given stars. */
const REVIEW_STATE: Record<string, { label: string; className: string }> = {
  pending: { label: "In review", className: "text-[#a06a00]" },
  approved: { label: "Published", className: "text-[#1c7d5c]" },
  rejected: { label: "Not published", className: "text-[#eb5757]" },
};

function StarRater({
  rated,
  review,
  disabled,
  onRate,
  onEdit,
}: {
  rated: number | null;
  review: BookingItem["myReview"];
  disabled: boolean;
  onRate: (stars: number) => void;
  onEdit: () => void;
}) {
  const [hover, setHover] = useState(0);

  if (rated) {
    const state = review ? REVIEW_STATE[review.status] : null;
    return (
      <span className="flex flex-col items-end gap-0.5">
        <span
          className="flex items-center gap-0.5"
          aria-label={`You rated this stay ${rated} out of 5 stars`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} filled={n <= rated} />
          ))}
        </span>
        {state && (
          <span className={`text-[11px] font-semibold ${state.className}`}>
            {state.label}
          </span>
        )}
        {review?.canEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            title={`You can change this for another ${review.hoursLeft} hour${review.hoursLeft === 1 ? "" : "s"}.`}
            className="text-[11px] text-brand underline hover:opacity-80 disabled:opacity-60"
          >
            Edit ({review.hoursLeft}h left)
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onRate(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
            className="transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star filled={n <= hover} />
          </button>
        ))}
      </span>
      <span className="text-[11px] text-[#a1a1a2]">Rate your stay</span>
    </span>
  );
}

const GRID = "grid grid-cols-[1.4fr_1fr_1.1fr_0.9fr_0.8fr] items-center gap-2";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  // A host-arranged stay the guest hasn't paid for. Not "awaiting the host" —
  // the ball is with the guest, and nothing is held until they pay.
  pending: "Payment pending",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

function SortSelect({
  label,
  latestFirst,
  onChange,
}: {
  label: string;
  latestFirst: boolean;
  onChange: (latestFirst: boolean) => void;
}) {
  return (
    <Dropdown
      ariaLabel={label}
      value={latestFirst ? "latest" : "oldest"}
      onChange={(v) => onChange(v === "latest")}
      options={[
        { value: "latest", label: "Sort: Latest to Oldest" },
        { value: "oldest", label: "Sort: Oldest to Latest" },
      ]}
      align="right"
      buttonClassName="flex items-center rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]"
    />
  );
}

function sortByCreated(list: BookingItem[], latestFirst: boolean): BookingItem[] {
  return [...list].sort((a, b) =>
    latestFirst
      ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
}

/** Villa name with any package badge / paid add-ons listed beneath it. */
function VillaCell({ b }: { b: BookingItem }) {
  const extras = b.extras.map((e) => e.name).join(", ");
  return (
    <span className="min-w-0">
      <span className="block truncate">{b.villa}</span>
      <span className="mt-0.5 inline-block rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
        {b.kind}
      </span>
      {b.package && (
        <span
          className="mt-0.5 inline-block max-w-full truncate rounded-[3px] bg-[#e9e8fd] px-1.5 py-0.5 text-[10px] font-medium text-brand"
          title={`Package: ${b.package.name} — ${b.package.inclusions.join(", ")}`}
        >
          Package · {b.package.name}
        </span>
      )}
      {!b.package && b.extras.length > 0 && (
        <span
          className="mt-0.5 block truncate text-[11px] text-[#7a7a85]"
          title={`Add-ons: ${extras}`}
        >
          + {extras}
        </span>
      )}
    </span>
  );
}

/** Chevron that points down, rotating up when the row is expanded. */
function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="7"
      viewBox="0 0 9 6"
      fill="none"
      aria-hidden="true"
      className={`mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l3.5 3.5L8 1" stroke="#4a4a4a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[15px] font-semibold ${
          accent ? "text-brand" : "text-[#121212]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** The extra details revealed when a booking row is expanded. Shows only what
 *  the collapsed row doesn't already — the amount charged, reference, exact
 *  length and any add-on prices — so nothing is repeated. */
function BookingDetails({ b }: { b: BookingItem }) {
  const roomBased = isRoomBased(b.kind);
  return (
    <div className="border-t border-[#ececf0] bg-[#faf9fc] px-4 py-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {/* Same figure either way — but it's owed, not paid, until the guest
            settles an owner-made booking. */}
        <Stat
          label={b.paymentDue ? "Amount due" : "Amount paid"}
          value={`$${b.amountPaid.toFixed(2)}`}
          accent
        />
        <Stat label="Reference" value={bookingReference(b.id)} />
        {b.nights > 0 && (
          <Stat label="Stay length" value={`${b.nights} night${b.nights === 1 ? "" : "s"}`} />
        )}
        {roomBased && (
          <Stat
            label="Rooms"
            value={
              b.plan
                ? // `rooms` alone would show only the peak night — say the
                  // range and let the legs below carry the detail.
                  `${Math.min(...b.plan.map((s) => s.rooms))}–${Math.max(
                    ...b.plan.map((s) => s.rooms),
                  )} by night`
                : `${b.rooms} room${b.rooms === 1 ? "" : "s"}`
            }
          />
        )}
      </div>

      {/* A stay the host arranged night by night: list exactly which nights
          hold how many rooms — "9 rooms" alone would promise the peak count
          for the whole stay. */}
      {b.plan && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Rooms by night
          </p>
          <ul className="mt-2 max-w-[360px] space-y-1.5">
            {b.plan.map((seg) => (
              <li
                key={seg.checkIn}
                className="flex items-center justify-between gap-4 text-[13px]"
              >
                <span className="truncate text-[#3a3a44]">
                  {formatRange(seg.checkIn, seg.checkOut)}
                </span>
                <span className="shrink-0 font-semibold text-[#121212]">
                  {seg.rooms} room{seg.rooms === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A discounted amount never stands alone — spell out the same receipt
          the host sees: full stay, the discount (a coupon or the host's own),
          what an earlier absorbed stay already paid. Shown for PAID stays too:
          a $1.00 stay bought with a big coupon has to explain itself. */}
      {b.pay && (b.pay.hostDiscount > 0 || b.pay.alreadyPaid > 0) && (
        <p className="mt-3 text-[12.5px] leading-[1.7] text-[#6a6a72]">
          Full stay <span className="font-semibold text-[#121212]">${b.pay.fullStay.toFixed(2)}</span>
          {b.pay.hostDiscount > 0 && (
            <>
              {" "}− {b.couponCode ? `coupon ${b.couponCode}` : "host’s discount"}{" "}
              <span className="font-semibold text-brand">${b.pay.hostDiscount.toFixed(2)}</span>
            </>
          )}
          {b.pay.alreadyPaid > 0 && (
            <>
              {" "}− already paid{" "}
              <span className="font-semibold text-[#1c7d5c]">${b.pay.alreadyPaid.toFixed(2)}</span>
            </>
          )}
          {" "}={" "}
          <span className="font-semibold text-[#121212]">
            ${b.amountPaid.toFixed(2)} {b.paymentDue ? "due" : "paid"}
          </span>
        </p>
      )}

      {b.extras.length > 0 && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Paid add-ons
          </p>
          <ul className="mt-2 max-w-[360px] space-y-1.5">
            {b.extras.map((e) => (
              <li key={e.name} className="flex items-center justify-between gap-4 text-[13px]">
                <span className="truncate text-[#3a3a44]">{e.name}</span>
                <span className="shrink-0 font-semibold text-[#121212]">
                  ${e.price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A package's bundle IS what was bought — its details panel has to say
          what's in it, same as the owner's view does. */}
      {b.package && b.package.inclusions.length > 0 && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Package includes
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#3a3a44]">
            {b.package.inclusions.map((inc) => (
              <li key={inc} className="flex items-center gap-1.5">
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-brand" />
                {inc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A package-stay row that expands to the SAME details panel nightly rows get
 *  — amount, reference, rooms reserved, receipt — plus the bundle's contents.
 *  The header keeps the package layout; only the chevron and the click are new. */
function PackageRow({ b, actions }: { b: BookingItem; actions: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-[6px] border border-[#dfdfdf] bg-white">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#faf9ff]"
      >
        <div className="flex min-w-0 items-start gap-2">
          <ExpandIcon open={open} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-heading">
              {b.package!.name}
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-gray">
              {b.villa}
              <span className="rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                {b.kind}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-[#a1a1a2]">
              {b.package!.nights} night{b.package!.nights === 1 ? "" : "s"} ·{" "}
              {b.dates} · {b.guests}
            </p>
            {b.package!.inclusions.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {b.package!.inclusions.map((inc) => (
                  <li
                    key={inc}
                    className="rounded-full bg-[#f2f1fe] px-2 py-0.5 text-[11px] text-brand"
                  >
                    {inc}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Cancelling mustn't toggle the row open on the way past. */}
        <div
          className="flex shrink-0 flex-col items-end gap-1.5 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      </div>
      {open && <BookingDetails b={b} />}
    </li>
  );
}

/** A bookings-table row that expands on click to reveal payment & stay details.
 *  `actions` is the right-hand status/action cell (differs for active vs history). */
function BookingRow({ b, actions }: { b: BookingItem; actions: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-[6px] border border-[#dfdfdf] bg-white">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`${GRID} cursor-pointer px-4 py-3 text-[13px] text-[#121212] transition-colors hover:bg-[#faf9ff]`}
      >
        <span className="flex min-w-0 items-start gap-2">
          <ExpandIcon open={open} />
          <VillaCell b={b} />
        </span>
        <span title={`Booked on ${b.bookedAt}`}>{b.posted}</span>
        <span>{b.dates}</span>
        <span>{b.guests}</span>
        {/* Actions (cancel / rate) shouldn't toggle the row. */}
        <span
          className="flex flex-col items-end gap-1.5 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      </div>
      {open && <BookingDetails b={b} />}
    </li>
  );
}

export default function MyBookings({ bookings }: { bookings: BookingItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeLatest, setActiveLatest] = useState(true);
  const [historyLatest, setHistoryLatest] = useState(true);
  const [query, setQuery] = useState("");

  // Live search filters every section (active, history, package stays) at once,
  // matching villa name, kind, package, dates, reference or status.
  const filtered = bookings.filter((b) =>
    matchesSearch(
      query,
      b.villa,
      b.kind,
      b.package?.name,
      b.dates,
      bookingReference(b.id),
      STATUS_LABEL[b.status] ?? b.status,
    ),
  );

  // Package stays are shown in their own section, apart from nightly stays.
  const nightly = filtered.filter((b) => !b.package);
  const packageStays = sortByCreated(
    filtered.filter((b) => b.package),
    true,
  );
  // A stay the host arranged that nobody has paid for yet. It holds no rooms
  // until it's paid, so it's neither an active booking nor history — it's a bill
  // to settle, and it gets its own section at the top where it can't be missed.
  // Both conditions are required: a pending row that ISN'T due has no payment to
  // ask for, and offering one would dead-end (only a due booking is payable).
  const isAwaitingPayment = (b: BookingItem) =>
    b.status === "pending" && b.paymentDue;
  const awaitingPayment = sortByCreated(nightly.filter(isAwaitingPayment), activeLatest);
  const active = sortByCreated(
    nightly.filter((b) => b.status === "accepted"),
    activeLatest,
  );
  // The exact complement of the two above, so no booking can fall through the
  // gaps and vanish from the page entirely.
  const history = sortByCreated(
    nightly.filter((b) => b.status !== "accepted" && !isAwaitingPayment(b)),
    historyLatest,
  );

  const [reviewing, setReviewing] = useState<{
    id: number;
    stars: number;
    editing: boolean;
    /** What the review said when the composer opened — an edit that changes
     *  nothing is not a save, and letting it through would send an already
     *  published review back to the moderation queue for no reason. */
    wasStars: number;
    wasComment: string;
  } | null>(null);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Clicking a star on a completed stay opens the composer with that rating.
  function openReview(id: number, stars: number) {
    setReviewing({ id, stars, editing: false, wasStars: 0, wasComment: "" });
    setComment("");
    setReviewError(null);
  }

  // Reopening what they already wrote, inside the 24h window.
  function openEdit(b: BookingItem) {
    if (!b.myReview) return;
    setReviewing({
      id: b.id,
      stars: b.myReview.stars,
      editing: true,
      wasStars: b.myReview.stars,
      wasComment: b.myReview.comment,
    });
    setComment(b.myReview.comment);
    setReviewError(null);
  }

  function submitReview() {
    if (!reviewing || reviewUnchanged) return;
    const { id, stars, editing } = reviewing;
    setReviewError(null);
    startTransition(async () => {
      const res = editing
        ? await updateReviewAction(id, stars, comment.trim())
        : await rateStayAction(id, stars, comment.trim());
      if (!res.ok) {
        setReviewError(res.error);
        return;
      }
      setReviewing(null);
      router.refresh();
    });
  }

  /* Nothing to save: same stars, same words (trimmed — trailing spaces are
     not an edit). Only ever true while EDITING; a new review always has
     something to say. */
  const reviewUnchanged =
    reviewing !== null &&
    reviewing.editing &&
    reviewing.stars === reviewing.wasStars &&
    comment.trim() === reviewing.wasComment.trim();

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      {bookings.length > 0 && (
        <AccountSearch
          value={query}
          onChange={setQuery}
          placeholder="Search your bookings by villa, dates, reference or status"
          className="mb-6"
        />
      )}
      {/* Payment due — only present when a host has arranged a stay the guest
          hasn't paid for. Top of the page, because nothing is held until they
          do: this is the one section with a deadline attached. */}
      {awaitingPayment.length > 0 && (
        <section className="mb-8 rounded-[10px] border border-[#e8d5a3] bg-[#fdf9f0] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-[#8a6a1f]">
              <span>{String(awaitingPayment.length).padStart(2, "0")}</span>{" "}
              Payment Due
            </h2>
            <p className="text-[13px] font-semibold text-[#8a6a1f]">
              $
              {awaitingPayment
                .reduce((sum, b) => sum + b.amountPaid, 0)
                .toFixed(2)}{" "}
              total
            </p>
          </div>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#7a6a45]">
            Your host booked {awaitingPayment.length === 1 ? "this stay" : "these stays"}{" "}
            for you.{" "}
            <span className="font-semibold">
              The room{awaitingPayment.length === 1 ? " isn't" : "s aren't"} held
              until you pay
            </span>{" "}
            — someone else can still take{" "}
            {awaitingPayment.length === 1 ? "it" : "them"} in the meantime.
          </p>
          <ul className="mt-4 space-y-3">
            {awaitingPayment.map((b) => (
              <BookingRow
                key={b.id}
                b={b}
                actions={
                  <>
                    <span className="rounded-[3px] bg-[#fff3d6] px-2 py-0.5 text-[11px] font-semibold text-[#a06a00]">
                      Payment pending
                    </span>
                    <Link
                      href={`/payment?pay=${b.id}`}
                      className="rounded-[6px] bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Pay ${b.amountPaid.toFixed(2)}
                    </Link>
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">{String(active.length).padStart(2, "0")}</span>{" "}
          Active Bookings
        </h2>
        <SortSelect
          label="Sort active bookings"
          latestFirst={activeLatest}
          onChange={setActiveLatest}
        />
      </div>

      <div className={`${GRID} mt-6 px-4 text-[13px] text-[#a1a1a2]`}>
        <span>Name of Villa</span>
        <span>Booked</span>
        <span>Stay Duration</span>
        <span>No. of Guests</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="mt-3 space-y-3">
        {active.map((b) => (
          <BookingRow
            key={b.id}
            b={b}
            actions={
              <>
                {/* Active normally means paid — the one exception is a stay the
                    host UPGRADED (folded a bigger request into it): its rooms
                    are held, but the difference is still owed. */}
                {b.paymentDue ? (
                  <>
                    <span className="rounded-[3px] bg-[#fff3d6] px-2 py-0.5 text-[11px] font-semibold text-[#a06a00]">
                      Balance due
                    </span>
                    <Link
                      href={`/payment?pay=${b.id}`}
                      className="rounded-[6px] bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Pay ${b.amountPaid.toFixed(2)}
                    </Link>
                  </>
                ) : (
                  <span
                    className="rounded-[3px] bg-[#e9e8fd] px-2 py-0.5 text-[11px] font-semibold text-brand"
                    title="Paid — your stay is confirmed"
                  >
                    Confirmed
                  </span>
                )}
                {/* A booking can only be cancelled while it's still upcoming. */}
                {b.upcoming && (
                  <Link
                    href={`/booking?id=${b.id}`}
                    className="text-[13px] text-[#eb5757] underline hover:opacity-80"
                  >
                    Cancel Booking
                  </Link>
                )}
              </>
            }
          />
        ))}
        {active.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No active bookings.
          </li>
        )}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">Booking History</h2>
        <SortSelect
          label="Sort booking history"
          latestFirst={historyLatest}
          onChange={setHistoryLatest}
        />
      </div>

      <div className={`${GRID} mt-4 px-4 text-[13px] text-[#a1a1a2]`}>
        <span>Name of Villa</span>
        <span>Booked</span>
        <span>Stay Duration</span>
        <span>No. of Guests</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="mt-3 space-y-3">
        {history.map((b) => (
          <BookingRow
            key={b.id}
            b={b}
            actions={
              <>
                <span
                  className={`text-[13px] font-semibold ${
                    b.status === "declined" || b.status === "cancelled"
                      ? "text-[#eb5757]"
                      : "text-brand"
                  }`}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
                {b.status === "completed" && (
                  <StarRater
                    rated={b.myRating}
                    review={b.myReview}
                    disabled={pending}
                    onRate={(stars) => openReview(b.id, stars)}
                    onEdit={() => openEdit(b)}
                  />
                )}
              </>
            }
          />
        ))}
        {history.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No past bookings yet.
          </li>
        )}
      </ul>

      {packageStays.length > 0 && (
        <>
          <h2 className="mt-8 text-[16px] font-semibold text-[#121212]">
            Package stays
          </h2>
          <ul className="mt-4 space-y-3">
            {packageStays.map((b) => (
              <PackageRow
                key={b.id}
                b={b}
                actions={
                  <>
                    <span className="text-[14px] font-semibold text-brand">
                      ${b.package!.price.toFixed(2)}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        b.status === "cancelled" || b.status === "declined"
                          ? "text-[#eb5757]"
                          : "text-brand"
                      }`}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    {b.status === "accepted" && b.upcoming && (
                      <Link
                        href={`/booking?id=${b.id}`}
                        className="text-[13px] text-[#eb5757] underline hover:opacity-80"
                      >
                        Cancel Booking
                      </Link>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        </>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-[#121212]">
        Note: Cancellation of a booking may result in cancellation charges.
        Charges vary from property to property and may depend on the cancellation
        time. Read the cancellation policy of the hosted place for further
        information.
      </p>

      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Review your stay"
          onClick={(e) => e.target === e.currentTarget && setReviewing(null)}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <h3 className="text-[18px] font-semibold text-[#121212]">
              {reviewing.editing ? "Edit your review" : "Review your stay"}
            </h3>
            <p className="mt-1 text-[13px] text-[#7a7a85]">
              {reviewing.editing
                ? "Change it while it's still fresh — an edit goes back for review before it appears."
                : "Share how it went — your review helps other guests decide."}
            </p>
            <div className="mt-4 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewing((r) => (r ? { ...r, stars: n } : r))}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-pressed={n <= reviewing.stars}
                  className="transition-transform hover:scale-110"
                >
                  <Star filled={n <= reviewing.stars} size={28} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What did you love? Anything the next guest should know?"
              className="mt-4 w-full resize-none rounded-[8px] border border-[#d9d9d9] p-3 text-[14px] text-[#121212] placeholder:text-[#9d9da6] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-3 rounded-[8px] bg-[#fdf9f0] px-3 py-2 text-[12px] leading-[1.5] text-[#7a6a45]">
              Reviews are checked before they go live, and you can change yours
              for 24 hours after posting.
            </p>
            {reviewError && (
              <p role="alert" className="mt-3 text-[13px] font-medium text-[#c0392b]">
                {reviewError}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setReviewing(null)}
                className="text-[14px] text-[#7a7a85] underline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || reviewUnchanged}
                title={
                  reviewUnchanged
                    ? "Change the rating or what you wrote to save."
                    : undefined
                }
                onClick={submitReview}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending
                  ? "Submitting…"
                  : reviewing.editing
                    ? "Save changes"
                    : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
