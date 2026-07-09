"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteAction } from "@/lib/actions";
import { loginHref } from "@/lib/returnTo";

/* eslint-disable @next/next/no-img-element */

export default function FavoriteButton({
  villaId,
  initialLiked,
  authed,
  variant = "card",
  refreshOnToggle = false,
}: {
  villaId: number;
  initialLiked: boolean;
  authed: boolean;
  /** "card" = white circle overlay (villa cards), "bare" = just the heart icon */
  variant?: "card" | "bare";
  /** Re-render the page after toggling (e.g. the favorites list removes the card). */
  refreshOnToggle?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [, startTransition] = useTransition();

  function toggle() {
    const here = () =>
      loginHref(window.location.pathname + window.location.search);
    if (!authed) {
      router.push(here());
      return;
    }
    setLiked((v) => !v); // optimistic; server confirms below
    startTransition(async () => {
      const result = await toggleFavoriteAction(villaId);
      if (result.ok) {
        setLiked(result.liked);
        if (refreshOnToggle) router.refresh();
      } else if (result.error === "signed-out") router.push(here());
      else setLiked((v) => !v);
    });
  }

  const icon = (
    <img
      src={liked ? "/icons/heart-red.svg" : "/icons/heart-outline.svg"}
      alt=""
      width={variant === "card" ? 20 : 18}
      height={variant === "card" ? 20 : 18}
      className={variant === "card" ? "h-5 w-5" : "h-[18px] w-[18px]"}
    />
  );

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={liked ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={liked}
      className={
        variant === "card"
          ? "flex h-10 w-10 items-center justify-center rounded-full bg-white drop-shadow-[15px_15px_15px_rgba(0,0,0,0.1)]"
          : "flex items-center justify-center"
      }
    >
      {icon}
    </button>
  );
}
