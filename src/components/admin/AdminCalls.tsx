"use client";

import { useState } from "react";
import AdminFilterBar, {
  FilterField,
  FILTER_BTN,
} from "@/components/admin/AdminFilterBar";
import Dropdown from "@/components/ui/Dropdown";
import SearchDropdown from "@/components/ui/SearchDropdown";
import { matchesSearch } from "@/lib/textSearch";
import { formatRange } from "@/lib/dates";
import type { AdminCallItem } from "@/lib/adminQueries";

const STATUS = [
  { value: "all", label: "All requests" },
  { value: "open", label: "Open" },
  { value: "done", label: "Dealt with" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[13px] text-[#121212]">{value}</p>
    </div>
  );
}

export default function AdminCalls({ items }: { items: AdminCallItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [villa, setVilla] = useState("all");
  const [owner, setOwner] = useState("all");

  const villas = [...new Set(items.map((c) => c.villaName))]
    .sort()
    .map((n) => ({ value: n, label: n }));
  const owners = [...new Set(items.map((c) => c.ownerName))]
    .sort()
    .map((n) => ({ value: n, label: n }));

  /* Draft above, what the list is showing below — see AdminFilterBar. */
  const [applied, setApplied] = useState({
    status: "all",
    villa: "all",
    owner: "all",
  });

  const rows = items
    .filter((c) => (applied.status === "all" ? true : c.status === applied.status))
    .filter((c) => (applied.villa === "all" ? true : c.villaName === applied.villa))
    .filter((c) => (applied.owner === "all" ? true : c.ownerName === applied.owner))
    .filter((c) =>
      matchesSearch(query, c.guestName, c.guestEmail, c.villaName, c.ownerName, c.status),
    );


  const activeFilters =
    (applied.status !== "all" ? 1 : 0) +
    (applied.villa !== "all" ? 1 : 0) +
    (applied.owner !== "all" ? 1 : 0);

  function applyFilters() {
    setApplied({ status, villa, owner });
  }
  function cancelFilters() {
    setStatus(applied.status);
    setVilla(applied.villa);
    setOwner(applied.owner);
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setVilla("all");
    setOwner("all");
    setApplied({ status: "all", villa: "all", owner: "all" });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <AdminFilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Search by guest, property, owner or status"
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
        <FilterField label="Status">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={STATUS}
            ariaLabel="Filter by status"
            buttonClassName={FILTER_BTN}
          />
        </FilterField>
      </AdminFilterBar>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">
            {String(rows.length).padStart(2, "0")}
          </span>{" "}
          Call requests
        </h2>
      </div>

      <ul className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <li className="rounded-[6px] border border-[#dfdfdf] px-4 py-4 text-center text-[13px] text-[#a1a1a2]">
            No call requests yet.
          </li>
        ) : (
          rows.map((c) => {
            const open = c.status === "open";
            return (
              <li
                key={c.id}
                className={`rounded-[8px] border p-4 ${
                  open
                    ? "border-[#e8d5a3] bg-[#fdf9f0]"
                    : "border-[#dfdfdf] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-[#121212]">
                    {c.guestName} · {c.villaName}
                  </p>
                  <span
                    className={`rounded-[3px] px-2 py-0.5 text-[11px] font-semibold ${
                      open
                        ? "bg-[#fff3d6] text-[#a06a00]"
                        : "bg-[#e5f4ee] text-[#1c7d5c]"
                    }`}
                  >
                    {open ? "Open" : "Done"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field
                    label="Stay"
                    value={
                      c.checkIn && c.checkOut
                        ? formatRange(c.checkIn, c.checkOut)
                        : "No dates given"
                    }
                  />
                  <Field label="Rooms" value={c.rooms || "—"} />
                  <Field label="Guests" value={c.guests || "—"} />
                  <Field label="Asked" value={c.requested} />
                  <Field label="Owner" value={c.ownerName} />
                  <Field label="Guest email" value={c.guestEmail} />
                  <Field label="Guest phone" value={c.guestPhone || "—"} />
                  <Field
                    label="Add-ons"
                    value={
                      c.services.length > 0
                        ? c.services.map((s) => s.name).join(", ")
                        : "—"
                    }
                  />
                </div>
                {c.message && (
                  <p className="mt-3 border-t border-[#e8d5a3]/60 pt-3 text-[13px] leading-[1.5] text-[#3a3a44]">
                    &ldquo;{c.message}&rdquo;
                  </p>
                )}
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-4 text-[12px] text-[#9a9aa5]">
        The guest–host chat on a request stays between them; a request that has
        been resolved keeps no transcript.
      </p>
    </div>
  );
}
