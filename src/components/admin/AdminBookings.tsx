"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AdminFilterBar, {
  FilterField,
  FILTER_BTN,
} from "@/components/admin/AdminFilterBar";
import Dropdown from "@/components/ui/Dropdown";
import SearchDropdown from "@/components/ui/SearchDropdown";
import DateRangePicker, { formatRangeKey } from "@/components/ui/DateRangePicker";
import { matchesSearch } from "@/lib/textSearch";
import { formatRange } from "@/lib/dates";
import { adminCancelBookingAction } from "@/lib/adminActions";
import type { RequestItem } from "@/lib/queries";

// Guest / Property / Owner / Stay / Guests / Status — the admin's table needs
// BOTH sides of a booking, which is the one thing neither existing list shows.
const GRID =
  "grid grid-cols-[1.2fr_1.1fr_0.9fr_1fr_0.7fr_0.9fr] items-center gap-2";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  pending: "Payment pending",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_CLASS: Record<string, string> = {
  accepted: "bg-[#e9e8fd] text-brand",
  pending: "bg-[#fff3d6] text-[#a06a00]",
  declined: "bg-[#fdecec] text-[#eb5757]",
  cancelled: "bg-[#fdecec] text-[#eb5757]",
  completed: "bg-[#e5f4ee] text-[#1c7d5c]",
};

const FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Payment pending" },
  { value: "accepted", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
];

function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-[#9a9aa5] transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[13px] text-[#121212]">{value}</p>
    </div>
  );
}

