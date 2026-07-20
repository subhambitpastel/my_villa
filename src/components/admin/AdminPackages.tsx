"use client";

import { useState } from "react";
import AdminFilterBar, {
  FilterField,
  FILTER_BTN,
} from "@/components/admin/AdminFilterBar";
import Dropdown from "@/components/ui/Dropdown";
import SearchDropdown from "@/components/ui/SearchDropdown";
import { matchesSearch } from "@/lib/textSearch";
import type { PackageItem } from "@/lib/queries";

type Item = PackageItem & { ownerName: string };

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
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
