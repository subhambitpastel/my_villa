"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteVillaAction, setVillaFeaturedAction } from "@/lib/actions";
import type { PropertyItem } from "@/lib/queries";
import { Star } from "@/components/home/sections";

/** iOS-style on/off switch. */
function Toggle({
  on,
  disabled,
  onClick,
  label,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
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
        on ? "bg-brand" : "bg-[#d1d1db]"
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
}: {
  properties: PropertyItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

      {properties.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-base font-semibold text-ink">No properties yet</p>
          <p className="mt-1 text-sm text-body">
            Register your villa and it will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {properties.map((p) => (
            <li
              key={p.id}
              className="flex gap-4 overflow-hidden rounded-[6px] bg-white shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)] sm:gap-5"
            >
              <div className="relative h-[132px] w-28 shrink-0 overflow-hidden rounded-l-[6px] sm:w-[135px]">
                <Image
                  src={p.image}
                  alt={`${p.name}, ${p.city}`}
                  fill
                  sizes="135px"
                  className="object-cover"
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
                  {featured[p.id] && (
                    <span className="flex items-center gap-1 rounded-[3px] bg-[#fff3d6] px-2 py-0.5 text-[10px] font-semibold text-[#a06a00]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-.9z" />
                      </svg>
                      Featured
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
                <p className="mt-auto">
                  <span className="rounded-[3px] bg-[#e9e8fd] px-2 py-1 text-[10px] text-brand">
                    {p.posted}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-[12px] font-medium text-[#121212]">
                  Feature
                  <Toggle
                    on={!!featured[p.id]}
                    disabled={pending}
                    onClick={() => toggleFeatured(p)}
                    label={`Feature ${p.name}`}
                  />
                </span>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/host?edit=${p.id}`}
                    className="text-[13px] font-medium text-[#121212] underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => askRemove(p)}
                    className="text-[13px] font-medium text-[#eb8ba9] underline disabled:opacity-50"
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
                  <p className="mt-3 rounded-[8px] bg-[#fdecec] px-3 py-2 text-[13px] leading-relaxed text-[#c0392b]">
                    {removeError}{" "}
                    <Link href="/profile/requests" className="font-semibold underline">
                      Go to Rent Requests
                    </Link>
                  </p>
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
