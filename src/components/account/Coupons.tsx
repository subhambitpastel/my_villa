"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SearchDropdown from "@/components/ui/SearchDropdown";
import {
  createCouponAction,
  deleteCouponAction,
  updateCouponAction,
} from "@/lib/actions";
import type { CouponItem } from "@/lib/queries";

/**
 * The owner's coupon desk: create a discount code for ONE of their properties
 * and manage the codes already out there.
 *
 * The rules the form enforces mirror the server's exactly: a coupon is a
 * percentage (1–99 — never 0, never a free stay) OR a fixed amount (> $0),
 * and codes are unique across the whole site. On a clash the server offers
 * free variations of the same name, rendered as one-click chips.
 */
export default function Coupons({
  villas,
  coupons,
  defaultVillaId,
}: {
  villas: { id: number; name: string; kind: string }[];
  coupons: CouponItem[];
  /** Property to preselect — set when "Create coupon" on a property card
   *  brought the owner here. Already validated as theirs by the page. */
  defaultVillaId?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [villaId, setVillaId] = useState(defaultVillaId ?? villas[0]?.id ?? 0);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"pct" | "fixed">("pct");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CouponItem | null>(null);
  // Why a delete was refused — only reachable if the coupon became in-use
  // between the page loading and the owner confirming (a guest redeemed it in
  // the gap); the button itself is disabled for coupons already in use.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The coupon being edited, if any — the form above doubles as its editor.
  const [editing, setEditing] = useState<CouponItem | null>(null);

  const num = Number(value) || 0;

  function startEdit(c: CouponItem) {
    // A coupon a live booking is riding on is frozen until that stay completes
    // — the server refuses the edit too, this just keeps the editor from opening
    // onto something that can't be saved.
    if (c.inUse) return;
    setEditing(c);
    setVillaId(c.villaId);
    setCode(c.code);
    setMode(c.pct > 0 ? "pct" : "fixed");
    setValue(String(c.pct > 0 ? c.pct : c.fixed));
    setError(null);
    setSuggestions([]);
    setCreated(null);
  }

  function cancelEdit() {
    setEditing(null);
    setCode("");
    setValue("");
    setError(null);
    setSuggestions([]);
  }

  function save() {
    setError(null);
    setSuggestions([]);
    setCreated(null);
    startTransition(async () => {
      const payload = {
        villaId,
        code,
        pct: mode === "pct" ? Math.trunc(num) : 0,
        fixed: mode === "fixed" ? num : 0,
      };
      const res = editing
        ? await updateCouponAction({ couponId: editing.id, ...payload })
        : await createCouponAction(payload);
      if (!res.ok) {
        setError(res.error);
        setSuggestions(res.suggestions ?? []);
        return;
      }
      setCreated(code.trim().toUpperCase());
      setEditing(null);
      setCode("");
      setValue("");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteCouponAction(id);
      if (!res.ok) {
        // Kept open so the reason (e.g. it's now in use) sits on the coupon.
        // Refresh too, so the row behind the dialog picks up its new "In use"
        // badge and disabled buttons.
        setDeleteError(res.error);
        router.refresh();
        return;
      }
      setDeleting(null);
      router.refresh();
    });
  }

  const discountLabel = (c: CouponItem) =>
    c.pct > 0 ? `${c.pct}% off` : `$${c.fixed.toFixed(2)} off`;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <h1 className="text-[16px] font-semibold text-[#121212]">
        <span className="text-brand">{coupons.length}</span> Coupon
        {coupons.length === 1 ? "" : "s"}
      </h1>
      <p className="mt-1 text-[12px] text-[#a1a1a2]">
        Each coupon belongs to one property. Guests enter the code at checkout;
        a discount can never make a stay free — the price floors at $1.
      </p>

      {/* ---------------- create ---------------- */}
      {villas.length === 0 ? (
        <p className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-6 text-center text-[13px] text-[#a1a1a2]">
          List a property first — coupons attach to one of your properties.
        </p>
      ) : (
        <div className="mt-6 rounded-[8px] border border-[#e3e3e8] bg-[#faf9fc] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[#121212]">
              {editing ? (
                <>
                  Editing{" "}
                  <span className="font-mono tracking-wide text-brand">
                    {editing.code}
                  </span>
                </>
              ) : (
                "New coupon"
              )}
            </p>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-[12px] text-[#7a7a85] underline hover:text-[#121212]"
              >
                Cancel editing
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-stretch gap-2.5">
            <SearchDropdown
              ariaLabel="Property"
              value={String(villaId)}
              onChange={(v) => setVillaId(Number(v))}
              options={villas.map((v) => ({
                value: String(v.id),
                label: `${v.name} · ${v.kind}`,
              }))}
              searchPlaceholder="Search your properties…"
              buttonClassName="flex min-w-[200px] items-center justify-between rounded-[8px] border-[1.5px] border-[#c9c9d4] bg-white px-3.5 py-2.5 text-[14px] text-[#121212]"
            />
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
              }
              maxLength={20}
              placeholder="Code, e.g. SUMMER-10"
              aria-label="Coupon code"
              className="w-[190px] rounded-[8px] border-[1.5px] border-[#c9c9d4] bg-white px-3.5 py-2.5 font-mono text-[14px] tracking-wide text-[#121212] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#9d9da6] focus:border-brand focus:outline-none"
            />
            <div className="flex shrink-0 overflow-hidden rounded-[8px] border-[1.5px] border-[#c9c9d4] bg-white">
              <button
                type="button"
                onClick={() => setMode("pct")}
                aria-pressed={mode === "pct"}
                className={`min-w-[58px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  mode === "pct"
                    ? "bg-brand text-white"
                    : "bg-white text-[#4a4a4a] hover:bg-brand/5"
                }`}
              >
                % off
              </button>
              <button
                type="button"
                onClick={() => setMode("fixed")}
                aria-pressed={mode === "fixed"}
                className={`min-w-[58px] border-l-[1.5px] border-[#c9c9d4] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  mode === "fixed"
                    ? "bg-brand text-white"
                    : "bg-white text-[#4a4a4a] hover:bg-brand/5"
                }`}
              >
                $ off
              </button>
            </div>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder={mode === "pct" ? "1–99 (%)" : "amount ($)"}
              aria-label={mode === "pct" ? "Percent off" : "Amount off"}
              className="w-[120px] rounded-[8px] border-[1.5px] border-[#c9c9d4] bg-white px-3.5 py-2.5 text-[14px] text-[#121212] placeholder:text-[#9d9da6] focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              disabled={pending || !code || num <= 0}
              onClick={save}
              className="rounded-[8px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create coupon"}
            </button>
          </div>

          {error && (
            <div className="mt-3">
              <p role="alert" className="text-[13px] font-medium text-[#c0392b]">
                {error}
              </p>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setCode(s);
                        setError(null);
                        setSuggestions([]);
                      }}
                      className="rounded-full border border-brand/40 bg-brand/5 px-3 py-1 font-mono text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {created && !error && (
            <p role="status" className="mt-3 text-[13px] font-medium text-[#1c7d5c]">
              Coupon {created} saved — guests can use it at checkout now.
            </p>
          )}
        </div>
      )}

      {/* ---------------- list ---------------- */}
      <ul className="mt-6 space-y-3">
        {coupons.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#dfdfdf] px-4 py-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className="rounded-[6px] bg-[#e9e8fd] px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wide text-brand">
                {c.code}
              </span>
              <span className="text-[14px] font-semibold text-[#121212]">
                {discountLabel(c)}
              </span>
              <span className="min-w-0 truncate text-[13px] text-[#7a7a85]">
                {c.villaName}
                <span className="ml-1.5 rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                  {c.villaKind}
                </span>
              </span>
              {c.inUse && (
                <span
                  title="A booking is using this coupon — you can edit or delete it once that stay completes."
                  className="rounded-full bg-[#fff3e0] px-2.5 py-0.5 text-[11px] font-semibold text-[#b26a00]"
                >
                  In use
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {/* Both Edit and Delete are frozen while a live booking rides the
                  coupon — the server refuses each until that stay completes;
                  these just keep the owner from opening a dialog that can't
                  go through. */}
              <button
                type="button"
                disabled={pending || c.inUse}
                onClick={() => startEdit(c)}
                title={
                  c.inUse
                    ? "A booking is using this coupon — you can edit it once that stay completes."
                    : undefined
                }
                className="text-[13px] text-brand underline hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={pending || c.inUse}
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(c);
                }}
                title={
                  c.inUse
                    ? "A booking is using this coupon — you can delete it once that stay completes."
                    : undefined
                }
                className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {coupons.length === 0 && villas.length > 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-6 text-center text-[13px] text-[#a1a1a2]">
            No coupons yet — create one above and share the code with your
            guests.
          </li>
        )}
      </ul>

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete this coupon"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) {
              setDeleting(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <h3 className="text-[18px] font-semibold text-[#121212]">
              Delete coupon {deleting.code}?
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
              Guests won&rsquo;t be able to redeem it any more. Stays that
              already used it keep their discount.
            </p>
            {deleteError && (
              <p
                role="alert"
                className="mt-3 rounded-[8px] bg-[#fdecec] px-3 py-2 text-[13px] leading-relaxed text-[#c0392b]"
              >
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeleting(null);
                  setDeleteError(null);
                }}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-50"
              >
                {deleteError ? "Close" : "Keep coupon"}
              </button>
              <button
                type="button"
                disabled={pending || !!deleteError}
                onClick={confirmDelete}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
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
