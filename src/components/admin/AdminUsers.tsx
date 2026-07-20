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
import { matchesSearch } from "@/lib/textSearch";
import { adminSetUserDisabledAction } from "@/lib/adminActions";
import type { AdminUserItem } from "@/lib/adminQueries";

const GRID =
  "grid grid-cols-[1.5fr_0.8fr_0.6fr_0.6fr_0.9fr_0.8fr] items-center gap-2";
const CHIP = "rounded-[3px] px-2 py-0.5 text-[10px] font-semibold";

const ROLE = [
  { value: "all", label: "Everyone" },
  { value: "guests", label: "Guests" },
  { value: "hosts", label: "Hosts" },
  { value: "admins", label: "Admins" },
  { value: "disabled", label: "Disabled" },
];
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "bookings-desc", label: "Most bookings" },
  { value: "properties-desc", label: "Most listings" },
  { value: "rating-desc", label: "Best rated host" },
];

export default function AdminUsers({
  items,
  currentAdminId,
}: {
  items: AdminUserItem[];
  /** The signed-in admin — their own row never offers a disable button. */
  currentAdminId: number;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("newest");
  const [confirming, setConfirming] = useState<AdminUserItem | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /* Draft above, what the list is showing below — see AdminFilterBar. */
  const [applied, setApplied] = useState({ role: "all", sort: "newest" });

  const rows = items
    .filter((u) =>
      applied.role === "all"
        ? true
        : applied.role === "guests"
          ? !u.isHost && !u.isAdmin
          : applied.role === "hosts"
            ? u.isHost
            : applied.role === "admins"
              ? u.isAdmin
              : u.disabled,
    )
    .filter((u) => matchesSearch(query, u.name, u.email, u.customerId, u.country))
    .sort((a, b) => {
      switch (applied.sort) {
        case "bookings-desc":
          return b.bookings - a.bookings;
        case "properties-desc":
          return b.properties - a.properties;
        case "rating-desc":
          return b.hostRating - a.hostRating || b.reviewsReceived - a.reviewsReceived;
        default:
          return 0; // query order is newest-first already
      }
    });


  const activeFilters =
    (applied.role !== "all" ? 1 : 0) + (applied.sort !== "newest" ? 1 : 0);

  function applyFilters() {
    setApplied({ role, sort });
  }
  function cancelFilters() {
    setRole(applied.role);
    setSort(applied.sort);
  }

  function clearFilters() {
    setQuery("");
    setRole("all");
    setSort("newest");
    setApplied({ role: "all", sort: "newest" });
  }

  function toggle(u: AdminUserItem) {
    startTransition(async () => {
      const res = await adminSetUserDisabledAction(u.id, !u.disabled);
      setConfirming(null);
      setMessage({
        ok: res.ok,
        text: res.ok
          ? `${u.name} ${u.disabled ? "restored" : "disabled"}.`
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
        placeholder="Search by name, email, customer ID or country"
        activeCount={activeFilters}
        onApply={applyFilters}
        onCancel={cancelFilters}
        onClear={clearFilters}
      >
        <FilterField label="Role">
          <Dropdown
            value={role}
            onChange={setRole}
            options={ROLE}
            ariaLabel="Filter by role"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Sort by">
          <Dropdown
            value={sort}
            onChange={setSort}
            options={SORTS}
            ariaLabel="Sort users"
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
          Users
        </h2>
      </div>

      <div
        className={`${GRID} mt-4 px-4 text-[11px] font-medium uppercase tracking-wide text-[#a1a1a2]`}
      >
        <span>Person</span>
        <span>Customer ID</span>
        <span>Bookings</span>
        <span>Listings</span>
        <span>Rating</span>
        <span>Account</span>
      </div>

      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No users match.
          </li>
        ) : (
          rows.map((u) => (
            <li
              key={u.id}
              className={`${GRID} rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-3 text-[13px]`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Image
                  src={u.avatar}
                  alt=""
                  width={28}
                  height={28}
                  className="h-[28px] w-[28px] shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[#121212]">
                    {u.name}
                  </span>
                  <span className="block truncate text-[12px] text-[#9a9aa5]">
                    {u.email}
                  </span>
                </span>
              </span>
              <span className="truncate text-[12px] text-[#7a7a85]">
                {u.customerId || "—"}
              </span>
              <span className="text-[#3a3a44]">{u.bookings}</span>
              <span className="text-[#3a3a44]">{u.properties}</span>
              <span className="text-[#3a3a44]">
                {/* Each count opens the ratings behind it, already filtered. */}
                {u.reviewsReceived > 0 ? (
                  <Link
                    href={`/admin/reviews?user=owner:${u.id}`}
                    className="text-brand underline-offset-2 hover:underline"
                    title={`Show the ${u.reviewsReceived} rating${u.reviewsReceived === 1 ? "" : "s"} ${u.name}'s properties received`}
                  >
                    {u.hostRating.toFixed(1)}★ ({u.reviewsReceived})
                  </Link>
                ) : (
                  "—"
                )}
                {u.reviewsWritten > 0 && (
                  <Link
                    href={`/admin/reviews?user=author:${u.id}`}
                    className="block text-[11px] text-brand underline-offset-2 hover:underline"
                    title={`Show the ${u.reviewsWritten} rating${u.reviewsWritten === 1 ? "" : "s"} ${u.name} wrote`}
                  >
                    wrote {u.reviewsWritten}
                  </Link>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {u.isAdmin && (
                  <span className={`${CHIP} bg-[#e9e8fd] text-brand`}>
                    Admin
                  </span>
                )}
                {u.isHost && !u.isAdmin && (
                  <span className={`${CHIP} bg-[#f1f0f6] text-[#5a5a66]`}>
                    Host
                  </span>
                )}
                {u.disabled && (
                  <span className={`${CHIP} bg-[#fdecec] text-[#eb5757]`}>
                    Disabled
                  </span>
                )}
                {!u.isAdmin && u.id !== currentAdminId && (
                  <button
                    type="button"
                    onClick={() => setConfirming(u)}
                    className={`text-[12px] underline hover:opacity-80 ${
                      u.disabled ? "text-brand" : "text-[#eb5757]"
                    }`}
                  >
                    {u.disabled ? "Enable" : "Disable"}
                  </button>
                )}
              </span>
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
              {confirming.disabled ? "Enable" : "Disable"} {confirming.name}?
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              {confirming.disabled
                ? "They'll be able to sign in again. Their bookings and listings were never touched."
                : "They're signed out immediately and can't sign back in. Their bookings and listings stay exactly as they are."}
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
                onClick={() => toggle(confirming)}
                disabled={pending}
                className={`rounded-[8px] px-5 py-2 text-[14px] font-semibold text-white transition-colors disabled:opacity-60 ${
                  confirming.disabled
                    ? "bg-brand hover:bg-brand-dark"
                    : "bg-[#eb5757] hover:bg-[#d64545]"
                }`}
              >
                {pending
                  ? "Saving…"
                  : confirming.disabled
                    ? "Yes, enable"
                    : "Yes, disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
