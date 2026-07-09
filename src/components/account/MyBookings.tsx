"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rateStayAction } from "@/lib/actions";
import type { BookingItem } from "@/lib/queries";

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
function StarRater({
  rated,
  disabled,
  onRate,
}: {
  rated: number | null;
  disabled: boolean;
  onRate: (stars: number) => void;
}) {
  const [hover, setHover] = useState(0);

  if (rated) {
    return (
      <span
        className="flex items-center gap-0.5"
        aria-label={`You rated this stay ${rated} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= rated} />
        ))}
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
    <label className="flex items-center gap-1 rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]">
      <span className="sr-only">{label}</span>
      <select
        value={latestFirst ? "latest" : "oldest"}
        onChange={(e) => onChange(e.target.value === "latest")}
        className="cursor-pointer appearance-none bg-transparent pr-4 focus:outline-none"
      >
        <option value="latest">Sort: Latest to Oldest</option>
        <option value="oldest">Sort: Oldest to Latest</option>
      </select>
      <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" className="-ml-3 pointer-events-none">
        <path d="M1 1l3.5 3.5L8 1" stroke="#4a4a4a" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </label>
  );
}

function sortByCreated(list: BookingItem[], latestFirst: boolean): BookingItem[] {
  return [...list].sort((a, b) =>
    latestFirst
      ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
}

export default function MyBookings({ bookings }: { bookings: BookingItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeLatest, setActiveLatest] = useState(true);
  const [historyLatest, setHistoryLatest] = useState(true);

  const active = sortByCreated(
    bookings.filter((b) => b.status === "accepted"),
    activeLatest,
  );
  const history = sortByCreated(
    bookings.filter((b) => b.status !== "accepted"),
    historyLatest,
  );

  const [reviewing, setReviewing] = useState<{ id: number; stars: number } | null>(
    null,
  );
  const [comment, setComment] = useState("");

  // Clicking a star on a completed stay opens the composer with that rating.
  function openReview(id: number, stars: number) {
    setReviewing({ id, stars });
    setComment("");
  }

  function submitReview() {
    if (!reviewing) return;
    const { id, stars } = reviewing;
    startTransition(async () => {
      await rateStayAction(id, stars, comment.trim());
      setReviewing(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
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
        <span>Posted</span>
        <span>Stay Duration</span>
        <span>No. of Guests</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="mt-3 space-y-3">
        {active.map((b) => (
          <li
            key={b.id}
            className={`${GRID} rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-3 text-[13px] text-[#121212]`}
          >
            <span className="truncate">{b.villa}</span>
            <span>{b.posted}</span>
            <span>{b.dates}</span>
            <span>{b.guests}</span>
            <span className="flex flex-col items-end gap-1.5 text-right">
              <span
                className="rounded-[3px] bg-[#e9e8fd] px-2 py-0.5 text-[11px] font-semibold text-brand"
                title="Paid at checkout — your stay is confirmed"
              >
                Confirmed
              </span>
              <Link
                href={`/booking?id=${b.id}`}
                className="text-[13px] text-[#eb5757] underline hover:opacity-80"
              >
                Cancel Booking
              </Link>
            </span>
          </li>
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

      <ul className="mt-4 space-y-3">
        {history.map((b) => (
          <li
            key={b.id}
            className={`${GRID} rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-3 text-[13px] text-[#121212]`}
          >
            <span className="truncate">{b.villa}</span>
            <span>{b.posted}</span>
            <span>{b.dates}</span>
            <span>{b.guests}</span>
            <span className="flex flex-col items-end gap-1.5 text-right">
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
                  disabled={pending}
                  onRate={(stars) => openReview(b.id, stars)}
                />
              )}
            </span>
          </li>
        ))}
        {history.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No past bookings yet.
          </li>
        )}
      </ul>

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
              Review your stay
            </h3>
            <p className="mt-1 text-[13px] text-[#7a7a85]">
              Share how it went — your review helps other guests decide.
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
                disabled={pending}
                onClick={submitReview}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
