"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createPackageAction,
  updatePackageAction,
  deletePackageAction,
} from "@/lib/actions";
import type { PackageItem, PropertyItem } from "@/lib/queries";
import { isRoomBased, roomsForGuests } from "@/lib/rooms";
import { quote } from "@/lib/pricing";
import {
  PACKAGE_TYPES,
  packageTypeLabel,
  presetNights,
  presetDiscount,
  type PackageType,
} from "@/lib/packageTypes";

const input =
  "block w-full rounded-[8px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-[#9d9da6] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
// Same visual box as `input`, for fields that need an inline prefix/suffix
// ($ / % off) alongside a borderless inner <input>. Keeps the whole row aligned.
const inputBox =
  "flex items-center gap-1 rounded-[8px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[14px] focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20";
const fieldLabel = "mb-1.5 block text-[13px] text-brand";
const onlyDigits = (v: string) => v.replace(/[^\d]/g, "");

type Form = {
  villaId: number | "";
  name: string;
  description: string;
  type: PackageType;
  nights: string;
  maxGuests: string;
  discount: string;
  price: string;
  inclusions: string[];
};

const emptyForm = (villaId: number | ""): Form => ({
  villaId,
  name: "",
  description: "",
  type: "curated",
  nights: "",
  maxGuests: "",
  discount: "",
  price: "",
  inclusions: [],
});

/** Kind-aware capacity: room-based villas cap at rooms × per-room occupancy. */
function villaCapacity(v: PropertyItem): number {
  return isRoomBased(v.kind)
    ? Math.max(1, v.rooms * v.peoplePerRoom)
    : Math.max(1, v.maxGuests);
}

/** Apply a preset type: fix the nights and auto-price it off the villa's nightly
 *  rate (villa price × nights − long-stay discount + fee = the tier's total). */
function applyPreset(
  f: Form,
  type: PackageType,
  villas: PropertyItem[],
): Form {
  const nights = presetNights(type);
  if (nights === null) return { ...f, type: "curated" };
  const villa =
    f.villaId === "" ? undefined : villas.find((v) => v.id === f.villaId);
  const price = villa ? quote(villa.price, nights).total : 0;
  return {
    ...f,
    type,
    nights: String(nights),
    discount: String(presetDiscount(type) ?? 0),
    price: villa ? price.toFixed(2) : "",
  };
}

/** For a curated package with a discount %, keep the all-inclusive price in sync
 *  with that discount — price = the regular booking price, less the plan's % —
 *  so a "30% off" plan actually costs 30% less and the shown guest savings track
 *  the discount. No discount (or a preset, which prices itself) leaves price be. */
function repriceFromDiscount(f: Form, villas: PropertyItem[]): Form {
  if (f.type !== "curated") return f;
  const d = parseInt(f.discount, 10) || 0;
  const nights = parseInt(f.nights, 10) || 0;
  const villa =
    f.villaId === "" ? undefined : villas.find((v) => v.id === f.villaId);
  if (!villa || nights < 1 || d <= 0) return f;
  const guests = parseInt(f.maxGuests, 10) || 0;
  const rooms = isRoomBased(villa.kind)
    ? roomsForGuests(villa.kind, guests, villa.peoplePerRoom)
    : 1;
  const normal = quote(villa.price * rooms, nights, villa.discount).total;
  const price = Math.round(normal * (1 - d / 100) * 100) / 100;
  return { ...f, price: price.toFixed(2) };
}

