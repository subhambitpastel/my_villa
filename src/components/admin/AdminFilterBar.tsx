"use client";

import { useState } from "react";
import AccountSearch from "@/components/account/AccountSearch";

/** The pill every filter control inside the panel wears, so a row of them
 *  reads as one bank rather than unrelated widgets. */
export const FILTER_BTN =
  "flex w-full items-center justify-between rounded-[6px] border border-[#c9c9d4] bg-white px-3 py-2 text-[13px] text-[#121212] transition-colors hover:border-brand";

/** One labelled control in the filter panel. */
export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[13px] font-medium text-[#3a3a44]">{label}</p>
      {children}
    </div>
  );
}

function FunnelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5h18l-7 8v6l-4 2v-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Search plus a Filters button, and the panel behind it.
 *
 * The controls live in a popup rather than on the page: a bank of six
 * dropdowns reflows the list every time one is opened, and pushes the rows
 * — the thing being looked at — down the screen. Here the page never moves;
 * the button carries a count so the panel's state is legible while closed.
 *
 * Choices are STAGED: the list re-sorts and re-filters when "Show results" is
 * pressed, not as each control is touched. Setting four filters shouldn't
 * reshuffle the rows four times, and it makes the footer button mean what it
 * says. Closing any other way (×, backdrop, Escape) discards the draft.
 */
export default function AdminFilterBar({
  query,
  onQuery,
  placeholder,
  activeCount,
  onApply,
  onCancel,
  onClear,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** How many filters are narrowing the list right now (search excluded — it
   *  has its own visible box and applies as you type). */
  activeCount: number;
  /** Commit the staged choices — "Show results". */
  onApply: () => void;
  /** Throw the staged choices away and go back to what's on screen. */
  onCancel: () => void;
  onClear: () => void;
  /** The `FilterField`s for this section. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function apply() {
    onApply();
    setOpen(false);
  }
  function cancel() {
    onCancel();
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <AccountSearch value={query} onChange={onQuery} placeholder={placeholder} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-[46px] shrink-0 items-center gap-2 rounded-full border border-[#c9c9d4] bg-white px-5 text-[14px] font-medium text-[#121212] transition-colors hover:border-brand hover:text-brand"
        >
          <FunnelIcon />
          Filters
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
          onClick={(e) => e.target === e.currentTarget && cancel()}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
        >
          <div className="w-full max-w-[540px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold text-[#121212]">Filters</p>
              <button
                type="button"
                onClick={cancel}
                aria-label="Close filters"
                className="text-[20px] leading-none text-[#7a7a85] transition-colors hover:text-[#121212]"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#ececf0] pt-4">
              {/* Clearing is itself a result worth seeing, so it applies and
                  closes rather than leaving an empty panel open. */}
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                disabled={activeCount === 0}
                className="text-[14px] text-brand underline hover:opacity-80 disabled:cursor-not-allowed disabled:text-[#a1a1a2] disabled:no-underline"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
