"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteVillaAction,
  setVillaArchivedAction,
  setVillaFeaturedAction,
} from "@/lib/actions";
import type { BookingLock, PropertyItem } from "@/lib/queries";
import { Star } from "@/components/home/sections";
import AccountSearch, { matchesSearch } from "@/components/account/AccountSearch";
import { formatDay } from "@/lib/dates";

/** "3 active bookings" — the phrase both the lock badge and its dialog use. */
const staysPhrase = (lock: BookingLock): string =>
  `${lock.active} active booking${lock.active === 1 ? "" : "s"}`;

/** iOS-style on/off switch. `tone` colours the ON state: brand for a promotion,
 *  danger for a state that takes the listing off the market (archived). */
function Toggle({
  on,
  disabled,
  onClick,
  label,
  tone = "brand",
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  tone?: "brand" | "danger";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? (tone === "danger" ? "bg-[#eb5757]" : "bg-brand") : "bg-[#d1d1db]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function MyProperties({
  properties,
  locks = {},
}: {
  properties: PropertyItem[];
  /** Villas with live bookings, keyed by id — these can't be edited yet. */
  locks?: Record<number, BookingLock>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  // Featured state is toggled optimistically; a villa awaiting the paid-service
  // warning sits in `confirming` until the owner accepts.
  const [featured, setFeatured] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(properties.map((p) => [p.id, p.featured])),
  );
  const [confirming, setConfirming] = useState<PropertyItem | null>(null);
  // Villa awaiting a delete confirmation. `removeError` holds the reason a
  // removal was refused (e.g. the villa still has active bookings).
  const [removing, setRemoving] = useState<PropertyItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Archive state, toggled optimistically like `featured`; a villa awaiting the
  // archive confirmation sits in `archiving`.
  const [archived, setArchived] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(properties.map((p) => [p.id, p.archived])),
  );
  const [archiving, setArchiving] = useState<PropertyItem | null>(null);
  // The listing whose "why is this locked?" dialog is open.
  const [lockInfo, setLockInfo] = useState<PropertyItem | null>(null);

  function askRemove(p: PropertyItem) {
    setRemoveError(null);
    setRemoving(p);
  }

  function confirmRemove() {
    if (!removing) return;
    startTransition(async () => {
      const res = await deleteVillaAction(removing.id);
      if (res.ok) {
        setRemoving(null);
        setRemoveError(null);
        router.refresh();
      } else {
        // Keep the dialog open and surface why (e.g. active bookings).
        setRemoveError(res.error);
      }
    });
  }

  function applyFeatured(id: number, next: boolean) {
    startTransition(async () => {
      const res = await setVillaFeaturedAction(id, next);
      if (res.ok) {
        setFeatured((cur) => ({ ...cur, [id]: next }));
        router.refresh();
      }
      setConfirming(null);
    });
  }

  // Turning OFF is free and immediate; turning ON is a paid promotion, so warn
  // first and only apply once the owner confirms.
  function toggleFeatured(p: PropertyItem) {
    if (featured[p.id]) applyFeatured(p.id, false);
    else setConfirming(p);
  }

  function applyArchived(id: number, next: boolean) {
    startTransition(async () => {
      const res = await setVillaArchivedAction(id, next);
      if (res.ok) {
        setArchived((cur) => ({ ...cur, [id]: next }));
        router.refresh();
      }
      setArchiving(null);
    });
  }

  // Restoring just puts the listing back, so it applies straight away; archiving
  // delists it, so confirm that direction first (mirrors the Feature toggle).
  function toggleArchived(p: PropertyItem) {
    if (archived[p.id]) applyArchived(p.id, false);
    else setArchiving(p);
  }

  const visible = properties.filter((p) =>
    matchesSearch(query, p.name, p.city, p.kind),
  );

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#121212]">Property Owned</h2>
        <Link
          href="/host"
          className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Add Property
        </Link>
      </div>

      {properties.length > 0 && (
        <AccountSearch
          value={query}
          onChange={setQuery}
          placeholder="Search your properties by name, city or type"
          className="mt-6"
        />
      )}

      {properties.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-base font-semibold text-ink">No properties yet</p>
          <p className="mt-1 text-sm text-body">
            Register your villa and it will show up here.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-10 text-center text-[13px] text-muted">
          No properties match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="mt-5 space-y-5">
          {visible.map((p) => (
            /* An archived listing is off the market — tint the whole row red and
               drain the photo's colour so it reads as inactive at a glance,
               rather than sitting identically among the live ones. */
            <li
              key={p.id}
              className={`flex gap-4 overflow-hidden rounded-[6px] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)] sm:gap-5 ${
                archived[p.id]
                  ? "bg-[#fffafa] ring-1 ring-inset ring-[#eb5757]/35"
                  : "bg-white"
              }`}
            >
              <div className="relative h-[132px] w-28 shrink-0 overflow-hidden rounded-l-[6px] sm:w-[135px]">
                <Image
                  src={p.image}
                  alt={`${p.name}, ${p.city}`}
                  fill
                  sizes="135px"
                  className={`object-cover transition-[filter] ${
                    archived[p.id] ? "opacity-60 grayscale" : ""
                  }`}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-3">
                <h3 className="truncate text-[15px] font-semibold text-heading">
                  {p.name}, <span className="text-purple">{p.city}</span>
                </h3>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-[3px] bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                    {p.kind}
                  </span>
                  {featured[p.id] && !archived[p.id] && (
                    <span className="flex items-center gap-1 rounded-[3px] bg-[#fff3d6] px-2 py-0.5 text-[10px] font-semibold text-[#a06a00]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-.9z" />
                      </svg>
                      Featured
                    </span>
                  )}
                  {archived[p.id] && (
                    <span
                      title="Hidden from search and taking no new bookings. Stays already booked still go ahead."
                      className="flex items-center gap-1 rounded-[3px] bg-[#eb5757] px-2 py-0.5 text-[10px] font-semibold text-white"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 7h18v3H3zM5 10h14v10H5zM10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Archived
                    </span>
                  )}
                </span>
                <p className="mt-1 text-[13px] font-semibold text-heading">
                  {p.discount > 0 ? (
                    <>
                      ${Math.round(p.price * (1 - p.discount / 100))}
                      <span className="ml-1 text-[11px] font-normal text-[#9d9da6] line-through">
                        ${p.price}
                      </span>
                      <span className="font-normal">/night</span>
                      <span className="ml-1.5 rounded-[3px] bg-[#fdecec] px-1.5 py-0.5 text-[10px] font-semibold text-[#eb5757]">
                        {p.discount}% off
                      </span>
                    </>
                  ) : (
                    <>${p.price}/night</>
                  )}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-purple">
                  {p.reviews > 0 ? (
                    <>
                      <Star size={12} /> {p.rating} ({p.reviews})
                    </>
                  ) : (
                    <span className="rounded bg-[#e9e8fd] px-1.5 py-0.5">New listing</span>
                  )}
                </p>
                <p className="mt-auto flex flex-wrap items-center gap-1.5">
                  <span className="rounded-[3px] bg-[#e9e8fd] px-2 py-1 text-[10px] text-brand">
                    {p.posted}
                  </span>
                  {/* Opens the explanation in a real dialog. The reasons (and
                      the archive suggestion) are far more than a hover bubble
                      can hold, and a native title never shows on touch. */}
                  {locks[p.id] && (
                    <button
                      type="button"
                      onClick={() => setLockInfo(p)}
                      className="flex items-center gap-1 rounded-[3px] bg-[#fff3d6] px-2 py-1 text-[10px] font-medium text-[#a06a00] transition-colors hover:bg-[#ffe9b8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a06a00]/40"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7 10V7a5 5 0 0110 0v3M5 10h14v11H5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Editing &amp; removal locked · {staysPhrase(locks[p.id])}
                      <span className="underline underline-offset-2">Why?</span>
                    </button>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between px-4 py-3">
                {/* Feature and Archive are both listing states with a confirm
                    step, so they read as a matching pair of switches — Archive
                    turns red, since it takes the listing off the market. */}
                <div className="flex flex-col items-end gap-2.5">
                  {/* An archived listing is hidden from the home page, so paying
                      to promote it there would buy nothing — shut the toggle. */}
                  <span
                    title={
                      archived[p.id]
                        ? "Restore this listing before featuring it — archived listings don't appear on the home page."
                        : undefined
                    }
                    className={`flex items-center gap-2 text-[12px] font-medium ${
                      archived[p.id] ? "text-[#a8a8b0]" : "text-[#121212]"
                    }`}
                  >
                    Feature
                    <Toggle
                      on={!!featured[p.id] && !archived[p.id]}
                      disabled={pending || !!archived[p.id]}
                      onClick={() => toggleFeatured(p)}
                      label={`Feature ${p.name}`}
                    />
                  </span>
                  {/* Deliberately NOT gated on locks: active bookings are the
                      very reason to archive rather than remove — the stays go
                      ahead while the listing stops taking new ones. */}
                  <span
                    title="Archived listings are hidden from search and take no new bookings. Stays already booked still go ahead."
                    className={`flex items-center gap-2 text-[12px] font-medium ${
                      archived[p.id] ? "text-[#eb5757]" : "text-[#121212]"
                    }`}
                  >
                    Archive
                    <Toggle
                      on={!!archived[p.id]}
                      disabled={pending}
                      onClick={() => toggleArchived(p)}
                      label={`Archive ${p.name}`}
                      tone="danger"
                    />
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* Booking on a guest's behalf. Never gated on the lock: the
                      lock protects the listing's DETAILS from changing under
                      booked guests, and taking another booking doesn't. */}
                  <Link
                    href={`/host/booking?villa=${p.id}`}
                    className="rounded-[6px] bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    Create booking
                  </Link>
                  {/* Locked Edit/Remove stay clickable and explain themselves.
                      Disabling them left the reason in a native title bubble —
                      which browsers often don't show on a disabled control at
                      all, leaving a dead link and no way to find out why. */}
                  {locks[p.id] ? (
                    <button
                      type="button"
                      onClick={() => setLockInfo(p)}
                      className="text-[13px] font-medium text-[#a8a8b0] underline transition-colors hover:text-[#7a7a85]"
                    >
                      Edit
                    </button>
                  ) : (
                    <Link
                      href={`/host?edit=${p.id}`}
                      className="text-[13px] font-medium text-[#121212] underline"
                    >
                      Edit
                    </Link>
                  )}
                  {/* Removal cascades to the villa's bookings, so it's shut
                      while any are live — deleteVillaAction refuses anyway. */}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => (locks[p.id] ? setLockInfo(p) : askRemove(p))}
                    className={`text-[13px] font-medium underline disabled:opacity-50 ${
                      locks[p.id]
                        ? "text-[#a8a8b0] transition-colors hover:text-[#7a7a85]"
                        : "text-[#eb8ba9]"
                    }`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm featuring your villa"
          onClick={(e) => e.target === e.currentTarget && setConfirming(null)}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff3d6] text-[#a06a00]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-.9z" />
                </svg>
              </span>
              <div>
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Feature this villa?
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Featuring <span className="font-semibold">{confirming.name}</span>{" "}
                  promotes it in the <span className="font-semibold">Featured villas</span>{" "}
                  section on the home page. This is a paid service —{" "}
                  <span className="font-semibold">your account will be charged</span>{" "}
                  for the promotion. You can turn it off any time.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="text-[14px] text-[#7a7a85] underline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => applyFeatured(confirming.id, true)}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Enabling…" : "Feature & accept charge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Why a listing is frozen. Guests booked the villa exactly as it's
          listed — its capacity gates availability and its name/city are read
          live onto their booking — so it can't be edited; and removing it would
          cascade their bookings away entirely. Both stay shut until every stay
          is done, so the useful thing to offer here is archiving: the one lever
          that stops new bookings without touching the existing ones. */}
      {lockInfo && locks[lockInfo.id] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Why editing and removal are locked"
          onClick={(e) => e.target === e.currentTarget && setLockInfo(null)}
        >
          <div className="w-full max-w-[500px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff3d6] text-[#a06a00]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 10V7a5 5 0 0110 0v3M5 10h14v11H5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Editing &amp; removal are locked
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  <span className="font-semibold">{lockInfo.name}</span> has{" "}
                  <span className="font-semibold">
                    {staysPhrase(locks[lockInfo.id])}
                  </span>
                  . Guests booked it exactly as it&rsquo;s listed, so its details
                  stay put until those stays are done
                  {locks[lockInfo.id].lastCheckOut ? (
                    <>
                      {" "}
                      — the last one checks out on{" "}
                      <span className="font-semibold">
                        {formatDay(locks[lockInfo.id].lastCheckOut!)}
                      </span>
                    </>
                  ) : null}
                  .
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[#4a4a4a]">
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#c4c4c4]" />
                <span>Wait for the stays to finish — the lock lifts by itself.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#c4c4c4]" />
                <span>
                  Or cancel them all in Rent Requests to edit right away.
                </span>
              </li>
            </ul>

            {/* Archiving is deliberately never locked — it's the answer to
                "stop new bookings" without waiting or cancelling on anyone. */}
            {!archived[lockInfo.id] && (
              <div className="mt-4 rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] p-3.5">
                <p className="text-[13px] font-semibold text-[#8a6a1f]">
                  Just want to stop taking further bookings?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#7a6a45]">
                  Archive the listing instead — that isn&rsquo;t locked. It
                  won&rsquo;t affect the{" "}
                  {staysPhrase(locks[lockInfo.id])} already made (those stays go
                  ahead as planned), and no new bookings can come in. You can
                  restore it whenever you like.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setLockInfo(null)}
                className="text-[14px] text-[#7a7a85] underline"
              >
                Close
              </button>
              <Link
                href="/profile/requests"
                className="rounded-[8px] border border-brand px-5 py-2 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
              >
                Go to Rent Requests
              </Link>
              {!archived[lockInfo.id] && (
                // Hands off to the normal archive confirmation, so there's one
                // place that actually archives.
                <button
                  type="button"
                  onClick={() => {
                    setArchiving(lockInfo);
                    setLockInfo(null);
                  }}
                  className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Archive listing
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {archiving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm archiving your villa"
          onClick={(e) =>
            e.target === e.currentTarget && !pending && setArchiving(null)
          }
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9e9ef] text-[#5f5f6b]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 7h18v3H3zM5 10h14v10H5zM10 14h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Archive this villa?
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  <span className="font-semibold">{archiving.name}</span> will
                  disappear from search and stop taking{" "}
                  <span className="font-semibold">new</span> bookings, along with
                  any packages on it.
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Bookings guests have{" "}
                  <span className="font-semibold">already made still go ahead</span>{" "}
                  — nothing is cancelled. You can restore the listing at any time.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setArchiving(null)}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => applyArchived(archiving.id, true)}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Archiving…" : "Archive villa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm removing your villa"
          onClick={(e) =>
            e.target === e.currentTarget && !pending && setRemoving(null)
          }
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdecec] text-[#eb5757]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a2 2 0 002 2h4a2 2 0 002-2V7M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Remove this villa?
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{removing.name}</span>? This
                  permanently deletes the listing and can&apos;t be undone.
                </p>
                {removeError && (
                  <>
                    <p className="mt-3 rounded-[8px] bg-[#fdecec] px-3 py-2 text-[13px] leading-relaxed text-[#c0392b]">
                      {removeError}{" "}
                      <Link href="/profile/requests" className="font-semibold underline">
                        Go to Rent Requests
                      </Link>
                    </p>
                    {/* Archiving is the answer to exactly this dead end: retire
                        the listing now, let the booked stays finish. */}
                    <p className="mt-2 text-[13px] leading-relaxed text-[#4a4a4a]">
                      Or{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setArchiving(removing);
                          setRemoving(null);
                          setRemoveError(null);
                        }}
                        className="font-semibold text-[#121212] underline"
                      >
                        archive it instead
                      </button>{" "}
                      — it stops taking new bookings and disappears from search
                      right away, while those stays still go ahead.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setRemoving(null)}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmRemove}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Removing…" : "Remove villa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