export default function MyPackages({
  villas,
  packages,
}: {
  villas: PropertyItem[];
  packages: PackageItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  // null = creating a new package; a number = editing that package.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(() => emptyForm(villas[0]?.id ?? ""));
  const [newInclusion, setNewInclusion] = useState("");
  // Package awaiting a delete confirmation.
  const [confirming, setConfirming] = useState<PackageItem | null>(null);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(villas[0]?.id ?? ""));
    setNewInclusion("");
    setError("");
  }

  function startEdit(p: PackageItem) {
    setEditingId(p.id);
    setForm({
      villaId: p.villaId,
      name: p.name,
      description: p.description,
      type: p.type,
      nights: String(p.nights),
      maxGuests: String(p.maxGuests),
      discount: p.discount > 0 ? String(p.discount) : "",
      price: p.price > 0 ? String(p.price) : "",
      inclusions: [...p.inclusions],
    });
    setNewInclusion("");
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addInclusion() {
    const v = newInclusion.trim();
    if (v && !form.inclusions.includes(v)) {
      setForm((f) => ({ ...f, inclusions: [...f.inclusions, v] }));
    }
    setNewInclusion("");
  }

  function removeInclusion(name: string) {
    setForm((f) => ({
      ...f,
      inclusions: f.inclusions.filter((x) => x !== name),
    }));
  }

  function submit() {
    if (form.villaId === "") {
      setError("Choose which villa this package is for.");
      return;
    }
    if (!form.name.trim()) {
      setError("Give the package a name.");
      return;
    }
    if (!(parseInt(form.nights, 10) >= 1)) {
      setError("Set how many nights the package runs (at least 1).");
      return;
    }
    if (!(parseInt(form.maxGuests, 10) >= 1)) {
      setError("Set how many guests the package is for (at least 1).");
      return;
    }
    if (form.inclusions.length === 0) {
      setError("Add at least one included experience.");
      return;
    }
    const payload = {
      villaId: Number(form.villaId),
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      nights: parseInt(form.nights, 10) || 0,
      maxGuests: parseInt(form.maxGuests, 10) || 0,
      discount: parseInt(form.discount, 10) || 0,
      price: parseFloat(form.price) || 0,
      inclusions: form.inclusions,
    };
    startTransition(async () => {
      const res = editingId
        ? await updatePackageAction(editingId, payload)
        : await createPackageAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function confirmRemove() {
    if (!confirming) return;
    const id = confirming.id;
    startTransition(async () => {
      await deletePackageAction(id);
      if (editingId === id) resetForm();
      setConfirming(null);
      router.refresh();
    });
  }

  const selectedVilla =
    form.villaId === "" ? undefined : villas.find((v) => v.id === form.villaId);
  // Live capacity feedback for the selected villa. `over` is true when the
  // package's guest count can't fit — the hint then reads as an error (red).
  const capacity = (() => {
    if (!selectedVilla) return null;
    const cap = villaCapacity(selectedVilla);
    const guests = parseInt(form.maxGuests, 10) || 0;
    const nights = parseInt(form.nights, 10) || 0;
    const stay = nights >= 1 ? `${nights}-night stay · ` : "";
    const over = guests > cap;
    const kind = selectedVilla.kind.toLowerCase();
    if (isRoomBased(selectedVilla.kind)) {
      const rooms =
        guests >= 1
          ? roomsForGuests(selectedVilla.kind, guests, selectedVilla.peoplePerRoom)
          : 0;
      if (over) {
        return {
          over,
          text: `${stay}needs ${rooms} rooms but this ${kind} only has ${selectedVilla.rooms} — set guests to ${cap} or fewer.`,
        };
      }
      const reserves =
        rooms >= 1
          ? `reserves ${rooms} of ${selectedVilla.rooms} room${selectedVilla.rooms === 1 ? "" : "s"} · `
          : "";
      return { over, text: `${stay}${reserves}this ${kind} fits up to ${cap} guests.` };
    }
    if (over) {
      return {
        over,
        text: `${stay}over capacity — this villa fits up to ${cap} guest${cap === 1 ? "" : "s"}.`,
      };
    }
    return {
      over,
      text: `${stay}books the whole villa · fits up to ${cap} guest${cap === 1 ? "" : "s"}.`,
    };
  })();

  // What a regular guest (no package) would pay to book the same villa for the
  // same nights — a reference so the owner can price the all-inclusive package
  // sensibly. Room-based villas price by the rooms the package's occupancy needs.
  const reference = (() => {
    if (!selectedVilla) return null;
    const nights = parseInt(form.nights, 10) || 0;
    const guests = parseInt(form.maxGuests, 10) || 0;
    // Only the nights are needed to show a reference; before guests are set a
    // room-based villa falls back to a single room (roomsForGuests returns 1).
    if (nights < 1) return null;
    const roomBased = isRoomBased(selectedVilla.kind);
    const rooms = roomBased
      ? roomsForGuests(selectedVilla.kind, guests, selectedVilla.peoplePerRoom)
      : 1;
    // Regular booking cost — the same quote() checkout charges, so it already
    // applies the larger of the hotel's own discount and the automatic long-stay
    // discount (they don't stack), plus the service fee.
    const q = quote(selectedVilla.price * rooms, nights, selectedVilla.discount);
    const normal = q.total;
    const discountNote = q.discount.rate > 0 ? q.discount.label.toLowerCase() : "";
    const scope = roomBased
      ? `${rooms} room${rooms === 1 ? "" : "s"}`
      : "the whole villa";
    const nounMap: Record<string, string> = {
      Resort: "resort",
      Hotel: "hotel",
      Bungalow: "bungalow",
      "Villa Living": "villa",
    };
    const kindLabel = nounMap[selectedVilla.kind] ?? "villa";
    // The discount the owner is advertising on this package, applied to the
    // regular price to suggest a matching all-inclusive price.
    const planDiscount = Math.min(90, parseInt(form.discount, 10) || 0);
    const target =
      planDiscount > 0
        ? Math.round(normal * (1 - planDiscount / 100) * 100) / 100
        : null;
    const pkgPrice = parseFloat(form.price) || 0;
    const savings =
      pkgPrice > 0 ? Math.round((normal - pkgPrice) * 100) / 100 : null;
    return { normal, nights, scope, kindLabel, discountNote, planDiscount, target, pkgPrice, savings };
  })();

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <h2 className="text-[16px] font-semibold text-[#121212]">Stay Packages</h2>
      <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-body">
        Build a fixed getaway for one of your villas — set the number of nights,
        how many guests it&rsquo;s for, and one all-inclusive price that covers
        the stay plus every experience (airport pickup, sightseeing, meals).
        Guests pick a start date and get the whole bundle; unlike optional extra
        services, they can&rsquo;t remove individual items.
      </p>

      {villas.length === 0 ? (
        <div className="mt-6 rounded-[8px] border border-[#dfdfdf] px-4 py-10 text-center">
          <p className="text-[14px] font-semibold text-ink">List a villa first</p>
          <p className="mt-1 text-[13px] text-body">
            Packages attach to a villa you own.{" "}
            <Link href="/host" className="text-brand underline">
              Add a villa
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Create / edit form */}
          <div className="mt-6 rounded-[10px] border border-[#e3e3e8] p-5">
            <h3 className="text-[15px] font-semibold text-ink">
              {editingId ? "Edit package" : "Create a package"}
            </h3>

            <label className="mt-4 block">
              <span className={fieldLabel}>Package type</span>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => applyPreset(f, e.target.value as PackageType, villas))
                }
                className={input}
              >
                {PACKAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                    {t.nights ? ` (${t.nights} nights)` : ""}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted">
                {form.type === "curated"
                  ? "Set your own nights and price."
                  : "Nights and price auto-filled — edit either and it becomes a Curated Package."}
              </span>
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Villa</span>
                <select
                  value={form.villaId}
                  onChange={(e) =>
                    setForm((f) => {
                      const villaId = e.target.value === "" ? "" : Number(e.target.value);
                      // Re-price a preset for the newly chosen villa's nightly rate;
                      // a curated discount re-prices off the new villa too.
                      return repriceFromDiscount(
                        applyPreset({ ...f, villaId }, f.type, villas),
                        villas,
                      );
                    })
                  }
                  className={input}
                >
                  {villas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}, {v.city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Package name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Explorer Weekend"
                  className={input}
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className={fieldLabel}>Description</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                placeholder="What makes this package special?"
                className={`${input} resize-none`}
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className={fieldLabel}>Nights</span>
                <input
                  value={form.nights}
                  inputMode="numeric"
                  onChange={(e) =>
                    setForm((f) =>
                      repriceFromDiscount(
                        { ...f, nights: onlyDigits(e.target.value), type: "curated" },
                        villas,
                      ),
                    )
                  }
                  placeholder="e.g. 3"
                  className={input}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>For up to N guests</span>
                <input
                  value={form.maxGuests}
                  inputMode="numeric"
                  onChange={(e) =>
                    setForm((f) =>
                      repriceFromDiscount(
                        { ...f, maxGuests: onlyDigits(e.target.value) },
                        villas,
                      ),
                    )
                  }
                  placeholder="e.g. 4"
                  className={input}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Discount</span>
                <span className={inputBox}>
                  <input
                    value={form.discount}
                    inputMode="numeric"
                    onChange={(e) =>
                      setForm((f) =>
                        repriceFromDiscount(
                          {
                            ...f,
                            discount: onlyDigits(e.target.value).slice(0, 2),
                            type: "curated",
                          },
                          villas,
                        ),
                      )
                    }
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent text-[14px] focus:outline-none"
                  />
                  <span className="shrink-0 whitespace-nowrap text-[#9d9da6]">% off</span>
                </span>
              </label>
              <label className="block">
                <span className={fieldLabel}>All-inclusive price</span>
                <span className={inputBox}>
                  <span className="text-[#9d9da6]">$</span>
                  <input
                    value={form.price}
                    inputMode="decimal"
                    onChange={(e) =>
                      // Typing a price directly means the owner is setting the
                      // amount, not a %, so clear the discount (they drive price
                      // OR discount, not both) — otherwise a discount would
                      // re-derive and overwrite what they just typed.
                      setForm((f) => ({
                        ...f,
                        price: e.target.value.replace(/[^\d.]/g, ""),
                        discount: "",
                        type: "curated",
                      }))
                    }
                    placeholder="0"
                    className="w-full bg-transparent text-[14px] focus:outline-none"
                  />
                </span>
              </label>
            </div>
            {capacity && (
              <p
                className={`mt-2 text-[11px] ${
                  capacity.over ? "font-medium text-red-600" : "text-muted"
                }`}
              >
                {capacity.text}
              </p>
            )}
            {reference && (
              <p className="mt-3 rounded-[8px] bg-[#f2f1fe] px-3.5 py-2.5 text-[12px] leading-relaxed text-brand">
                Booked normally (no package), a {reference.nights}-night stay
                ({reference.scope}) at this {reference.kindLabel} costs about{" "}
                <span className="font-semibold">
                  ${reference.normal.toFixed(2)}
                </span>{" "}
                — the nightly rate plus service fee
                {reference.discountNote
                  ? `, already after the ${reference.discountNote}`
                  : ""}
                .
                {reference.planDiscount > 0 && reference.target != null && (
                  <>
                    {" "}
                    Your plan&rsquo;s {reference.planDiscount}% off that comes to
                    about{" "}
                    <span className="font-semibold">
                      ${reference.target.toFixed(2)}
                    </span>
                    .
                  </>
                )}
                {reference.savings != null && (
                  <>
                    {" "}
                    You&rsquo;ve priced it ${reference.pkgPrice.toFixed(2)},{" "}
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
              <span className={fieldLabel}>Included experiences</span>
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
                  className={input}
                />
                <button
                  type="button"
                  onClick={addInclusion}
                  className="shrink-0 rounded-[8px] border border-brand px-4 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Add
                </button>
              </div>
              {form.inclusions.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {form.inclusions.map((inc) => (
                    <li
                      key={inc}
                      className="flex items-center gap-1.5 rounded-full bg-[#e9e8fd] px-3 py-1 text-[13px] text-brand"
                    >
                      {inc}
                      <button
                        type="button"
                        onClick={() => removeInclusion(inc)}
                        aria-label={`Remove ${inc}`}
                        className="text-[16px] leading-none text-brand/60 hover:text-brand"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-red-600">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-[8px] bg-brand px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Saving…" : editingId ? "Save changes" : "Create package"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[13px] text-[#7a7a85] underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Existing packages */}
          <h3 className="mt-8 text-[15px] font-semibold text-ink">
            Your packages ({packages.length})
          </h3>
          {packages.length === 0 ? (
            <p className="mt-3 rounded-[8px] border border-[#dfdfdf] px-4 py-6 text-center text-[13px] text-muted">
              No packages yet. Create one above.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {packages.map((p) => (
                <li key={p.id} className="rounded-[8px] border border-[#dfdfdf] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-heading">
                          {p.name}
                        </p>
                        <span className="rounded-[3px] bg-[#e9e8fd] px-1.5 py-0.5 text-[10px] font-medium text-brand">
                          {packageTypeLabel(p.type)}
                        </span>
                        {p.discount > 0 && (
                          <span className="rounded-[3px] bg-[#e6f7f1] px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            {p.discount}% off
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray">
                        {p.villaName}, {p.villaCity}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {p.nights} night{p.nights === 1 ? "" : "s"} · up to{" "}
                        {p.maxGuests} guest{p.maxGuests === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-brand">
                      {p.price > 0 ? `$${p.price.toFixed(2)}` : "Free"}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-body">
                      {p.description}
                    </p>
                  )}
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
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-[13px] font-medium text-[#121212] underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirming(p)}
                      className="text-[13px] font-medium text-[#eb5757] underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deleting your package"
          onClick={(e) =>
            e.target === e.currentTarget && !pending && setConfirming(null)
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
                  Delete this package?
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">{confirming.name}</span>? This
                  removes the package from your villa and can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(null)}
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
                {pending ? "Deleting…" : "Delete package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
