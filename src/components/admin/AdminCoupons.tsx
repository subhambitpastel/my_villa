"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AdminFilterBar, {
  FilterField,
  FILTER_BTN,
} from "@/components/admin/AdminFilterBar";
import Dropdown from "@/components/ui/Dropdown";
import SearchDropdown from "@/components/ui/SearchDropdown";
import { matchesSearch } from "@/lib/textSearch";
import {
  adminCreateCouponAction,
  adminDeleteCouponAction,
  adminUpdateCouponAction,
} from "@/lib/adminActions";
import type { AdminVillaOption, CouponItem } from "@/lib/queries";

type Item = CouponItem & { ownerName: string };

const KIND = [
  { value: "all", label: "All discounts" },
  { value: "pct", label: "Percentage off" },
  { value: "fixed", label: "Fixed amount off" },
];
const USE = [
  { value: "all", label: "Used or not" },
  { value: "inuse", label: "In use" },
  { value: "free", label: "Not in use" },
];

export default function AdminCoupons({
  items,
  villas,
}: {
  items: Item[];
  /** Every listing on the platform — support can attach a coupon to any of them. */
  villas: AdminVillaOption[];
}) {
  const [query, setQuery] = useState("");
  const [villa, setVilla] = useState("all");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [use, setUse] = useState("all");
  const [confirming, setConfirming] = useState<Item | null>(null);
  // One form serves both jobs, exactly like the owner's desk: `editing` null
  // while the dialog is open means "creating". Draft values plus whatever the
  // server said about them live alongside.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [villaId, setVillaId] = useState(0);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"pct" | "fixed">("pct");
  const [value, setValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Filter options come from the coupons on screen (names only); the `villas`
  // prop is the full platform pick-list the create/edit form attaches to.
  const villaNames = [...new Set(items.map((c) => c.villaName))]
    .sort()
    .map((n) => ({ value: n, label: n }));
  const owners = [...new Set(items.map((c) => c.ownerName))]
    .sort()
    .map((n) => ({ value: n, label: n }));

  /* Draft above, what the list is showing below — see AdminFilterBar. */
  const [applied, setApplied] = useState({
    villa: "all",
    owner: "all",
    kind: "all",
    use: "all",
  });

  const rows = items
    .filter((c) => (applied.villa === "all" ? true : c.villaName === applied.villa))
    .filter((c) => (applied.owner === "all" ? true : c.ownerName === applied.owner))
    .filter((c) =>
      applied.kind === "all" ? true : applied.kind === "pct" ? c.pct > 0 : c.fixed > 0,
    )
    .filter((c) =>
      applied.use === "all" ? true : applied.use === "inuse" ? c.inUse : !c.inUse,
    )
    .filter((c) => matchesSearch(query, c.code, c.villaName, c.ownerName));


  const activeFilters =
    (applied.villa !== "all" ? 1 : 0) +
    (applied.owner !== "all" ? 1 : 0) +
    (applied.kind !== "all" ? 1 : 0) +
    (applied.use !== "all" ? 1 : 0);

  function applyFilters() {
    setApplied({ villa, owner, kind, use });
  }
  function cancelFilters() {
    setVilla(applied.villa);
    setOwner(applied.owner);
    setKind(applied.kind);
    setUse(applied.use);
  }

  function clearFilters() {
    setQuery("");
    setVilla("all");
    setOwner("all");
    setKind("all");
    setUse("all");
    setApplied({ villa: "all", owner: "all", kind: "all", use: "all" });
  }

  function openCreate() {
    setEditing(null);
    setVillaId(villas[0]?.id ?? 0);
    setCode("");
    setMode("pct");
    setValue("");
    setEditError(null);
    setSuggestions([]);
    setFormOpen(true);
  }

  function startEdit(c: Item) {
    // Server refuses an in-use edit anyway; this stops the dialog opening onto
    // something that can't be saved.
    if (c.inUse) return;
    setEditing(c);
    setVillaId(c.villaId);
    setCode(c.code);
    setMode(c.pct > 0 ? "pct" : "fixed");
    setValue(String(c.pct > 0 ? c.pct : c.fixed));
    setEditError(null);
    setSuggestions([]);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setEditError(null);
    setSuggestions([]);
  }

  function saveForm() {
    const num = Number(value) || 0;
    const payload = {
      villaId,
      code,
      pct: mode === "pct" ? Math.trunc(num) : 0,
      fixed: mode === "fixed" ? num : 0,
    };
    setEditError(null);
    setSuggestions([]);
    startTransition(async () => {
      const res = editing
        ? await adminUpdateCouponAction({ couponId: editing.id, ...payload })
        : await adminCreateCouponAction(payload);
      if (!res.ok) {
        setEditError(res.error);
        setSuggestions(res.suggestions ?? []);
        return;
      }
      const saved = code.trim().toUpperCase();
      setMessage({
        ok: true,
        text: editing
          ? `Coupon ${editing.code} updated to ${saved}.`
          : `Coupon ${saved} created.`,
      });
      closeForm();
      router.refresh();
    });
  }

  function remove(c: Item) {
    startTransition(async () => {
      const res = await adminDeleteCouponAction(c.id);
      setConfirming(null);
      setMessage({
        ok: res.ok,
        text: res.ok ? `Coupon ${c.code} deleted.` : res.error,
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <AdminFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by code, property or owner"
        activeCount={activeFilters}
        onApply={applyFilters}
        onCancel={cancelFilters}
        onClear={clearFilters}
      >
        <FilterField label="Property">
          <SearchDropdown
            value={villa}
            onChange={setVilla}
            options={[{ value: "all", label: "All properties" }, ...villaNames]}
            ariaLabel="Filter by property"
            searchPlaceholder="Search properties…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
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
        <FilterField label="Discount kind">
          <Dropdown
            value={kind}
            onChange={setKind}
            options={KIND}
            ariaLabel="Filter by discount kind"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="In use">
          <Dropdown
            value={use}
            onChange={setUse}
            options={USE}
            ariaLabel="Filter by whether a booking is using it"
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
          Coupons
        </h2>
        <button
          type="button"
          onClick={openCreate}
          disabled={villas.length === 0}
          title={
            villas.length === 0
              ? "There are no properties to attach a coupon to yet."
              : undefined
          }
          className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          New coupon
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No coupons yet.
          </li>
        ) : (
          rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#dfdfdf] px-4 py-3"
            >
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-[4px] bg-[#f2f1fe] px-2.5 py-1 text-[13px] font-semibold tracking-wide text-brand">
                  {c.code}
                </span>
                <span className="text-[13px] font-semibold text-[#121212]">
                  {c.pct > 0 ? `${c.pct}% off` : `$${c.fixed} off`}
                </span>
                <span className="text-[13px] text-[#7a7a85]">
                  {c.villaName}
                </span>
                <span className="rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                  {c.villaKind}
                </span>
                <span className="text-[12px] text-[#9a9aa5]">
                  {c.ownerName}
                </span>
                {c.inUse && (
                  <span className="rounded-[3px] bg-[#fff3d6] px-2 py-0.5 text-[11px] font-semibold text-[#a06a00]">
                    In use
                  </span>
                )}
              </span>
              {/* Edit and Delete are both frozen while a standing booking is
                  riding the code — the server refuses each until it completes. */}
              <span className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  disabled={c.inUse}
                  title={
                    c.inUse
                      ? "A standing booking is using this code — it unlocks once that stay completes."
                      : undefined
                  }
                  className="text-[13px] text-brand underline hover:opacity-80 disabled:cursor-not-allowed disabled:text-[#c9c9cf] disabled:no-underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(c)}
                  disabled={c.inUse}
                  title={
                    c.inUse
                      ? "A standing booking is using this code — it unlocks once that stay completes."
                      : undefined
                  }
                  className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:cursor-not-allowed disabled:text-[#c9c9cf] disabled:no-underline"
                >
                  Delete
                </button>
              </span>
            </li>
          ))
        )}
      </ul>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Edit this coupon" : "Create a coupon"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && closeForm()}
        >
          <div
            className="w-full max-w-[460px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-[#121212]">
              {editing ? `Edit coupon ${editing.code}` : "New coupon"}
            </p>
            <p className="mt-1 text-[13px] text-[#7a7a85]">
              {editing
                ? `Currently on ${editing.villaName} · ${editing.ownerName}`
                : "Attach a discount code to any property on the platform."}
            </p>

            {/* Support isn't limited to one owner's listings — every property
                on the platform is a valid target, including re-homing an
                existing coupon to a different one. */}
            <p className="mt-4 text-[12px] font-medium text-[#5a5a66]">
              Property
            </p>
            <div className="mt-1">
              <SearchDropdown
                value={String(villaId)}
                onChange={(v) => setVillaId(Number(v))}
                options={villas.map((v) => ({
                  value: String(v.id),
                  label: `${v.name}, ${v.city} · ${v.kind} — ${v.ownerName}`,
                }))}
                ariaLabel="Property this coupon belongs to"
                searchPlaceholder="Search properties or owners…"
                buttonClassName="flex w-full items-center justify-between gap-2 rounded-[8px] border-[1.5px] border-[#c9c9d4] bg-white px-3.5 py-2.5 text-left text-[14px] text-[#121212]"
              />
            </div>

            <label
              htmlFor="admin-coupon-code"
              className="mt-4 block text-[12px] font-medium text-[#5a5a66]"
            >
              Code
            </label>
            <input
              id="admin-coupon-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
              }
              maxLength={20}
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-[#c9c9d4] px-3.5 py-2.5 font-mono text-[14px] tracking-wide text-[#121212] focus:border-brand focus:outline-none"
            />

            <p className="mt-4 text-[12px] font-medium text-[#5a5a66]">
              Discount
            </p>
            <div className="mt-1 flex items-stretch gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-[8px] border-[1.5px] border-[#c9c9d4]">
                {(["pct", "fixed"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`min-w-[58px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                      m === "fixed" ? "border-l-[1.5px] border-[#c9c9d4]" : ""
                    } ${
                      mode === m
                        ? "bg-brand text-white"
                        : "bg-white text-[#4a4a4a] hover:bg-brand/5"
                    }`}
                  >
                    {m === "pct" ? "% off" : "$ off"}
                  </button>
                ))}
              </div>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder={mode === "pct" ? "1–99 (%)" : "amount ($)"}
                aria-label={mode === "pct" ? "Percent off" : "Amount off"}
                className="w-full min-w-0 rounded-[8px] border-[1.5px] border-[#c9c9d4] px-3.5 py-2.5 text-[14px] text-[#121212] focus:border-brand focus:outline-none"
              />
            </div>

            <p className="mt-3 text-[12px] leading-[1.5] text-[#7a7a85]">
              {editing
                ? "Stays that already used this code keep their original discount — this only changes future redemptions."
                : "Guests can apply it at checkout straight away. A discount can never make a stay free — the price floors at $1."}{" "}
              The owner is notified.
            </p>

            {editError && (
              <div className="mt-3">
                <p
                  role="alert"
                  className="rounded-[8px] bg-[#fdecec] px-3 py-2 text-[13px] leading-[1.5] text-[#c0392b]"
                >
                  {editError}
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setCode(s);
                          setEditError(null);
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

            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveForm}
                disabled={
                  pending || !villaId || !code.trim() || (Number(value) || 0) <= 0
                }
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              Delete {confirming.code}?
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              Guests can no longer apply it to {confirming.villaName}. Bookings
              that already used it keep their discount. {confirming.ownerName}{" "}
              is notified.
            </p>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => remove(confirming)}
                disabled={pending}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
