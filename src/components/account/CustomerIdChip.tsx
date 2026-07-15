"use client";

import { useEffect, useRef, useState } from "react";

/** The customer ID, copied to the clipboard on click. A button (not a div) so
 *  it's reachable by keyboard and announces itself; the whole chip is the
 *  target, since the ID is the only thing here worth interacting with. */
export default function CustomerIdChip({ customerId }: { customerId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "Copied" flash is on a timer — drop it if the chip unmounts first.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(customerId);
    } catch {
      // Clipboard denied or unavailable (an insecure context blocks it). The ID
      // stays on screen to select by hand, so say nothing rather than claim a
      // copy that didn't happen.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      aria-label={`Copy customer ID ${customerId}`}
      className="mt-[18px] flex w-fit items-center gap-3 rounded-[10px] bg-[#f2f1fe] px-4 py-3 transition-colors hover:bg-[#e7e5fd] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <span className="text-[16px] leading-[1.3] text-[#525252]">Customer ID</span>
      <span className="font-mono text-[18px] font-semibold tracking-tight text-brand">
        {customerId}
      </span>
      {/* Feedback lives in one live region so it's announced, not just seen. */}
      <span
        aria-live="polite"
        className="flex w-[62px] items-center gap-1 text-[13px] font-medium text-brand/75"
      >
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copied
          </>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
