"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AdminFilterBar, {
  FilterField,
  FILTER_BTN,
} from "@/components/admin/AdminFilterBar";
import Dropdown from "@/components/ui/Dropdown";
import SearchDropdown from "@/components/ui/SearchDropdown";
import { matchesSearch } from "@/lib/textSearch";
import { adminSetVillaLockedAction } from "@/lib/adminActions";
import type { AdminVillaItem } from "@/lib/queries";

const CHIP = "rounded-[3px] px-2 py-0.5 text-[11px] font-semibold";

const STATE = [
  { value: "all", label: "All listings" },
  { value: "live", label: "Taking bookings" },
  { value: "locked", label: "Locked" },
  { value: "featured", label: "Featured" },
];

// Rooms, guests, price and rating are ranked, not enumerated: "which are the
// biggest / dearest / best rated" is the question worth asking of a list this
// size, and a dropdown of every distinct room count would answer nothing.
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "rating-desc", label: "Rating: high to low" },
  { value: "rooms-desc", label: "Most rooms" },
  { value: "guests-desc", label: "Most guests" },
];

export default function AdminProperties({
  items,
}: {
  items: AdminVillaItem[];
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [state, setState] = useState("all");
  const [sort, setSort] = useState("newest");
  const [confirming, setConfirming] = useState<AdminVillaItem | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Owners and kinds are taken from the data, so the lists can only ever
  // offer something that exists.
  const owners = [...new Map(items.map((v) => [v.ownerId, v.ownerName])).entries()]
    .map(([id, name]) => ({ value: String(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const kinds = [...new Set(items.map((v) => v.kind))]
    .sort()
    .map((k) => ({ value: k, label: k }));

  /* The controls above are a DRAFT; these are the choices the list is
     actually showing. "Show results" copies one onto the other, so setting
     four filters reshuffles the rows once rather than four times. */
  const [applied, setApplied] = useState({
    owner: "all",
    kind: "all",
    state: "all",
    sort: "newest",
  });

  const rows = items
    .filter((v) =>
      applied.owner === "all" ? true : String(v.ownerId) === applied.owner,
    )
    .filter((v) => (applied.kind === "all" ? true : v.kind === applied.kind))
    .filter((v) =>
      applied.state === "all"
        ? true
        : applied.state === "live"
          ? !v.locked
          : applied.state === "locked"
            ? v.locked
            : v.featured,
    )
    .filter((v) => matchesSearch(query, v.name, v.city, v.kind, v.ownerName))
    .sort((a, b) => {
      switch (applied.sort) {
        case "price-desc":
          return b.price - a.price;
        case "price-asc":
          return a.price - b.price;
        case "rating-desc":
          return b.rating - a.rating || b.reviews - a.reviews;
        case "rooms-desc":
          return b.rooms - a.rooms;
        case "guests-desc":
          return b.maxGuests - a.maxGuests;
        default:
          return 0; // query order is newest-first already
      }
    });


  const activeFilters =
    (applied.owner !== "all" ? 1 : 0) +
    (applied.kind !== "all" ? 1 : 0) +
    (applied.state !== "all" ? 1 : 0) +
    (applied.sort !== "newest" ? 1 : 0);

  function applyFilters() {
    setApplied({ owner, kind, state, sort });
  }
  function cancelFilters() {
    setOwner(applied.owner);
    setKind(applied.kind);
    setState(applied.state);
    setSort(applied.sort);
  }

  function clearFilters() {
    setQuery("");
    setOwner("all");
    setKind("all");
    setState("all");
    setSort("newest");
    setApplied({ owner: "all", kind: "all", state: "all", sort: "newest" });
  }

  function toggleLock(v: AdminVillaItem) {
    startTransition(async () => {
      const res = await adminSetVillaLockedAction(v.id, !v.locked);
      setConfirming(null);
      setMessage({
        ok: res.ok,
        text: res.ok
          ? `${v.name} ${v.locked ? "unlocked" : "locked"}.`
          : res.error,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <AdminFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by property, city, kind or owner"
        activeCount={activeFilters}
        onApply={applyFilters}
        onCancel={cancelFilters}
        onClear={clearFilters}
      >
        <FilterField label="Owner">
          <SearchDropdown
            value={owner}
            onChange={setOwner}
            options={[{ value: "all", label: "All owners" }, ...owners]}
            ariaLabel="Filter by owner"
            searchPlaceholder="Search owners…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Property type">
          <Dropdown
            value={kind}
            onChange={setKind}
            options={[{ value: "all", label: "All types" }, ...kinds]}
            ariaLabel="Filter by property type"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Listing state">
          <Dropdown
            value={state}
            onChange={setState}
            options={STATE}
            ariaLabel="Filter by listing state"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Sort by">
          <Dropdown
            value={sort}
            onChange={setSort}
            options={SORTS}
            ariaLabel="Sort properties"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
      </AdminFilterBar>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-[8px] px-4 py-3 text-[14px] font-medium ${
            message.ok
              ? "bg-[#e6f7f1] text-[#1c7d5c]"
              : "bg-[#fdecec] text-[#c0392b]"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">
            {String(rows.length).padStart(2, "0")}
          </span>{" "}
          Properties
        </h2>
      </div>

      <ul className="mt-5 space-y-5">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No properties match.
          </li>
        ) : (
          rows.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap gap-4 overflow-hidden rounded-[6px] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)]"
            >
              <div className="relative h-[120px] w-[160px] shrink-0">
                <Image
                  src={v.image}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 py-3 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/place?id=${v.id}`}
                    className="text-[15px] font-semibold text-[#121212] underline-offset-2 hover:underline"
                  >
                    {v.name}, {v.city}
                  </Link>
                  <span className="rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                    {v.kind}
                  </span>
                  {v.featured && (
                    <span className={`${CHIP} bg-[#e9e8fd] text-brand`}>
                      Featured
                    </span>
                  )}
                  {v.locked && (
                    <span className={`${CHIP} bg-[#fdecec] text-[#eb5757]`}>
                      Locked
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-[#7a7a85]">
                  Owner: {v.ownerName}
                </p>
                <p className="mt-1 text-[13px] text-[#3a3a44]">
                  ${v.price} / night · {v.rooms} room{v.rooms === 1 ? "" : "s"} ·
                  up to {v.maxGuests} guests · {v.rating.toFixed(1)}★ (
                  {v.reviews})
                </p>
                <button
                  type="button"
                  onClick={() => setConfirming(v)}
                  className="mt-3 rounded-[8px] border border-brand px-4 py-1.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  {v.locked ? "Unlock listing" : "Lock listing"}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setConfirming(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-[#121212]">
              {confirming.locked ? "Unlock" : "Lock"} {confirming.name}?
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              {confirming.locked
                ? "It will start taking new bookings again and reappear in search."
                : "It stops taking NEW bookings and leaves search. Stays already booked go ahead as normal."}{" "}
              {confirming.ownerName} is notified that support did this.
            </p>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Never mind
              </button>
              <button
                type="button"
                onClick={() => toggleLock(confirming)}
                disabled={pending}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending
                  ? "Saving…"
                  : confirming.locked
                    ? "Yes, unlock"
                    : "Yes, lock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
