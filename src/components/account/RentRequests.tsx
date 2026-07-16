"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ownerCancelBookingAction } from "@/lib/actions";
import Dropdown from "@/components/ui/Dropdown";
import { bookingReference } from "@/lib/pricing";
import { formatRange } from "@/lib/dates";
import type { RequestItem } from "@/lib/queries";

const GRID = "grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.8fr] items-center gap-2";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  // A stay you arranged that the guest hasn't paid for. It holds no rooms and
  // isn't confirmed until they do — so it must never read as "Confirmed".
  pending: "Payment pending",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** Never guess "Confirmed" for an unknown status — that's how a pending,
 *  room-holding-nothing booking came to read as confirmed. */
const statusLabel = (status: string) => STATUS_LABEL[status] ?? status;

/** Chevron that points down, rotating up when the row is expanded. */
function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="7"
      viewBox="0 0 9 6"
      fill="none"
      aria-hidden="true"
      className={`mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l3.5 3.5L8 1" stroke="#4a4a4a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[15px] font-semibold ${
          accent ? "text-brand" : "text-[#121212]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Everything about a booking the collapsed row has no room for. Deliberately
 *  the host's view of it: what it's worth, how to reach the guest, and what
 *  they're actually getting — none of which the tenant/dates/guests line says. */
function RequestDetails({ r }: { r: RequestItem }) {
  const money = r.money;
  const showReceipt = money.hostDiscount > 0 || money.alreadyPaid > 0;
  return (
    <div className="border-t border-[#ececf0] bg-[#faf9fc] px-4 py-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {/* The same figure the guest sees — paid, or owed while it's due. */}
        <Stat
          label={r.paymentDue ? "Amount due" : "Amount paid"}
          value={`$${r.amount.toFixed(2)}`}
          accent
        />
        <Stat label="Reference" value={bookingReference(r.id)} />
        {r.nights > 0 && (
          <Stat
            label="Stay length"
            value={`${r.nights} night${r.nights === 1 ? "" : "s"}`}
          />
        )}
        <Stat label="Rooms" value={`${r.rooms} room${r.rooms === 1 ? "" : "s"}`} />
        <Stat label="Booked" value={r.bookedAt} />
      </div>

      {/* An amount that isn't the list price needs its arithmetic shown, or the
          host can't answer "why this number?" when the guest asks. */}
      {showReceipt && (
        <p className="mt-3 text-[12.5px] leading-[1.7] text-[#6a6a72]">
          Full stay{" "}
          <span className="font-semibold text-[#121212]">
            ${money.fullStay.toFixed(2)}
          </span>
          {money.hostDiscount > 0 && (
            <>
              {" "}
              − {r.couponCode ? `coupon ${r.couponCode}` : "your discount"}{" "}
              <span className="font-semibold text-brand">
                ${money.hostDiscount.toFixed(2)}
              </span>
            </>
          )}
          {money.alreadyPaid > 0 && (
            <>
              {" "}
              − already paid{" "}
              <span className="font-semibold text-[#1c7d5c]">
                ${money.alreadyPaid.toFixed(2)}
              </span>
            </>
          )}{" "}
          ={" "}
          <span className="font-semibold text-[#121212]">
            ${r.amount.toFixed(2)} {r.paymentDue ? "due" : "paid"}
          </span>
        </p>
      )}

      {/* A stay whose room count changes mid-way — spell out the legs, since
          "5 rooms" above is only its peak. */}
      {r.roomPlan.length > 1 && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Rooms night by night
          </p>
          <ul className="mt-2 max-w-[360px] space-y-1.5">
            {r.roomPlan.map((seg) => (
              <li
                key={seg.checkIn}
                className="flex items-center justify-between gap-4 text-[13px]"
              >
                <span className="text-[#3a3a44]">
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

      {r.extras.length > 0 && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Paid add-ons
          </p>
          <ul className="mt-2 max-w-[360px] space-y-1.5">
            {r.extras.map((e) => (
              <li
                key={e.name}
                className="flex items-center justify-between gap-4 text-[13px]"
              >
                <span className="truncate text-[#3a3a44]">{e.name}</span>
                <span className="shrink-0 font-semibold text-[#121212]">
                  ${e.price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.package && (
        <div className="mt-4 border-t border-[#ececf0] pt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
            Package includes
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#3a3a44]">
            {r.package.inclusions.map((inc) => (
              <li key={inc} className="flex items-center gap-1.5">
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-brand" />
                {inc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The host's reason to open this panel at all is often just "how do I
          reach them?" — so the contact details are here, not a tab away. */}
      <div className="mt-4 border-t border-[#ececf0] pt-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
          Guest
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#3a3a44]">
          <a href={`mailto:${r.guestEmail}`} className="underline hover:opacity-80">
            {r.guestEmail}
          </a>
          {r.guestPhone ? (
            <a
              href={`tel:${r.guestPhone.replace(/\s+/g, "")}`}
              className="underline hover:opacity-80"
            >
              {r.guestPhone}
            </a>
          ) : (
            <span className="text-[#a1a1a2]">No phone</span>
          )}
          {r.guestCustomerId && (
            <span className="font-mono text-[12px] text-[#a1a1a2]">
              {r.guestCustomerId}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** A bookings row that expands on click to reveal the whole booking.
 *  `children` is the right-hand status/action cell — passed in because the
 *  cancel button lives there and must not toggle the row. */
function RequestRow({
  r,
  children,
}: {
  r: RequestItem;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-[6px] border border-[#dfdfdf] bg-white">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`${GRID} cursor-pointer px-4 py-3 text-[13px] text-[#121212] transition-colors hover:bg-[#faf9ff]`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ExpandIcon open={open} />
          <Image
            src={r.avatar}
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
          />
          <span className="min-w-0 truncate">{r.tenant}</span>
        </span>
        <span className="min-w-0 truncate">{r.villa}</span>
        <span title={`Booked on ${r.bookedAt}`}>{r.dates}</span>
        <span>{r.guests}</span>
        {/* Cancelling shouldn't toggle the row open on the way past. */}
        <span
          className="flex flex-col items-end gap-1.5 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </span>
      </div>
      {open && <RequestDetails r={r} />}
    </li>
  );
}

