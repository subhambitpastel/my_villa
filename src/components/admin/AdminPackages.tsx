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
import { PACKAGE_TYPES, type PackageType } from "@/lib/packageTypes";
import {
  applyPreset,
  packageVillaCapacity,
  repriceFromDiscount,
  stayReference,
  type PricingVilla,
} from "@/lib/packageForm";
import {
  adminDeletePackageAction,
  adminUpdatePackageAction,
} from "@/lib/adminActions";
import type { PackageItem } from "@/lib/queries";

type Item = PackageItem & {
  ownerName: string;
  activeBookings: number;
  villa: PricingVilla;
};

/** The package as the edit form holds it — strings, because that's what inputs
 *  give back; the server re-reads and re-validates every one of them. */
type Draft = {
  name: string;
  description: string;
  type: PackageType;
  nights: string;
  maxGuests: string;
  discount: string;
  price: string;
  inclusions: string[];
};

const draftOf = (p: Item): Draft => ({
  name: p.name,
  description: p.description,
  type: p.type,
  nights: String(p.nights),
  maxGuests: String(p.maxGuests),
  // Blank rather than "0": an empty box invites a number, a zero reads like
  // one that was chosen. Same as the owner's form.
  discount: p.discount > 0 ? String(p.discount) : "",
  price: p.price > 0 ? String(p.price) : "",
  inclusions: [...p.inclusions],
});

const inputCls =
  "block w-full rounded-[8px] border border-[#d9d9d9] bg-white px-3 py-2 text-[14px] text-ink placeholder:text-[#9d9da6] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
// Same box as `inputCls` for fields carrying an inline $ / "% off".
const inputBoxCls =
  "flex items-center gap-1 rounded-[8px] border border-[#d9d9d9] bg-white px-3 py-2 text-[14px] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20";
const labelCls = "mb-1 block text-[12px] font-medium text-[#3a3a44]";
const onlyDigits = (v: string) => v.replace(/[^\d]/g, "");

const STATE = [
  { value: "all", label: "All packages" },
  { value: "live", label: "Bookable" },
  { value: "locked", label: "Locked" },
];
// Price and length are ranked rather than enumerated — "the dearest" and "the
// longest" are the questions worth asking of a list this size.
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "nights-desc", label: "Longest stay" },
];

