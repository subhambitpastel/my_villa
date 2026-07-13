import Link from "next/link";
import { isRoomBased, roomsForGuests } from "@/lib/rooms";
import type { PackageItem } from "@/lib/queries";

/** Package cards on the villa page — each links to the standalone package
 *  detail page, where the guest picks a start date and books. */
export default function VillaPackages({
  packages,
  peoplePerRoom,
}: {
  packages: PackageItem[];
  peoplePerRoom: number;
}) {
  return (
    <ul className="mt-[15px] grid gap-4 sm:grid-cols-2">
      {packages.map((p) => {
        const roomBased = isRoomBased(p.villaKind);
        const rooms = roomsForGuests(p.villaKind, p.maxGuests, peoplePerRoom);
        return (
          <li
            key={p.id}
            className="flex flex-col rounded-[12px] border border-[#e3e3e8] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  {p.name}
                </h3>
                {p.discount > 0 && (
                  <span className="rounded-full bg-[#e6f7f1] px-2 py-0.5 text-[12px] font-semibold text-accent">
                    {p.discount}% off
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[18px] font-semibold text-brand">
                {p.price > 0 ? `$${p.price.toFixed(0)}` : "Free"}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-gray">
              {p.nights} night{p.nights === 1 ? "" : "s"} · up to {p.maxGuests}{" "}
              guest{p.maxGuests === 1 ? "" : "s"} ·{" "}
              {roomBased
                ? `${rooms} room${rooms === 1 ? "" : "s"}`
                : "whole villa"}
            </p>
            {p.description && (
              <p className="mt-2 text-[14px] leading-[1.4] text-[#121212]">
                {p.description}
              </p>
            )}
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.inclusions.slice(0, 4).map((inc) => (
                <li
                  key={inc}
                  className="rounded-full bg-[#e9e8fd] px-3 py-1 text-[13px] text-brand"
                >
                  {inc}
                </li>
              ))}
            </ul>
            <Link
              href={`/package?id=${p.id}`}
              className="mt-4 flex h-11 items-center justify-center self-start rounded-[8px] bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              View &amp; book
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