/** A package-booking row that expands to the SAME details panel villa rows
 *  get — receipt, rooms reserved, guest contact — plus the bundle's contents.
 *  The header keeps the package layout; only the chevron and the click are new. */
function PackageRequestRow({
  r,
  children,
}: {
  r: RequestItem;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-[6px] border border-[#dfdfdf] bg-white">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#faf9ff]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ExpandIcon open={open} />
          <Image
            src={r.avatar}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-heading">
              {r.package!.name}
            </p>
            <p className="text-[12px] text-gray">
              {r.tenant} · {r.villa}
            </p>
            <p className="mt-0.5 text-[12px] text-[#a1a1a2]">
              {r.package!.nights} night{r.package!.nights === 1 ? "" : "s"} ·{" "}
              {r.dates} · {r.guests} ·{" "}
              <span className="font-medium text-brand">
                {r.rooms} room{r.rooms === 1 ? "" : "s"} reserved
              </span>
            </p>
          </div>
        </div>
        {/* Cancelling mustn't toggle the row open on the way past. */}
        <div
          className="flex shrink-0 flex-col items-end gap-1.5 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
      {open && <RequestDetails r={r} />}
    </li>
  );
}

export default function RentRequests({ requests }: { requests: RequestItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [latestFirst, setLatestFirst] = useState(true);
  const [cancelling, setCancelling] = useState<RequestItem | null>(null);

  function confirmCancel() {
    if (!cancelling) return;
    const id = cancelling.id;
    startTransition(async () => {
      await ownerCancelBookingAction(id);
      setCancelling(null);
      router.refresh();
    });
  }

  const sorted = [...requests].sort((a, b) =>
    latestFirst
      ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
  // Package bookings get their own section so room usage per package is clear.
  const villaReqs = sorted.filter((r) => !r.package);
  const pkgReqs = sorted.filter((r) => r.package);
  const confirmed = requests.filter((r) => r.status === "accepted").length;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">{confirmed}</span> Confirmed Bookings
        </h2>
        <Dropdown
          ariaLabel="Sort requests"
          value={latestFirst ? "latest" : "oldest"}
          onChange={(v) => setLatestFirst(v === "latest")}
          options={[
            { value: "latest", label: "Sort: Latest to Oldest" },
            { value: "oldest", label: "Sort: Oldest to Latest" },
          ]}
          align="right"
          buttonClassName="flex items-center rounded-[4px] border border-[#c6c6c6] px-2 py-1.5 text-[11px] text-[#121212]"
        />
      </div>

      <div className={`${GRID} mt-6 px-4 text-[13px] text-[#a1a1a2]`}>
        <span>Tenant</span>
        <span>Property</span>
        <span>Stay Duration</span>
        <span>No. of Guests</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="mt-3 space-y-3">
        {villaReqs.map((r) => (
          <RequestRow key={r.id} r={r}>
              <span
                className={`text-[13px] font-semibold ${
                  r.status === "declined" || r.status === "cancelled"
                    ? "text-[#eb5757]"
                    : r.status === "pending"
                      ? "text-[#a06a00]"
                      : "text-brand"
                }`}
              >
                {statusLabel(r.status)}
              </span>
              {/* Money is still outstanding — "Confirmed" alone would read as
                  settled. Pending holds nothing; an upgraded stay holds its
                  rooms while the guest owes the difference. */}
              {r.paymentDue &&
                (r.status === "accepted" || r.status === "pending") && (
                  <span className="rounded-[3px] bg-[#fff3d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#a06a00]">
                    {r.status === "pending"
                      ? "Awaiting payment · holds no rooms"
                      : "Upgrade balance due from guest"}
                  </span>
                )}
              {(r.status === "accepted" || r.status === "pending") && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setCancelling(r)}
                  className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              )}
          </RequestRow>
        ))}
        {villaReqs.length === 0 && (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No villa bookings yet.
          </li>
        )}
      </ul>

      {pkgReqs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#121212]">
            Package bookings
          </h2>
          <p className="mt-1 text-[12px] text-[#a1a1a2]">
            Fixed all-inclusive packages guests booked — with the rooms each
            reserved on your property.
          </p>
          <ul className="mt-4 space-y-3">
            {pkgReqs.map((r) => (
              <PackageRequestRow key={r.id} r={r}>
                <span className="text-[14px] font-semibold text-brand">
                  ${r.package!.price.toFixed(2)}
                </span>
                <span
                  className={`text-[13px] font-semibold ${
                    r.status === "declined" || r.status === "cancelled"
                      ? "text-[#eb5757]"
                      : r.status === "pending"
                        ? "text-[#a06a00]"
                        : "text-brand"
                  }`}
                >
                  {statusLabel(r.status)}
                </span>
                {r.paymentDue &&
                  (r.status === "accepted" || r.status === "pending") && (
                    <span className="rounded-[3px] bg-[#fff3d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#a06a00]">
                      {r.status === "pending"
                        ? "Awaiting payment · holds no rooms"
                        : "Upgrade balance due from guest"}
                    </span>
                  )}
                {(r.status === "accepted" || r.status === "pending") && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setCancelling(r)}
                    className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:opacity-50"
                  >
                    Cancel Booking
                  </button>
                )}
              </PackageRequestRow>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-[#121212]">
        Guests pay in full at checkout, so their stay is confirmed
        automatically — no approval needed. The booked dates are blocked for
        other guests right away.
      </p>

      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel this booking"
          onClick={(e) => e.target === e.currentTarget && !pending && setCancelling(null)}
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <h3 className="text-[18px] font-semibold text-[#121212]">
              Cancel this booking?
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
              If you cancel {cancelling.tenant}&rsquo;s booking of{" "}
              <span className="font-medium">{cancelling.villa}</span> (
              {cancelling.dates}), you will need to give a{" "}
              <span className="font-semibold text-[#eb5757]">100% refund</span>{" "}
              of the amount paid.
            </p>
            <p className="mt-3 text-[14px] font-medium text-[#121212]">
              Are you sure you want to cancel the booking?
            </p>
            <div className="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setCancelling(null)}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmCancel}
                className="rounded-[8px] bg-[#eb5757] px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d64545] disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Yes, cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
