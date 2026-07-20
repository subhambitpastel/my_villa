"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/lib/actions";

// The back-office masthead. Deliberately NOT the site Header: an admin is a
// moderator, not a shopper, so there is no search, no "Host your villa", no
// bookings/wishlist nav — nothing that invites acting as a normal user. All it
// carries is where-you-are, who-you-are, and the way out.
export default function AdminTopBar({ email }: { email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await logoutAction();
      // Back to the admin door, not the public home page — the session that
      // just ended was an admin one.
      router.push("/admin/login");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/admin" className="text-[20px] font-bold text-[#121212]">
          My<span className="text-brand">Villa</span>.com{" "}
          <span className="font-normal text-[#7a7a85]">Admin</span>
        </Link>

        <div className="flex items-center gap-4">
          <span
            className="hidden max-w-[240px] truncate text-[14px] text-[#4a4a4a] sm:block"
            title={email}
          >
            {email}
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="rounded-md border border-line px-3.5 py-1.5 text-[14px] font-medium text-[#121212] transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
