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
import SearchDropdown from "@/components/ui/SearchDropdown";
import { matchesSearch } from "@/lib/textSearch";
import { adminSetReviewStatusAction } from "@/lib/adminActions";
import type { AdminReviewItem } from "@/lib/adminQueries";

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-[#fff3d6] text-[#a06a00]",
  approved: "bg-[#e5f4ee] text-[#1c7d5c]",
  rejected: "bg-[#fdecec] text-[#eb5757]",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting review",
  approved: "Published",
  rejected: "Not published",
};

const STARS = [
  { value: "all", label: "Any rating" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

const FILTERS = [
  { value: "pending", label: "Awaiting review" },
  { value: "all", label: "All reviews" },
  { value: "approved", label: "Published" },
  { value: "rejected", label: "Not published" },
];

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`text-[14px] ${i <= n ? "text-brand" : "text-[#d9d9de]"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function AdminReviews({
  items,
  initialPerson = "",
}: {
  items: AdminReviewItem[];
  /** Preselected person filter, e.g. "author:4" or "owner:2" — how the Users
   *  page links a review count straight to the ratings behind it. */
  initialPerson?: string;
}) {
  const [query, setQuery] = useState("");
  // Arriving from a Users-page count means the interesting rows may be of any
  // status, so that link opens on "all"; otherwise the queue is the view with
  // something to DO.
  const [status, setStatus] = useState(initialPerson ? "all" : "pending");
  /* "" = everyone. Otherwise "author:<id>" (ratings this person WROTE) or
     "owner:<id>" (ratings this person's properties RECEIVED) — one control,
     because "this user's ratings" means a different set for a guest than for
     a host, and the label says which. */
  const [person, setPerson] = useState(initialPerson);
  const [stars, setStars] = useState("all");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Everyone who appears in a review, each as the role they appear in.
  const people: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const r of items) {
    const wrote = `author:${r.authorId}`;
    if (!seen.has(wrote)) {
      seen.add(wrote);
      people.push({ value: wrote, label: `${r.authorName} — ratings written` });
    }
    const got = `owner:${r.ownerId}`;
    if (!seen.has(got)) {
      seen.add(got);
      people.push({ value: got, label: `${r.ownerName} — ratings received` });
    }
  }
  people.sort((a, b) => a.label.localeCompare(b.label));
  const personOptions = [{ value: "", label: "All users" }, ...people];

  /* The controls are a DRAFT; these are the choices the list is actually
     showing — "Show results" copies one onto the other. The status a link
     from the Users page arrives on is the baseline, not a filter the admin
     set, so it does not count as active. */
  const baseStatus = initialPerson ? "all" : "pending";
  const [applied, setApplied] = useState({
    person: initialPerson,
    stars: "all",
    status: baseStatus,
  });

  const rows = items
    .filter((r) => (applied.status === "all" ? true : r.status === applied.status))
    .filter((r) => {
      if (!applied.person) return true;
      const [role, rawId] = applied.person.split(":");
      const id = Number(rawId);
      return role === "author" ? r.authorId === id : r.ownerId === id;
    })
    .filter((r) => (applied.stars === "all" ? true : r.stars === Number(applied.stars)))
    .filter((r) =>
      matchesSearch(query, r.authorName, r.villaName, r.ownerName, r.comment),
    );

  const activeFilters =
    (applied.person !== "" ? 1 : 0) +
    (applied.stars !== "all" ? 1 : 0) +
    (applied.status !== baseStatus ? 1 : 0);

  function applyFilters() {
    setApplied({ person, stars, status });
  }
  function cancelFilters() {
    setPerson(applied.person);
    setStars(applied.stars);
    setStatus(applied.status);
  }

  function clearFilters() {
    setQuery("");
    setPerson("");
    setStars("all");
    setStatus(baseStatus);
    setApplied({ person: "", stars: "all", status: baseStatus });
  }
  /* Both read the FILTERED rows, not the whole table: next to a heading that
     counts what's on screen, a total counted from everything contradicts it —
     "03 Reviews · 2 awaiting review" has to mean two of those three. Filtering
     to one host then tells you how much of their work is waiting, and what
     their published stays actually average. */
  const waiting = rows.filter((r) => r.status === "pending").length;
  const published = rows.filter((r) => r.status === "approved");
  const average =
    published.length > 0
      ? published.reduce((s, r) => s + r.stars, 0) / published.length
      : 0;

  function decide(r: AdminReviewItem, next: "approved" | "rejected") {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await adminSetReviewStatusAction(r.id, next);
      setBusyId(null);
      setMessage({
        ok: res.ok,
        text: res.ok
          ? `${r.authorName}'s review ${next === "approved" ? "published" : "rejected"}.`
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
        placeholder="Search by guest, property, owner or comment"
        activeCount={activeFilters}
        onApply={applyFilters}
        onCancel={cancelFilters}
        onClear={clearFilters}
      >
        <FilterField label="User">
          <SearchDropdown
            value={person}
            onChange={setPerson}
            options={personOptions}
            ariaLabel="Filter reviews by user"
            searchPlaceholder="Search users…"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Star rating">
          <Dropdown
            value={stars}
            onChange={setStars}
            options={STARS}
            ariaLabel="Filter by star rating"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
        <FilterField label="Moderation status">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={FILTERS}
            ariaLabel="Filter reviews by status"
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
          Reviews
          {waiting > 0 && (
            <span className="ml-2 rounded-full bg-[#fff3d6] px-2 py-0.5 text-[11px] font-semibold text-[#a06a00]">
              {waiting} awaiting review
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {published.length > 0 && (
            <p className="text-[13px] text-[#7a7a85]">
              Published average{" "}
              <span className="font-semibold text-[#121212]">
                {average.toFixed(2)}★
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-[1.5] text-[#9a9aa5]">
        A review is invisible to guests and counts for nothing in a
        property&apos;s rating until it&apos;s published here. Its author may
        rewrite it for 24 hours after posting — an edit sends it back to this
        queue.
      </p>

      <ul className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            {status === "pending"
              ? "Nothing waiting — the queue is clear."
              : "No reviews match."}
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-[6px] border px-4 py-3 ${
                r.status === "pending"
                  ? "border-[#e8d5a3] bg-[#fdf9f0]"
                  : "border-[#dfdfdf]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Image
                    src={r.authorAvatar}
                    alt=""
                    width={26}
                    height={26}
                    className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
                  />
                  <span className="truncate text-[13px] font-semibold text-[#121212]">
                    {r.authorName}
                  </span>
                  <Stars n={r.stars} />
                  <span
                    className={`rounded-[3px] px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.editable && (
                    <span className="rounded-[3px] bg-[#f1f0f6] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5a66]">
                      author can still edit
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-[#9a9aa5]">{r.when}</span>
              </div>

              <p className="mt-1 text-[13px] text-[#7a7a85]">
                {r.villaName} · {r.ownerName} ·{" "}
                {/* A rating only means something next to the stay it rates —
                    who stayed, when, what they paid. */}
                <Link
                  href={`/admin/bookings?booking=${r.bookingId}`}
                  className="text-brand underline-offset-2 hover:underline"
                  title="Open the booking this review is about"
                >
                  booking #{r.bookingId}
                </Link>
              </p>
              {r.comment ? (
                <p className="mt-2 text-[13px] leading-[1.5] text-[#3a3a44]">
                  {r.comment}
                </p>
              ) : (
                <p className="mt-2 text-[13px] italic text-[#a1a1a2]">
                  Rating only — no comment left.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#ececf0] pt-3">
                {r.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => decide(r, "approved")}
                    disabled={pending && busyId === r.id}
                    className="rounded-[8px] bg-brand px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
                  >
                    {pending && busyId === r.id ? "Saving…" : "Publish"}
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => decide(r, "rejected")}
                    disabled={pending && busyId === r.id}
                    className="text-[13px] text-[#eb5757] underline hover:opacity-80 disabled:opacity-60"
                  >
                    {r.status === "approved" ? "Unpublish" : "Reject"}
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
