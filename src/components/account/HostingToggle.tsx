"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setHostingModeAction } from "@/lib/actions";

export default function HostingToggle({
  enabled,
  ownsVillas,
}: {
  enabled: boolean;
  ownsVillas: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = ownsVillas; // real hosts can't switch hosting off

  function toggle() {
    if (locked || pending) return;
    const next = !on;
    setOn(next);
    setError("");
    startTransition(async () => {
      const result = await setHostingModeAction(next);
      if (!result.ok) {
        setOn(!next);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[8px] border border-[#d9d9ea] bg-white px-5 py-[15px]">
      <div className="flex items-center gap-4">
        <span className="flex w-10 shrink-0 justify-center text-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-7 9 7" />
            <path d="M5 9.5V20h14V9.5" />
            <path d="M9.5 20v-6h5v6" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium leading-[1.4] text-brand">
            Hosting mode
          </span>
          <span className="mt-1 block text-[12px] leading-[1.4] text-[#7a7a85]">
            {on
              ? "You're a villa owner — My Property and Rent Requests are in your profile menu."
              : "Switch to villa owner to list properties and manage rent requests."}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Hosting mode"
          disabled={locked || pending}
          onClick={toggle}
          title={locked ? "You have listed villas — hosting stays on." : undefined}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? "bg-brand" : "bg-[#c6c6c6]"
          } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {on && (
        <p className="mt-3 pl-14 text-[12px] leading-[1.4]">
          <Link href="/host" className="text-brand underline">
            {ownsVillas ? "Add another villa" : "List your first villa"}
          </Link>
          {ownsVillas && (
            <>
              {" · "}
              <Link href="/profile/properties" className="text-brand underline">
                Manage my properties
              </Link>
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 pl-14 text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
