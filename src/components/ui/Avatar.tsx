"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */

const DEFAULT_AVATAR = "/images/host/avatar.png";

// A robust avatar image: renders a plain <img> (so runtime-uploaded files under
// /uploads are served directly, not run through the image optimizer) and falls
// back to the neutral default user icon if the source is missing, an unsupported
// format, or otherwise fails to load — so an avatar never shows as "broken".
export default function Avatar({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? DEFAULT_AVATAR : src;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
