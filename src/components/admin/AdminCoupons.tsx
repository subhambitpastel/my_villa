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
import { adminDeleteCouponAction } from "@/lib/adminActions";
import type { CouponItem } from "@/lib/queries";

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

export default function AdminCoupons({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [villa, setVilla] = useState("all");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState("all");
  const [use, setUse] = useState("all");
  const [confirming, setConfirming] = useState<Item | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const villas = [...new Set(items.map((c) => c.villaName))]
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
            options={[{ value: "all", label: "All properties" }, ...villas]}
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
