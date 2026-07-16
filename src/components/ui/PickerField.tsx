"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

export type PickerOption = {
  value: number;
  label: string;
  /** Lighter suffix after the label (e.g. "☎ host arranges"). */
  hint?: string;
  /** Render the row dimmed — still selectable, but visually flagged. */
  dimmed?: boolean;
  /** Tooltip for the row. */
  title?: string;
};

/**
 * The booking cards' big labeled picker box — "Rooms", "Guests" — with a
 * theme-styled popover list instead of the invisible native `<select>` the
 * boxes used to hide. The OS default menu clashed with the app and couldn't
 * show rich rows (dimmed over-the-cap counts, hints); this one matches the
 * calendar popover: same border, shadow, brand highlights, keyboard support
 * (arrows / Enter / Escape) and outside-click close.
 */
export default function PickerField({
  label,
  display,
  value,
  options,
  onChange,
  disabled = false,
  boxClassName = "border-[#ddd]",
  ariaLabel,
}: {
  label: string;
  /** The value line shown in the closed box — rich content allowed. */
  display: React.ReactNode;
  value: number;
  options: PickerOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Border override for the closed box (e.g. sold-out red). */
  boxClassName?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Long lists (a hotel's whole inventory, a big guest count) scroll — keep
  // the highlighted row in view while arrowing through them.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openMenu = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (v: number) => {
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
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={ref} className="relative mt-[22px]">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between rounded-[10px] border-[1.5px] p-[15px] text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
          disabled ? "cursor-not-allowed" : "cursor-pointer hover:border-[#c9c9d4]"
        } ${boxClassName}`}
      >
        <span className="min-w-0">
          <span className="block text-[18px] font-medium leading-[1.2] text-[#121212]">
            {label}
          </span>
          <span className="mt-0.5 block text-[16px] leading-[1.2] text-[#4a4a4a]">
            {display}
          </span>
        </span>
        <img
          src="/icons/place/dropdown.svg"
          alt=""
          width={49}
          height={49}
          className={`pointer-events-none h-[49px] w-[49px] shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-2 max-h-[300px] overflow-auto rounded-[10px] border border-[#e3e3e8] bg-white py-1.5 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.16)]"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                data-active={i === active || undefined}
                title={o.title}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[15px] leading-[1.3] transition-colors ${
                  o.dimmed
                    ? "text-[#a8a8b0]"
                    : isSel
                      ? "font-semibold text-brand"
                      : "text-[#121212]"
                } ${i === active ? "bg-brand/10" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {o.hint && (
                    <span className="text-[12.5px] text-[#a08334]">{o.hint}</span>
                  )}
                  {isSel && (
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                      <path
                        d="M1 5.5 5 9.5 13 1.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
