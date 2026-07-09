"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteAction } from "@/lib/actions";
import { loginHref } from "@/lib/returnTo";

export default function PlaceActions({
  villaId,
  initialSaved,
  authed,
}: {
  villaId: number;
  initialSaved: boolean;
  authed: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [shared, setShared] = useState(false);
  const [, startTransition] = useTransition();

  function toggleSave() {
    const here = () =>
      loginHref(window.location.pathname + window.location.search);
    if (!authed) {
      router.push(here());
      return;
    }
    setSaved((v) => !v);
    startTransition(async () => {
      const result = await toggleFavoriteAction(villaId);
      if (result.ok) setSaved(result.liked);
      else if (result.error === "signed-out") router.push(here());
      else setSaved((v) => !v);
    });
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div className="flex items-center gap-[41px]">
      <button
        type="button"
        onClick={share}
        className="flex items-center gap-[10px] text-[20px] leading-[1.3] text-black hover:opacity-70"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/place/share.svg" alt="" width={24} height={24} className="h-6 w-6" />
        {shared ? "Link copied!" : "Share"}
      </button>
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={saved}
        className="flex items-center gap-[10px] text-[20px] leading-[1.3] text-black hover:opacity-70"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={saved ? "/icons/heart-red.svg" : "/icons/place/heart.svg"}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
        />
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
