"use client";

import { useEffect, useId, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

export default function LocationField({
  cities,
  value,
  onChange,
}: {
  cities: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const query = filtering ? value.trim().toLowerCase() : "";
  const options = ["Anywhere", ...cities].filter((c) =>
    c.toLowerCase().includes(query),
  );
  const active = Math.min(highlight, Math.max(options.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function select(option: string) {
    onChange(option === "Anywhere" ? "" : option);
    setFiltering(false);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-2">
      <span className="text-[18px] text-muted">Location</span>
      <div className="flex items-center">
        <img
          src="/icons/location.svg"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0"
        />
        <input
          type="text"
          value={value}
          placeholder="Anywhere"
          aria-label="Location"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setFiltering(false);
            setHighlight(0);
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setFiltering(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight(Math.min(active + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight(Math.max(active - 1, 0));
            } else if (e.key === "Enter" && open && options.length > 0) {
              e.preventDefault();
              select(options[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-[150px] bg-transparent pl-2 pr-8 text-[18px] font-bold text-ink placeholder:text-ink focus:outline-none"
        />
        <img
          src="/icons/chevron-down.svg"
          alt=""
          width={32}
          height={32}
          className="pointer-events-none -ml-8 h-8 w-8 shrink-0"
        />
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Locations"
          className="absolute left-0 top-[calc(100%+10px)] z-20 max-h-[264px] w-[230px] overflow-auto rounded-[10px] bg-white py-2 shadow-[0px_10px_30px_0px_rgba(0,0,0,0.18)]"
        >
          {options.length === 0 ? (
            <li className="px-4 py-2 text-[14px] text-gray">
              No matching places
            </li>
          ) : (
            options.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(o)}
                  className={`block w-full px-4 py-2 text-left text-[16px] transition-colors ${
                    i === active
                      ? "bg-[rgba(123,97,255,0.12)] text-violet"
                      : "text-ink"
                  }`}
                >
                  {o}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
