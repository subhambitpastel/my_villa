"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The checkout's coupon box. The code rides the URL (`?coupon=...`) so the
 * server validates it and prices the discount — nothing about money is
 * decided in the browser. Applied state shows the code with a Remove;
 * an unknown/foreign code shows why it didn't stick.
 */
export default function CouponField({
  applied,
  invalid,
  alreadyUsed = false,
}: {
  /** The code currently applied (server-validated), or null. */
  applied: string | null;
  /** A code is in the URL but doesn't exist / belongs to another property. */
  invalid: boolean;
  /** The code is real and for this property, but this guest already redeemed it
   *  — one coupon, one use. A separate message from `invalid`: nothing's wrong
   *  with the code, they've just spent it. */
  alreadyUsed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Keep the tried code in the box when it didn't apply (unknown/foreign, or
  // already used), so the message beneath it refers to something visible.
  const [code, setCode] = useState(
    invalid || alreadyUsed ? (searchParams.get("coupon") ?? "") : "",
  );
  const [pending, startTransition] = useTransition();

  function setParam(value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("coupon", value);
    else next.delete("coupon");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  if (applied) {
    return (
      <div className="mt-6 flex items-center justify-between gap-3 rounded-[8px] border border-[#bfe0d2] bg-[#f1faf6] px-4 py-3">
        <p className="min-w-0 text-[14px] text-[#3d6b58]">
          Coupon{" "}
          <span className="font-mono font-semibold tracking-wide text-[#1c7d5c]">
            {applied}
          </span>{" "}
          applied
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => setParam(null)}
          className="shrink-0 text-[13px] text-[#7a7a85] underline hover:text-[#121212] disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-stretch gap-2">
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) {
              e.preventDefault();
              setParam(code.trim());
            }
          }}
          maxLength={20}
          placeholder="Coupon code"
          aria-label="Coupon code"
          className="w-full min-w-0 rounded-[8px] border-[1.5px] border-[#c9c9d4] px-3.5 py-2.5 font-mono text-[14px] tracking-wide text-[#121212] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#9d9da6] focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !code.trim()}
          onClick={() => setParam(code.trim())}
          className="shrink-0 rounded-[8px] border-[1.5px] border-brand px-4 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Apply"}
        </button>
      </div>
      {alreadyUsed ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-[#c0392b]">
          You have already used this coupon code.
        </p>
      ) : (
        invalid && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-[#c0392b]">
            That coupon isn&rsquo;t valid for this property.
          </p>
        )
      )}
    </div>
  );
}
