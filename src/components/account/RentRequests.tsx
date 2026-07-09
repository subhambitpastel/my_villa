"use client";

import { useState } from "react";
import Image from "next/image";
import type { RequestItem } from "@/lib/queries";

const GRID = "grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.8fr] items-center gap-2";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  declined: "Declined",
};

export default function RentRequests({ requests }: { requests: RequestItem[] }) {
  const [latestFirst, setLatestFirst] = useState(true);

  const sorted = [...requests].sort((a, b) =>
    latestFirst
      ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
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
        {sorted.map((r) => (
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
            <span className="truncate">{r.villa}</span>
            <span>{r.dates}</span>
            <span>{r.guests}</span>
            <span
              className={`text-right text-[13px] font-semibold ${
                r.status === "declined" ? "text-[#eb5757]" : "text-brand"
              }`}
            >
              {STATUS_LABEL[r.status] ?? "Confirmed"}
            </span>
          </li>
        ))}
        {requests.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No bookings yet.
          </li>
        )}
      </ul>

      <p className="mt-5 text-[11px] leading-relaxed text-[#121212]">
        Guests pay in full at checkout, so their stay is confirmed
        automatically — no approval needed. The booked dates are blocked for
        other guests right away.
      </p>
    </div>
  );
}
