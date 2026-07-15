"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Avatar from "@/components/ui/Avatar";
import { searchGuestsAction } from "@/lib/actions";
import { GUEST_SEARCH_MIN, type GuestOption } from "@/lib/guests";

/**
 * Type-to-search picker for the person a booking is for. The list comes from the
 * server on each query rather than being shipped to the client up front — the
 * whole user base isn't the owner's to hold, and it wouldn't scale anyway.
 */
export default function GuestPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: GuestOption | null;
  onChange: (guest: GuestOption | null) => void;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GuestOption[]>([]);
  const [searching, startSearch] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  // Only the newest query may write results — a slow earlier search must never
  // land on top of a later one.
  const queryId = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Debounced so typing a name isn't one request per keystroke. Too-short terms
  // simply don't search; what's on screen is derived below rather than cleared
  // from in here, so there's no state write on every keystroke.
  useEffect(() => {
    const term = query.trim();
    if (term.length < GUEST_SEARCH_MIN) return;
    const id = ++queryId.current;
    const t = setTimeout(() => {
      startSearch(async () => {
        const found = await searchGuestsAction(term);
        if (id === queryId.current) setResults(found);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function pick(g: GuestOption) {
    onChange(g);
    setOpen(false);
    setQuery("");
  }

  const term = query.trim();
  // Results only belong to a term long enough to have searched for them —
  // otherwise the previous term's matches would linger after a backspace.
  const shown = term.length >= GUEST_SEARCH_MIN ? results : [];

  return (
    <div ref={ref} className="relative">
      {value ? (
        // Chosen: show who it's for, with a way back to searching.
        <div
          className={`flex items-center gap-3 rounded-[10px] border-[1.5px] p-[13px] ${
            invalid ? "border-[#eb5757]" : "border-[#ddd]"
          }`}
        >
          <Avatar
            src={value.avatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium text-[#121212]">
              {value.name || value.email}
            </span>
            <span className="block truncate text-[13px] text-[#8a8a94]">
              {value.email}
            </span>
            {/* The identifier the guest would quote — worth showing on the
                chosen guest so the owner can confirm it's the right person. */}
            {value.customerId && (
              <span className="mt-0.5 block truncate font-mono text-[12px] text-[#a8a8b0]">
                {value.customerId}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(true);
            }}
            className="shrink-0 text-[13px] font-medium text-brand underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, email or customer ID"
            aria-label="Search for the guest this booking is for, by name, email or customer ID"
            aria-invalid={invalid}
            aria-expanded={open}
            role="combobox"
            aria-controls="guest-picker-list"
            className={`block w-full rounded-[10px] border-[1.5px] px-4 py-3 text-[16px] text-[#121212] placeholder:text-[#9d9da6] focus:outline-none focus:ring-2 focus:ring-brand/20 ${
              invalid ? "border-[#eb5757]" : "border-[#ddd] focus:border-brand"
            }`}
          />
          {open && (
            <ul
              id="guest-picker-list"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[260px] overflow-y-auto rounded-[10px] border border-line/60 bg-white p-1.5 shadow-[0px_12px_40px_0px_rgba(0,0,0,0.15)]"
            >
              {term.length < GUEST_SEARCH_MIN ? (
                <li className="px-3 py-2.5 text-[14px] text-[#8a8a94]">
                  Type at least {GUEST_SEARCH_MIN} characters — name, email or
                  customer ID.
                </li>
              ) : searching ? (
                <li className="px-3 py-2.5 text-[14px] text-[#8a8a94]">
                  Searching…
                </li>
              ) : shown.length === 0 ? (
                <li className="px-3 py-2.5 text-[14px] text-[#8a8a94]">
                  No guest matches &ldquo;{term}&rdquo;.
                </li>
              ) : (
                shown.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pick(g)}
                      className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left transition-colors hover:bg-brand/5"
                    >
                      <Avatar
                        src={g.avatar}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {g.name || g.email}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {g.email}
                        </span>
                        {g.customerId && (
                          <span className="block truncate font-mono text-[11px] text-[#a8a8b0]">
                            {g.customerId}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
