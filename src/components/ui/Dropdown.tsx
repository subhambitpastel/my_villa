"use client";

import { useEffect, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string };

/**
 * A theme-styled single-select dropdown — a replacement for a bare native
 * `<select>` so the open menu matches the app instead of the OS chrome. Fully
 * keyboard accessible (Arrow keys / Enter / Escape), closes on outside-click,
 * and is driven by `value`/`onChange` (no FormData coupling).
 */
export default function Dropdown({
  value,
  onChange,
  options,
  ariaLabel,
  buttonClassName = "",
  menuClassName = "",
  align = "left",
  formatLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel: string;
  /** Styling for the closed trigger button. */
  buttonClassName?: string;
  /** Extra styling for the popover menu. */
  menuClassName?: string;
  align?: "left" | "right";
  /** Custom label for the closed trigger (e.g. `Sort: ${o.label}`). */
  formatLabel?: (opt: DropdownOption) => string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active].value); }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={buttonClassName}
      >
        <span className="truncate">
          {selected ? (formatLabel ? formatLabel(selected) : selected.label) : ""}
        </span>
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
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-50 mt-2 max-h-[280px] min-w-full overflow-auto rounded-[10px] border border-[#e3e3e8] bg-white py-1.5 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.16)] ${
            align === "right" ? "right-0" : "left-0"
          } ${menuClassName}`}
        >
          {options.map((o, i) => {
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
        </ul>
      )}
    </div>
  );
}
