import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getAdminStats, getRecentActivity } from "@/lib/adminQueries";

export const metadata: Metadata = {
  title: "Admin · Overview",
  description: "Platform-wide totals and recent activity.",
};

const CARD = "rounded-lg border border-line/60 bg-white p-6 sm:p-8";

function Tile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none text-[#121212]">
        {value}
      </p>
      <p className="mt-1 min-h-[18px] text-[12px] text-[#7a7a85]">{hint ?? ""}</p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-[8px] border border-[#dfdfdf] p-4 transition-colors hover:border-brand hover:bg-[#faf9ff]"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-[8px] border border-[#dfdfdf] p-4">{body}</div>
  );
}

// Colour per activity kind — reinforces the wording, never the sole signal.
const DOT: Record<string, string> = {
  booking: "bg-brand",
  review: "bg-[#3dc0a4]",
  call: "bg-[#a06a00]",
  signup: "bg-[#7b61ff]",
};

export default async function AdminOverviewPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;

  const [stats, activity] = await Promise.all([
    getAdminStats(),
    getRecentActivity(),
  ]);
  const s = stats.bookingsByStatus;

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <h2 className="text-[16px] font-semibold text-[#121212]">
          Platform overview
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile
            label="Users"
            value={stats.users}
            hint={`${stats.hosts} hosts · ${stats.disabledUsers} disabled`}
            href="/admin/users"
          />
          <Tile
            label="Properties"
            value={stats.villas}
            hint={`${stats.lockedVillas} locked`}
            href="/admin/properties"
          />
          <Tile
            label="Bookings"
            value={stats.bookings}
            hint={`${s.accepted} confirmed · ${s.pending} pending`}
            href="/admin/bookings"
          />
          <Tile
            label="Revenue"
            value={`$${stats.revenue.toFixed(2)}`}
            hint="settled stays"
          />
          <Tile
            label="Call requests"
            value={stats.openCalls}
            hint="open"
            href="/admin/calls"
          />
          <Tile
            label="Packages"
            value={stats.packages}
            href="/admin/packages"
          />
          <Tile label="Coupons" value={stats.coupons} href="/admin/coupons" />
          <Tile label="Reviews" value={stats.reviews} href="/admin/reviews" />
        </div>
        <p className="mt-4 text-[12px] leading-[1.5] text-[#9a9aa5]">
          Revenue totals what settled stays (confirmed or completed, nothing
          owed) actually charged — the same receipt figure guests and hosts
          see, recomputed from each stay&apos;s own room plan and rate.
        </p>
      </section>

      <section className={CARD}>
        <h2 className="text-[16px] font-semibold text-[#121212]">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#a1a1a2]">Nothing yet.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {activity.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                <Link
                  href={a.href}
                  className="flex items-start justify-between gap-4 rounded-[6px] border border-[#dfdfdf] px-4 py-3 transition-colors hover:border-brand hover:bg-[#faf9ff]"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden
                      className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${DOT[a.kind] ?? "bg-[#a1a1a2]"}`}
                    />
                    <span className="min-w-0 text-[14px] text-[#121212]">
                      {a.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-[#9a9aa5]">
                    {a.when}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
