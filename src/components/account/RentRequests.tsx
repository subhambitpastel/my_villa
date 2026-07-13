"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ownerCancelBookingAction } from "@/lib/actions";
import type { RequestItem } from "@/lib/queries";

const GRID = "grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.8fr] items-center gap-2";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export default function RentRequests({ requests }: { requests: RequestItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [latestFirst, setLatestFirst] = useState(true);
  const [cancelling, setCancelling] = useState<RequestItem | null>(null);

  function confirmCancel() {
    if (!cancelling) return;
    const id = cancelling.id;
    startTransition(async () => {
      await ownerCancelBookingAction(id);
      setCancelling(null);
      router.refresh();
    });
  }

  const sorted = [...requests].sort((a, b) =>
    latestFirst
      ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
  // Package bookings get their own section so room usage per package is clear.
  const villaReqs = sorted.filter((r) => !r.package);
  const pkgReqs = sorted.filter((r) => r.package);
  const confirmed = requests.filter((r) => r.status === "accepted").length;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">{confirmed}</span> Confirmed Bookings
        </h2>
        <label className="flex items-center gap-1 rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]">
          <span className="sr-only">Sort requests</span>
          <select
            value={latestFirst ? "latest" : "oldest"}
            onChange={(e) => setLatestFirst(e.target.value === "latest")}
            className="cursor-pointer appearance-none bg-transparent pr-4 focus:outline-none"
          >
            <option value="latest">Sort: Latest to Oldest</option>
            <option value="oldest">Sort: Oldest to Latest</option>
          </select>
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true" className="-ml-3 pointer-events-none">
            <path d="M1 1l3.5 3.5L8 1" stroke="#4a4a4a" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </label>
      </div>

      <div className={`${GRID} mt-6 px-4 text-[13px] text-[#a1a1a2]`}>
        <span>Tenant</span>
        <span>Property</span>
        <span>Stay Duration</span>
        <span>No. of Guests</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="mt-3 space-y-3">
        {villaReqs.map((r) => (
          <li
            key={r.id}
            className={`${GRID} rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-2 text-[13px] text-[#121212]`}
          >
            <span className="flex items-center gap-2.5">
              <Image
                src={r.avatar}
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] rounded-full object-cover"
              />
              {r.tenant}
            </span>
            <span className="min-w-0 truncate">{r.villa}</span>
            <span>{r.dates}</span>
            <span>{r.guests}</span>
            <span className="flex flex-col items-end gap-1.5 text-right">
              <span
                className={`text-[13px] font-semibold ${
                  r.status === "declined" || r.status === "cancelled"
                    ? "text-[#eb5757]"
                    : "text-brand"
                }`}
              >
                {STATUS_LABEL[r.status] ?? "Confirmed"}
              </span>
              {r.status === "accepted" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setCancelling(r)}
                  className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              )}
            </span>
          </li>
        ))}
        {villaReqs.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No villa bookings yet.
          </li>
        )}
      </ul>

      {pkgReqs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#121212]">
            Package bookings
          </h2>
          <p className="mt-1 text-[12px] text-[#a1a1a2]">
            Fixed all-inclusive packages guests booked — with the rooms each
            reserved on your property.
          </p>
          <ul className="mt-4 space-y-3">
            {pkgReqs.map((r) => (
              <li
                key={r.id}
                className="rounded-[6px] border border-[#dfdfdf] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Image
                      src={r.avatar}
                      alt=""
                      width={30}
                      height={30}
                      className="h-[30px] w-[30px] shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-heading">
                        {r.package!.name}
                      </p>
                      <p className="text-[12px] text-gray">
                        {r.tenant} · {r.villa}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#a1a1a2]">
                        {r.package!.nights} night
                        {r.package!.nights === 1 ? "" : "s"} · {r.dates} ·{" "}
                        {r.guests} ·{" "}
                        <span className="font-medium text-brand">
                          {r.rooms} room{r.rooms === 1 ? "" : "s"} reserved
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                    <span className="text-[14px] font-semibold text-brand">
                      ${r.package!.price.toFixed(2)}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        r.status === "declined" || r.status === "cancelled"
                          ? "text-[#eb5757]"
                          : "text-brand"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? "Confirmed"}
                    </span>
                    {r.status === "accepted" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setCancelling(r)}
                        className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:opacity-50"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-[#121212]">
        Guests pay in full at checkout, so their stay is confirmed
        automatically — no approval needed. The booked dates are blocked for
        other guests right away.
      </p>

      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel this booking"
          onClick={(e) => e.target === e.currentTarget && !pending && setCancelling(null)}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <h3 className="text-[18px] font-semibold text-[#121212]">
              Cancel this booking?
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
              If you cancel {cancelling.tenant}&rsquo;s booking of{" "}
              <span className="font-medium">{cancelling.villa}</span> (
              {cancelling.dates}), you will need to give a{" "}
              <span className="font-semibold text-[#eb5757]">100% refund</span>{" "}
              of the amount paid.
            </p>
            <p className="mt-3 text-[14px] font-medium text-[#121212]">
              Are you sure you want to cancel the booking?
            </p>
            <div className="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setCancelling(null)}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmCancel}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Yes, cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