export default function AdminPackages({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newInclusion, setNewInclusion] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [owner, setOwner] = useState("all");
  const [type, setType] = useState("all");
  const [state, setState] = useState("all");
  const [sort, setSort] = useState("newest");

  // Options come from the data, so a filter can only offer what exists.
  const owners = [...new Set(items.map((p) => p.ownerName))]
    .sort()
    .map((n) => ({ value: n, label: n }));
  const types = [...new Set(items.map((p) => p.type))]
    .sort()
    .map((t) => ({ value: t, label: t }));

  /* Draft above, what the list is showing below — see AdminFilterBar. */
  const [applied, setApplied] = useState({
    owner: "all",
    type: "all",
    state: "all",
    sort: "newest",
  });

  const rows = items
    .filter((p) => (applied.owner === "all" ? true : p.ownerName === applied.owner))
    .filter((p) => (applied.type === "all" ? true : p.type === applied.type))
    .filter((p) =>
      applied.state === "all"
        ? true
        : applied.state === "locked"
          ? p.locked || p.villaLocked
          : !p.locked && !p.villaLocked,
    )
    .filter((p) =>
      matchesSearch(query, p.name, p.villaName, p.villaCity, p.type, p.ownerName),
    )
    .sort((a, b) => {
      switch (applied.sort) {
        case "price-desc":
          return b.price - a.price;
        case "price-asc":
          return a.price - b.price;
        case "nights-desc":
          return b.nights - a.nights;
        default:
          return 0; // query order is newest-first already
      }
    });


  const activeFilters =
    (applied.owner !== "all" ? 1 : 0) +
    (applied.type !== "all" ? 1 : 0) +
    (applied.state !== "all" ? 1 : 0) +
    (applied.sort !== "newest" ? 1 : 0);

  function applyFilters() {
    setApplied({ owner, type, state, sort });
  }
  function cancelFilters() {
    setOwner(applied.owner);
    setType(applied.type);
    setState(applied.state);
    setSort(applied.sort);
  }

  function clearFilters() {
    setQuery("");
    setOwner("all");
    setType("all");
    setState("all");
    setSort("newest");
    setApplied({ owner: "all", type: "all", state: "all", sort: "newest" });
  }

  function openEdit(p: Item) {
    setEditing(p);
    setDraft(draftOf(p));
    setNewInclusion("");
    setFormError("");
  }

  /** Edit the draft against the package's own villa, so every rule that
   *  re-prices (preset applied, discount typed) has the rate to work from. */
  function edit(change: (d: Draft, villa: PricingVilla) => Draft) {
    if (!editing || !draft) return;
    setDraft(change(draft, editing.villa));
  }

  function addInclusion() {
    const v = newInclusion.trim();
    if (v && draft && !draft.inclusions.includes(v))
      setDraft({ ...draft, inclusions: [...draft.inclusions, v] });
    setNewInclusion("");
  }

  function save() {
    if (!editing || !draft) return;
    setFormError("");
    startTransition(async () => {
      const res = await adminUpdatePackageAction(editing.id, {
        // The server pins the package to its own villa; this is only here to
        // satisfy the shared input shape.
        villaId: editing.villaId,
        name: draft.name,
        description: draft.description,
        type: draft.type,
        nights: parseInt(draft.nights, 10) || 0,
        maxGuests: parseInt(draft.maxGuests, 10) || 0,
        discount: parseInt(draft.discount, 10) || 0,
        price: parseFloat(draft.price) || 0,
        inclusions: draft.inclusions,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setEditing(null);
      setDraft(null);
      setMessage({ ok: true, text: `"${draft.name.trim()}" saved.` });
      router.refresh();
    });
  }

  function remove(p: Item) {
    startTransition(async () => {
      const res = await adminDeletePackageAction(p.id);
      setDeleting(null);
      setMessage({
        ok: res.ok,
        text: res.ok ? `"${p.name}" deleted.` : res.error,
      });
      if (res.ok) router.refresh();
    });
  }

  // The same two read-outs the owner gets under their form: does this fit the
  // property, and what would the stay cost without the package.
  const guestsFrozen = (editing?.activeBookings ?? 0) > 0;
  const capacity =
    editing && draft
      ? (() => {
          const cap = packageVillaCapacity(editing.villa);
          const guests = parseInt(draft.maxGuests, 10) || 0;
          return {
            over: guests > cap,
            text:
              guests > cap
                ? `Over capacity — ${editing.villaName} fits up to ${cap} guest${cap === 1 ? "" : "s"}.`
                : `${editing.villaName} fits up to ${cap} guest${cap === 1 ? "" : "s"}.`,
          };
        })()
      : null;
  const reference = editing && draft ? stayReference(draft, editing.villa) : null;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <AdminFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by package, property, type or owner"
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
        <FilterField label="Package type">
          <Dropdown
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "All types" }, ...types]}
            ariaLabel="Filter by package type"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="State">
          <Dropdown
            value={state}
            onChange={setState}
            options={STATE}
            ariaLabel="Filter by state"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Sort by">
          <Dropdown
            value={sort}
            onChange={setSort}
            options={SORTS}
            ariaLabel="Sort packages"
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
          Packages
        </h2>
      </div>

      <ul className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No packages yet.
          </li>
        ) : (
          rows.map((p) => (
            <li key={p.id} className="rounded-[8px] border border-[#dfdfdf] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-[#121212]">
                  {p.name}
                </p>
                <span className="rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                  {p.type}
                </span>
                {p.discount > 0 && (
                  <span className="rounded-[3px] bg-[#e9e8fd] px-2 py-0.5 text-[11px] font-semibold text-brand">
                    {p.discount}% off
                  </span>
                )}
                {(p.locked || p.villaLocked) && (
                  <span className="rounded-[3px] bg-[#fdecec] px-2 py-0.5 text-[11px] font-semibold text-[#eb5757]">
                    {p.villaLocked ? "Property locked" : "Locked"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-[#7a7a85]">
                {p.villaName}, {p.villaCity} · {p.ownerName}
              </p>
              <p className="mt-1 text-[13px] text-[#3a3a44]">
                {p.nights} night{p.nights === 1 ? "" : "s"} · up to {p.maxGuests}{" "}
                guests · ${p.price.toFixed(2)} all-inclusive
              </p>
              {p.inclusions.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {p.inclusions.map((inc) => (
                    <li
                      key={inc}
                      className="rounded-full bg-[#f2f1fe] px-2.5 py-0.5 text-[12px] text-brand"
                    >
                      {inc}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#ececf0] pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="rounded-[8px] border border-brand px-4 py-1.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(p)}
                  className="text-[13px] text-[#eb5757] underline hover:opacity-80"
                >
                  Delete
                </button>
                {p.activeBookings > 0 && (
                  <span className="text-[12px] text-[#a06a00]">
                    {p.activeBookings} active booking
                    {p.activeBookings === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      {editing && draft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editing.name}`}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
          onClick={(e) => e.target === e.currentTarget && !pending && setEditing(null)}
        >
          <div className="w-full max-w-[560px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <p className="text-[18px] font-semibold text-[#121212]">
              Edit package
            </p>
            <p className="mt-1 text-[13px] text-[#7a7a85]">
              {editing.villaName}, {editing.villaCity} · {editing.ownerName}.
              Stays already booked keep the terms they were sold; edits apply to
              future ones.
            </p>

            {/* Field for field, the owner's own package form — and running on
                the same rules (lib/packageForm.ts), so a type picked here
                fills the nights and price exactly as it does for them. Support
                editing a package should see what the host saw when they built
                it, not a thinner form that quietly behaves differently. */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="pkg-type">Package type</label>
                <select
                  id="pkg-type"
                  className={inputCls}
                  value={draft.type}
                  onChange={(e) =>
                    edit((d, villa) =>
                      applyPreset(d, e.target.value as PackageType, villa),
                    )
                  }
                >
                  {PACKAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                      {t.nights ? ` (${t.nights} nights)` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-[#7a7a85]">
                  {draft.type === "curated"
                    ? "Its own nights and price."
                    : "Nights and price auto-filled — edit either and it becomes a Curated Package."}
                </span>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="pkg-name">Package name</label>
                <input
                  id="pkg-name"
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="pkg-desc">Description</label>
                <textarea
                  id="pkg-desc"
                  rows={2}
                  className={`${inputCls} resize-none`}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pkg-nights">Nights</label>
                <input
                  id="pkg-nights"
                  inputMode="numeric"
                  className={inputCls}
                  value={draft.nights}
                  onChange={(e) =>
                    edit((d, villa) =>
                      // Overriding a preset's length makes it curated — the
                      // server would rewrite the nights back otherwise.
                      repriceFromDiscount(
                        { ...d, nights: onlyDigits(e.target.value), type: "curated" },
                        villa,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pkg-guests">
                  For up to N guests
                </label>
                <input
                  id="pkg-guests"
                  inputMode="numeric"
                  className={`${inputCls} ${
                    guestsFrozen ? "cursor-not-allowed bg-[#f4f4f6] text-[#6f6f78]" : ""
                  }`}
                  value={draft.maxGuests}
                  readOnly={guestsFrozen}
                  title={
                    guestsFrozen
                      ? "Locked while stays are booked on this package."
                      : undefined
                  }
                  onChange={(e) =>
                    edit((d, villa) =>
                      repriceFromDiscount(
                        { ...d, maxGuests: onlyDigits(e.target.value) },
                        villa,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pkg-discount">Discount</label>
                <span className={inputBoxCls}>
                  <input
                    id="pkg-discount"
                    inputMode="numeric"
                    value={draft.discount}
                    onChange={(e) =>
                      edit((d, villa) =>
                        repriceFromDiscount(
                          {
                            ...d,
                            discount: onlyDigits(e.target.value).slice(0, 2),
                            type: "curated",
                          },
                          villa,
                        ),
                      )
                    }
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent text-[14px] focus:outline-none"
                  />
                  <span className="shrink-0 whitespace-nowrap text-[#9d9da6]">
                    % off
                  </span>
                </span>
              </div>
              <div>
                <label className={labelCls} htmlFor="pkg-price">
                  All-inclusive price
                </label>
                <span className={inputBoxCls}>
                  <span className="text-[#9d9da6]">$</span>
                  <input
                    id="pkg-price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) =>
                      // A typed price is the amount itself, not a %, so the
                      // discount clears — otherwise it would re-derive and
                      // overwrite what was just typed.
                      setDraft({
                        ...draft,
                        price: e.target.value.replace(/[^\d.]/g, ""),
                        discount: "",
                        type: "curated",
                      })
                    }
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent text-[14px] focus:outline-none"
                  />
                </span>
              </div>
            </div>

            {guestsFrozen && (
              <p className="mt-2 rounded-[8px] bg-[#fff3d6] px-3 py-2 text-[11px] leading-relaxed text-[#7a5200]">
                The guest count is locked —{" "}
                <span className="font-semibold">
                  {editing.activeBookings} active booking
                  {editing.activeBookings === 1 ? "" : "s"}
                </span>{" "}
                are measured against it. Everything else here can still be
                edited.
              </p>
            )}
            {capacity && (
              <p
                className={`mt-2 text-[11px] ${
                  capacity.over ? "font-medium text-[#c0392b]" : "text-[#7a7a85]"
                }`}
              >
                {capacity.text}
              </p>
            )}
            {reference && (
              <p className="mt-3 rounded-[8px] bg-[#f2f1fe] px-3.5 py-2.5 text-[12px] leading-relaxed text-brand">
                Booked normally (no package), a {reference.nights}-night stay (
                {reference.scope}) at this {reference.kindLabel} costs about{" "}
                <span className="font-semibold">
                  ${reference.normal.toFixed(2)}
                </span>
                {reference.discountNote
                  ? `, already after the ${reference.discountNote}`
                  : ""}
                .
                {reference.planDiscount > 0 && reference.target != null && (
                  <>
                    {" "}
                    The package&rsquo;s {reference.planDiscount}% off that comes
                    to about{" "}
                    <span className="font-semibold">
                      ${reference.target.toFixed(2)}
                    </span>
                    .
                  </>
                )}
                {reference.savings != null && (
                  <>
                    {" "}
                    It&rsquo;s priced ${reference.pkgPrice.toFixed(2)},{" "}
                    {reference.savings > 0
                      ? `saving guests $${reference.savings.toFixed(2)}.`
                      : reference.savings < 0
                        ? `which is $${Math.abs(reference.savings).toFixed(2)} above the regular price.`
                        : "the same as the regular price."}
                  </>
                )}
              </p>
            )}

            <div className="mt-4">
              <span className={labelCls}>Included experiences</span>
              <div className="flex gap-2">
                <input
                  value={newInclusion}
                  onChange={(e) => setNewInclusion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInclusion();
                    }
                  }}
                  placeholder="e.g. Airport pickup & drop"
                  aria-label="Add an included experience"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addInclusion}
                  className="shrink-0 rounded-[8px] border border-brand px-4 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Add
                </button>
              </div>
              {draft.inclusions.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {draft.inclusions.map((inc) => (
                    <li
                      key={inc}
                      className="flex items-center gap-1.5 rounded-full bg-[#f2f1fe] py-0.5 pl-2.5 pr-1.5 text-[12px] text-brand"
                    >
                      {inc}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            inclusions: draft.inclusions.filter((x) => x !== inc),
                          })
                        }
                        aria-label={`Remove ${inc}`}
                        className="leading-none text-brand/70 hover:text-brand"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {formError && (
              <p role="alert" className="mt-3 text-[13px] font-medium text-[#c0392b]">
                {formError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && !pending && setDeleting(null)}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <p className="text-[16px] font-semibold text-[#121212]">
              Delete &ldquo;{deleting.name}&rdquo;?
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              It disappears from {deleting.villaName} and guests can no longer
              book it. {deleting.ownerName} is notified.
            </p>
            {deleting.activeBookings > 0 && (
              <p className="mt-2 rounded-[6px] bg-[#fdf9f0] px-3 py-2 text-[13px] leading-[1.5] text-[#7a6a45]">
                <span className="font-semibold text-[#8a6a1f]">
                  {deleting.activeBookings} stay
                  {deleting.activeBookings === 1 ? "" : "s"} already booked on it
                </span>{" "}
                go ahead exactly as sold — each one kept its own copy of the
                bundle — but the host loses the package they were selling.
              </p>
            )}
            <p className="mt-2 text-[13px] font-medium text-[#c0392b]">
              This can&apos;t be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => remove(deleting)}
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
