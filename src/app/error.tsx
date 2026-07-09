"use client";

import Link from "next/link";

// Route-level error boundary — catches render/data errors in any page segment.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#fafafa] px-6 text-center">
      <h1 className="text-[28px] font-semibold text-[#121212]">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#4a4a4a]">
        We hit an unexpected error loading this page. You can try again, or head
        back home.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-[8px] border border-brand px-6 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
