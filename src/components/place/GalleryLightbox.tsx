"use client";

import { useEffect, useState } from "react";

/* eslint-disable @next/next/no-img-element */

// "Show all photos" button that overlays the villa gallery. A villa owner can
// upload many images but the gallery only shows 5, so this opens a full-screen
// popup with every photo. Kept as a small client component so the surrounding
// VillaDetailView can stay a server component.
export default function GalleryLightbox({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [open, setOpen] = useState(false);

  // Lock background scroll and wire Escape-to-close only while the popup is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-[10px] border border-[#121212]/15 bg-white/95 px-4 py-2.5 text-[14px] font-semibold text-[#121212] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.18)] backdrop-blur transition-colors hover:bg-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="0.75" y="0.75" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="9.25" y="0.75" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="0.75" y="9.25" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <rect x="9.25" y="9.25" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Show all photos
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`All photos of ${name}`}
          className="fixed inset-0 z-[100] overflow-y-auto bg-white"
        >
          <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#c6c6c6]/50 bg-white/95 px-6 py-4 backdrop-blur">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close gallery"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#121212] transition-colors hover:bg-[rgba(0,0,0,0.06)]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-[16px] font-semibold text-[#121212]">
              {images.length} photos
            </span>
          </div>

          <div className="mx-auto max-w-[900px] px-6 py-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`overflow-hidden rounded-[16px] bg-line/20 ${
                    i === 0 ? "sm:col-span-2" : ""
                  }`}
                >
                  <img
                    src={src}
                    alt={`${name} photo ${i + 1}`}
                    loading={i < 3 ? "eager" : "lazy"}
                    className={`w-full object-cover ${
                      i === 0 ? "aspect-[16/9]" : "aspect-[4/3]"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
