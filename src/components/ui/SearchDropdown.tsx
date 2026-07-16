"use client";

import { useEffect, useRef, useState } from "react";

export type SearchDropdownOption = { value: string; label: string };

/**
 * A theme-styled single-select dropdown with a filter box in the popover —
 * for lists long enough that scanning beats scrolling (an owner's properties,
 * say). Same interaction contract as `Dropdown`: keyboard arrows/Enter/Escape,
 * outside-click close, `value`/`onChange` driven. Typing filters by substring,
 * case-insensitively; the arrows walk the FILTERED list.
 */
export default function SearchDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  buttonClassName = "",
  searchPlaceholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchDropdownOption[];
  ariaLabel: string;
  buttonClassName?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // The filter box is the whole point — focus it as the menu opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openMenu = () => {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active].value);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={buttonClassName}
      >
        <span className="truncate">{selected ? selected.label : ""}</span>
        <svg
          width="11"
          height="7"
          viewBox="0 0 9 6"
          fill="none"
          aria-hidden="true"
          className={`ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 min-w-full rounded-[10px] border border-[#e3e3e8] bg-white shadow-[0px_12px_32px_0px_rgba(0,0,0,0.16)]">
          <div className="border-b border-[#ececf0] p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={`${ariaLabel} — search`}
              className="w-full rounded-[6px] border border-[#e3e3e8] px-2.5 py-1.5 text-[13px] text-[#121212] placeholder:text-[#9d9da6] focus:border-brand focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-label={ariaLabel} className="max-h-[240px] overflow-auto py-1.5">
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                  className={`cursor-pointer whitespace-nowrap px-4 py-2 text-[14px] leading-[1.3] transition-colors ${
                    isSel ? "font-semibold text-brand" : "text-[#121212]"
                  } ${i === active ? "bg-brand/10" : "hover:bg-brand/5"}`}
                >
                  {o.label}
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-[#a1a1a2]">
                Nothing matches &ldquo;{query}&rdquo;
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