function Row({
  b,
  onCancelled,
  defaultOpen = false,
}: {
  b: RequestItem;
  onCancelled: (msg: string, ok: boolean) => void;
  /** Arriving from a link that means "this one" — show the detail straight
   *  away rather than making them click the row they were just sent to. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const cancellable = b.status === "accepted" || b.status === "pending";

  function cancel() {
    startTransition(async () => {
      const res = await adminCancelBookingAction(b.id);
      setConfirming(false);
      onCancelled(
        res.ok ? `Booking #${b.id} cancelled.` : res.error,
        res.ok,
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="overflow-hidden rounded-[6px] border border-[#dfdfdf] bg-white">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={`${GRID} cursor-pointer px-4 py-3 text-[13px] hover:bg-[#faf9ff]`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ExpandIcon open={open} />
          <Image
            src={b.avatar}
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
          />
          <span className="truncate text-[#121212]">{b.tenant}</span>
        </span>
        <span className="truncate text-[#3a3a44]">{b.villa}</span>
        <span className="truncate text-[#7a7a85]">{b.ownerName}</span>
        <span className="truncate text-[#3a3a44]">{b.dates}</span>
        <span className="text-[#3a3a44]">{b.guests}</span>
        <span className="flex items-center justify-between gap-2">
          <span
            className={`rounded-[3px] px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[b.status] ?? "bg-[#f1f0f6] text-[#5a5a66]"}`}
          >
            {STATUS_LABEL[b.status] ?? b.status}
          </span>
          {cancellable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
              }}
              className="shrink-0 text-[12px] text-[#eb5757] underline hover:opacity-80"
            >
              Cancel
            </button>
          )}
        </span>
      </div>

      {open && (
        <div className="border-t border-[#ececf0] bg-[#faf9fc] px-4 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Reference" value={`#${b.id}`} />
            <Stat label="Booked" value={b.bookedAt} />
            <Stat label="Nights" value={b.nights || "—"} />
            <Stat label="Rooms" value={b.rooms} />
            <Stat label="Guest email" value={b.guestEmail} />
            <Stat label="Customer ID" value={b.guestCustomerId || "—"} />
            <Stat label="Guest phone" value={b.guestPhone || "—"} />
            <Stat label="Property kind" value={b.kind} />
            <Stat
              label="Full stay"
              value={`$${b.money.fullStay.toFixed(2)}`}
            />
            <Stat
              label="Discount"
              value={
                b.money.hostDiscount > 0
                  ? `−$${b.money.hostDiscount.toFixed(2)}${b.couponCode ? ` (${b.couponCode})` : ""}`
                  : "—"
              }
            />
            <Stat
              label="Already paid"
              value={
                b.money.alreadyPaid > 0
                  ? `−$${b.money.alreadyPaid.toFixed(2)}`
                  : "—"
              }
            />
            <Stat
              label={b.paymentDue ? "Due" : "Paid"}
              value={`$${b.money.amount.toFixed(2)}`}
            />
          </div>

          {b.roomPlan.length > 0 && (
            <div className="mt-4 border-t border-[#ececf0] pt-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
                Rooms by night
              </p>
              <ul className="mt-2 max-w-[360px] space-y-1.5">
                {b.roomPlan.map((seg) => (
                  <li
                    key={seg.checkIn}
                    className="flex items-center justify-between gap-4 text-[13px]"
                  >
                    <span className="truncate text-[#3a3a44]">
                      {formatRange(seg.checkIn, seg.checkOut)}
                    </span>
                    <span className="shrink-0 font-semibold text-[#121212]">
                      {seg.rooms} room{seg.rooms === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {b.extras.length > 0 && (
            <p className="mt-3 text-[13px] text-[#3a3a44]">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
                Add-ons{" "}
              </span>
              {b.extras.map((e) => e.name).join(", ")}
            </p>
          )}
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setConfirming(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-[#121212]">
              Cancel this booking?
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              {b.tenant}&apos;s stay at {b.villa} ({b.dates}) will be cancelled.
              Both the guest and the host are notified that support did this.
            </p>
            {/* What it costs, in the guest's money — support called this off,
                not the guest, so it never keeps a cut the way the guest's own
                50% cancellation does. Which sum goes back depends
                on what they've actually handed over: a stay still awaiting
                payment has nothing to send back, and promising a "full refund"
                there would promise money that doesn't exist. */}
            <p className="mt-2 text-[14px] leading-[1.5] text-[#4a4a4a]">
              {!b.paymentDue ? (
                <>
                  {b.tenant} is refunded in{" "}
                  <span className="font-semibold text-[#1c7d5c]">full</span> —
                  the whole{" "}
                  <span className="font-semibold text-[#121212]">
                    ${b.money.amount.toFixed(2)}
                  </span>{" "}
                  paid goes back to their original payment method.
                </>
              ) : b.money.alreadyPaid > 0 ? (
                <>
                  {b.tenant} is refunded in{" "}
                  <span className="font-semibold text-[#1c7d5c]">full</span> —
                  the{" "}
                  <span className="font-semibold text-[#121212]">
                    ${b.money.alreadyPaid.toFixed(2)}
                  </span>{" "}
                  already paid goes back to their original payment method, and
                  the ${b.money.amount.toFixed(2)} still outstanding is dropped.
                </>
              ) : (
                <>
                  Nothing has been charged for this booking yet, so there is no
                  refund to make — the ${b.money.amount.toFixed(2)} payment
                  request is withdrawn.
                </>
              )}
            </p>
            <p className="mt-2 text-[13px] font-medium text-[#c0392b]">
              This can&apos;t be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/** Distinct `id → name` pairs across the loaded bookings, as dropdown options
 *  with an "all" entry first. Keyed by id, not by name: two accounts can share
 *  a display name, and picking one of them must not silently include the
 *  other. Built from ALL items so the choices don't vanish as filters narrow
 *  the list — a menu that empties itself is a menu you can't back out of. */
function facet(
  items: RequestItem[],
  idOf: (b: RequestItem) => number,
  nameOf: (b: RequestItem) => string,
  allLabel: string,
) {
  const byId = new Map<number, string>();
  for (const b of items) if (!byId.has(idOf(b))) byId.set(idOf(b), nameOf(b));
  return [
    { value: "all", label: allLabel },
    ...[...byId.entries()]
      .map(([id, name]) => ({ value: String(id), label: name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

export default function AdminBookings({
  items,
  focusBookingId = null,
  initialVillaId = null,
}: {
  items: RequestItem[];
  /** Show just this booking, expanded — set by ?booking=N, which is how the
   *  reviews list points at the stay a rating is about. */
  focusBookingId?: number | null;
  /** Land with the Property filter already on this listing — set by ?villa=N,
   *  how the admin property list sends someone to clear the stays blocking a
   *  deletion. Seeds the APPLIED filter too, not just the draft, so the list is
   *  narrowed on arrival rather than after a "Show results" click. */
  initialVillaId?: number | null;
}) {
  const initialProperty = initialVillaId ? String(initialVillaId) : "all";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [guest, setGuest] = useState("all");
  const [property, setProperty] = useState(initialProperty);
  const [owner, setOwner] = useState("all");
  const [headcount, setHeadcount] = useState("all");
  const [stayFrom, setStayFrom] = useState<string | null>(null);
  const [stayTo, setStayTo] = useState<string | null>(null);
  const [latestFirst, setLatestFirst] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const guestOptions = useMemo(
    () => facet(items, (b) => b.guestId, (b) => b.tenant, "All guests"),
    [items],
  );
  const propertyOptions = useMemo(
    () => facet(items, (b) => b.villaId, (b) => b.villa, "All properties"),
    [items],
  );
  const ownerOptions = useMemo(
    () => facet(items, (b) => b.ownerId, (b) => b.ownerName, "All owners"),
    [items],
  );
  const headcountOptions = useMemo(
    () => [
      { value: "all", label: "Any size" },
      ...[...new Set(items.map((b) => b.guestCount))]
        .sort((a, b) => a - b)
        .map((n) => ({
          value: String(n),
          label: `${n} guest${n === 1 ? "" : "s"}`,
        })),
    ],
    [items],
  );

  // A stay [checkIn, checkOut) is "in" the picked window when the two overlap
  // — the support question is "who was here then", which a containment test
  // would answer wrongly for the long stay that spans the whole window. Ends
  // are half-open to match every other date comparison in the app: a guest who
  // checks out on the 5th did not stay the night of the 5th.
  const inStayRange = (b: RequestItem) => {
    if (!applied.stayFrom && !applied.stayTo) return true;
    if (!b.checkIn || !b.checkOut) return false; // legacy row, no dates to test
    if (applied.stayFrom && b.checkOut <= applied.stayFrom) return false;
    if (applied.stayTo && b.checkIn > applied.stayTo) return false;
    return true;
  };

  /* The controls above are a DRAFT; these are the choices the list is
     actually showing. "Show results" copies one onto the other, so setting
     six filters reshuffles the rows once rather than six times. */
  const [applied, setApplied] = useState({
    status: "all",
    guest: "all",
    property: initialProperty,
    owner: "all",
    headcount: "all",
    stayFrom: null as string | null,
    stayTo: null as string | null,
  });

  const rows = items
    .filter((b) => (focusBookingId === null ? true : b.id === focusBookingId))
    .filter((b) => (applied.status === "all" ? true : b.status === applied.status))
    .filter((b) => (applied.guest === "all" ? true : String(b.guestId) === applied.guest))
    .filter((b) =>
      applied.property === "all" ? true : String(b.villaId) === applied.property,
    )
    .filter((b) => (applied.owner === "all" ? true : String(b.ownerId) === applied.owner))
    .filter((b) =>
      applied.headcount === "all" ? true : String(b.guestCount) === applied.headcount,
    )
    .filter(inStayRange)
    .filter((b) =>
      matchesSearch(query, b.tenant, b.villa, b.ownerName, b.dates, b.status),
    )
    .sort((a, b) =>
      latestFirst
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );


  // What the Filters button counts. The search box is excluded — it's
  // visible on the page, so it can't be a hidden narrowing.
  const activeFilters =
    (applied.status !== "all" ? 1 : 0) +
    (applied.guest !== "all" ? 1 : 0) +
    (applied.property !== "all" ? 1 : 0) +
    (applied.owner !== "all" ? 1 : 0) +
    (applied.headcount !== "all" ? 1 : 0) +
    (applied.stayFrom !== null || applied.stayTo !== null ? 1 : 0);

  function applyFilters() {
    setApplied({ status, guest, property, owner, headcount, stayFrom, stayTo });
  }
  function cancelFilters() {
    setStatus(applied.status);
    setGuest(applied.guest);
    setProperty(applied.property);
    setOwner(applied.owner);
    setHeadcount(applied.headcount);
    setStayFrom(applied.stayFrom);
    setStayTo(applied.stayTo);
  }

  const filtered =
    status !== "all" ||
    guest !== "all" ||
    property !== "all" ||
    owner !== "all" ||
    headcount !== "all" ||
    stayFrom !== null ||
    stayTo !== null ||
    query.trim() !== "";

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setGuest("all");
    setProperty("all");
    setOwner("all");
    setHeadcount("all");
    setStayFrom(null);
    setStayTo(null);
    setApplied({
      status: "all",
      guest: "all",
      property: "all",
      owner: "all",
      headcount: "all",
      stayFrom: null,
      stayTo: null,
    });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      {/* Search finds the booking you can already describe; the panel narrows
          the list to a slice you can then read. Both are needed — an admin
          often knows the WHEN and the WHERE but not the who. */}
      <AdminFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by guest, property, owner, dates or status"
        activeCount={activeFilters}
        onApply={applyFilters}
        onCancel={cancelFilters}
        onClear={clearFilters}
      >
        <FilterField label="Guest">
          <SearchDropdown
            value={guest}
            onChange={setGuest}
            options={guestOptions}
            ariaLabel="Filter by guest"
            searchPlaceholder="Search guests…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Property">
          <SearchDropdown
            value={property}
            onChange={setProperty}
            options={propertyOptions}
            ariaLabel="Filter by property"
            searchPlaceholder="Search properties…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Owner">
          <SearchDropdown
            value={owner}
            onChange={setOwner}
            options={ownerOptions}
            ariaLabel="Filter by owner"
            searchPlaceholder="Search owners…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Stay dates">
          <DateRangePicker
            from={stayFrom}
            to={stayTo}
            onChange={(from, to) => {
              setStayFrom(from);
              setStayTo(to);
            }}
            ariaLabel="Filter by stay dates"
            placeholder="Any stay dates"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Guests">
          <Dropdown
            value={headcount}
            onChange={setHeadcount}
            options={headcountOptions}
            ariaLabel="Filter by number of guests"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Status">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={FILTERS}
            ariaLabel="Filter by status"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
      </AdminFilterBar>

      {/* A range picked as two dates is easy to forget you set — say back what
          it means, in the same half-open language the rows use. */}
      {(applied.stayFrom || applied.stayTo) && (
        <p className="mt-2 text-[13px] text-[#7a7a85]">
          Showing stays that overlap{" "}
          {applied.stayFrom && applied.stayTo
            ? `${formatRangeKey(applied.stayFrom)} – ${formatRangeKey(applied.stayTo)}`
            : applied.stayFrom
              ? `${formatRangeKey(applied.stayFrom)} onwards`
              : `up to ${formatRangeKey(applied.stayTo!)}`}
          .
        </p>
      )}

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
          <span className="text-brand">{String(rows.length).padStart(2, "0")}</span>{" "}
          Bookings
          {filtered && (
            <span className="ml-2 font-normal text-[#7a7a85]">
              of {items.length}
            </span>
          )}
        </h2>
        <Dropdown
          value={latestFirst ? "latest" : "oldest"}
          onChange={(v) => setLatestFirst(v === "latest")}
          options={[
            { value: "latest", label: "Latest to Oldest" },
            { value: "oldest", label: "Oldest to Latest" },
          ]}
          ariaLabel="Sort bookings"
          buttonClassName={FILTER_BTN}
        />
      </div>

      <div
        className={`${GRID} mt-4 px-4 text-[11px] font-medium uppercase tracking-wide text-[#a1a1a2]`}
      >
        <span>Guest</span>
        <span>Property</span>
        <span>Owner</span>
        <span>Stay</span>
        <span>Guests</span>
        <span>Status</span>
      </div>

      {focusBookingId !== null && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-[8px] bg-[#e9e8fd] px-4 py-3 text-[14px] text-brand-dark">
          Showing booking #{focusBookingId} on its own.
          <Link
            href="/admin/bookings"
            className="font-semibold text-brand underline hover:opacity-80"
          >
            Show all bookings
          </Link>
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            {focusBookingId !== null
              ? `Booking #${focusBookingId} no longer exists.`
              : "No bookings match."}
            {filtered && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-brand underline hover:opacity-80"
                >
                  Clear filters
                </button>
              </>
            )}
          </li>
        ) : (
          rows.map((b) => (
            <Row
              key={b.id}
              b={b}
              defaultOpen={focusBookingId !== null}
              onCancelled={(text, ok) => setMessage({ ok, text })}
            />
          ))
        )}
      </ul>
    </div>
  );
}
