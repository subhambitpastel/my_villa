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
import {
  adminDeleteVillaAction,
  adminSetVillaAdminLockedAction,
  adminSetVillaLockedAction,
} from "@/lib/adminActions";
import type { AdminVillaItem, BookingLock } from "@/lib/queries";
import { formatDay } from "@/lib/dates";

const CHIP = "rounded-[3px] px-2 py-0.5 text-[11px] font-semibold";

const STATE = [
  { value: "all", label: "All listings" },
  { value: "live", label: "Taking bookings" },
  { value: "locked", label: "Locked (any)" },
  { value: "admin-locked", label: "Admin locked" },
  { value: "featured", label: "Featured" },
];

/** Which lock a confirmation is about. "owner" flips the host's own switch (they
 *  can undo it); "admin" is support's, which only support can lift. */
type LockScope = "owner" | "admin";

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
  locks = {},
}: {
  items: AdminVillaItem[];
  /** Live bookings per villa id (absent = none). A listing with any of these
   *  can't be deleted — the stays have to be cancelled first. */
  locks?: Record<number, BookingLock>;
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [state, setState] = useState("all");
  const [sort, setSort] = useState("newest");
  const [confirming, setConfirming] = useState<{
    villa: AdminVillaItem;
    scope: LockScope;
  } | null>(null);
  // Deletion gets its own dialog — it's irreversible and cascades, so it can't
  // share the lock confirmation's copy.
  const [deleting, setDeleting] = useState<AdminVillaItem | null>(null);
  // Why a delete was refused (active bookings). Shown in the dialog rather than
  // the top banner, so the reason sits next to the thing being deleted.
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
          ? // Live means neither lock — an admin-locked listing is off the
            // market even if the owner's own switch is open.
            !v.locked && !v.adminLocked
          : applied.state === "locked"
            ? v.locked || v.adminLocked
            : applied.state === "admin-locked"
              ? v.adminLocked
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

  function toggleLock(v: AdminVillaItem, scope: LockScope) {
    const wasLocked = scope === "admin" ? v.adminLocked : v.locked;
    startTransition(async () => {
      const res =
        scope === "admin"
          ? await adminSetVillaAdminLockedAction(v.id, !wasLocked)
          : await adminSetVillaLockedAction(v.id, !wasLocked);
      setConfirming(null);
      setMessage({
        ok: res.ok,
        text: res.ok
          ? `${v.name} ${scope === "admin" ? "admin-" : ""}${
              wasLocked ? "unlocked" : "locked"
            }.`
          : res.error,
      });
      if (res.ok) router.refresh();
    });
  }

  // Live bookings on the listing the delete dialog is open for, if any. Their
  // presence is what makes the deletion impossible, so the dialog leads with it
  // and the confirm button stays shut.
  const blockingLock = deleting ? locks[deleting.id] : undefined;

  function removeVilla(v: AdminVillaItem) {
    setDeleteError(null);
    startTransition(async () => {
      const res = await adminDeleteVillaAction(v.id);
      if (!res.ok) {
        // Kept open: the refusal is actionable (cancel the stays, or lock it).
        setDeleteError(res.error);
        return;
      }
      setDeleting(null);
      setMessage({ ok: true, text: `${v.name} deleted.` });
      router.refresh();
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
                  {/* Distinct from "Locked": this one the owner can't lift. */}
                  {v.adminLocked && (
                    <span
                      title="Locked by MyVilla support — the owner can't unlock this."
                      className={`${CHIP} bg-[#3a1f1f] text-white`}
                    >
                      Admin locked
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
                {/* Two locks, side by side. The first flips the OWNER'S switch
                    (they can undo it); the second is support's own, which they
                    can't — hence the heavier styling. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming({ villa: v, scope: "owner" })}
                    className="rounded-[8px] border border-brand px-4 py-1.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                  >
                    {v.locked ? "Unlock listing" : "Lock listing"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming({ villa: v, scope: "admin" })}
                    title="Support's own lock — the owner cannot unlock this one."
                    className={`rounded-[8px] px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                      v.adminLocked
                        ? "bg-[#3a1f1f] text-white hover:bg-[#512c2c]"
                        : "border border-[#eb5757] text-[#eb5757] hover:bg-[#eb5757]/5"
                    }`}
                  >
                    {v.adminLocked ? "Admin unlock" : "Admin lock listing"}
                  </button>
                  {/* Irreversible and cascading, so it sits apart from the
                      locks and states its consequences in the dialog. */}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(v);
                    }}
                    className="rounded-[8px] bg-[#eb5757] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#d64545]"
                  >
                    Delete
                  </button>
                </div>
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
            {(() => {
              const { villa: cv, scope } = confirming;
              const isAdmin = scope === "admin";
              const wasLocked = isAdmin ? cv.adminLocked : cv.locked;
              return (
                <>
                  <p className="text-[16px] font-semibold text-[#121212]">
                    {wasLocked ? "Unlock" : "Lock"}
                    {isAdmin ? " (support lock)" : ""} {cv.name}?
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
                    {wasLocked
                      ? isAdmin
                        ? "Support's lock is lifted. The listing goes back on the market unless the owner's own lock is still on — that setting is left exactly as they had it."
                        : "It will start taking new bookings again and reappear in search."
                      : isAdmin
                        ? "It stops taking NEW bookings and leaves search, and the owner CANNOT unlock it — their own switch is frozen and they can't book for a guest either. Stays already booked go ahead as normal."
                        : "It stops taking NEW bookings and leaves search. Stays already booked go ahead as normal. The owner can undo this themselves."}{" "}
                    {cv.ownerName} is notified that support did this.
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
                      onClick={() => toggleLock(cv, scope)}
                      disabled={pending}
                      className={`rounded-[8px] px-5 py-2 text-[14px] font-semibold text-white transition-colors disabled:opacity-60 ${
                        isAdmin && !wasLocked
                          ? "bg-[#eb5757] hover:bg-[#d64545]"
                          : "bg-brand hover:bg-brand-dark"
                      }`}
                    >
                      {pending
                        ? "Saving…"
                        : wasLocked
                          ? "Yes, unlock"
                          : isAdmin
                            ? "Yes, admin lock"
                            : "Yes, lock"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete this property"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!pending) {
              setDeleting(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="w-full max-w-[460px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-[#121212]">
              Delete {deleting.name}, {deleting.city}?
            </p>

            {/* Said BEFORE the attempt, not after it fails: a listing guests
                are still booked into can't be deleted at all, and the way
                forward is to clear those stays first. Mirrors the owner's own
                delete refusal, with a link straight to the filtered list. */}
            {blockingLock && (
              <div className="mt-3 rounded-[8px] border border-[#f3c9c9] bg-[#fdecec] p-3.5">
                <p className="text-[13px] font-semibold text-[#c0392b]">
                  This property can&rsquo;t be deleted yet — it has{" "}
                  {blockingLock.active} active booking
                  {blockingLock.active === 1 ? "" : "s"}.
                </p>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-[#8a4b44]">
                  Guests are still booked into it
                  {blockingLock.lastCheckOut ? (
                    <>
                      {" "}
                      — the last checks out on{" "}
                      <span className="font-semibold">
                        {formatDay(blockingLock.lastCheckOut)}
                      </span>
                    </>
                  ) : null}
                  . Cancel all of its bookings first, then delete the property.
                  To take it off the market right now without cancelling on
                  anyone, use <span className="font-semibold">Admin lock</span>{" "}
                  instead.
                </p>
                <Link
                  href={`/admin/bookings?villa=${deleting.id}`}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-[6px] bg-[#eb5757] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#d64545]"
                >
                  View &amp; cancel its bookings
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            )}

            <p className="mt-3 text-[14px] leading-[1.5] text-[#4a4a4a]">
              {blockingLock ? "Once those stays are cancelled, deleting" : "This"}{" "}
              <span className="font-semibold">permanently</span> removes the
              listing owned by {deleting.ownerName}, and everything attached to
              it goes with it:
            </p>
            <ul className="mt-2 space-y-1 text-[13px] leading-[1.5] text-[#4a4a4a]">
              {[
                "its packages and coupons",
                "its reviews and ratings",
                "past bookings and their history",
                "guests' saved favourites and call requests",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-[#c4c4c4]"
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              It can&rsquo;t be undone.
              {!blockingLock && (
                <>
                  {" "}
                  To take it off the market without destroying any of this, use{" "}
                  <span className="font-semibold">Admin lock</span> instead.
                </>
              )}
            </p>
            {deleteError && (
              <p
                role="alert"
                className="mt-3 rounded-[8px] bg-[#fdecec] px-3 py-2 text-[13px] leading-[1.5] text-[#c0392b]"
              >
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setDeleting(null);
                  setDeleteError(null);
                }}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                {deleteError || blockingLock ? "Close" : "Never mind"}
              </button>
              {/* Shut while stays are live: the action refuses it anyway, and
                  offering a button that can only fail is worse than not
                  offering it. Reopens by itself once they're cancelled. */}
              <button
                type="button"
                onClick={() => removeVilla(deleting)}
                disabled={pending || !!deleteError || !!blockingLock}
                title={
                  blockingLock
                    ? "Cancel this property's bookings first."
                    : undefined
                }
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Yes, delete it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
