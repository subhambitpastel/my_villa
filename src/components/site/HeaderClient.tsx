"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { logoutAction } from "@/lib/actions";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Villas", href: "/villas" },
  { label: "Packages", href: "/packages" },
  { label: "Promotions", href: "/promotions" },
  { label: "Help", href: "/help" },
  { label: "Blog", href: "/blog" },
];

export default function HeaderClient({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function signOut() {
    startTransition(async () => {
      await logoutAction();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="flex items-center justify-between px-[30px] py-[10px]">
        <div className="p-[10px]">
          <Logo />
        </div>

        <div className="hidden items-center gap-[35px] lg:flex">
          {/* Figma (1920px) uses 56px gaps; scale them down linearly so the
              signed-in nav (9 links + button) still fits a 1024px viewport */}
          <nav className="flex items-center gap-[clamp(14px,calc(4.6875vw_-_34px),56px)] text-[18px] text-ink">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`transition-opacity hover:opacity-100 ${
                  isActive(link.href) ? "" : "opacity-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {authed ? (
              <>
                <Link
                  href="/profile/settings"
                  aria-current={isActive("/profile/settings") ? "page" : undefined}
                  className={`transition-opacity hover:opacity-100 ${
                    isActive("/profile/settings") ? "" : "opacity-50"
                  }`}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="opacity-50 transition-opacity hover:opacity-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="opacity-50 transition-opacity hover:opacity-100"
              >
                Signin
              </Link>
            )}
          </nav>
          {authed ? (
            <Link
              href="/account"
              className="rounded-[5px] bg-brand px-[10px] py-[5px] text-[16px] font-semibold tracking-[-0.32px] text-white transition-colors hover:bg-brand-dark"
            >
              My Account
            </Link>
          ) : (
            <Link
              href="/register"
              className="rounded-[5px] bg-brand px-[10px] py-[5px] text-[16px] font-semibold tracking-[-0.32px] text-white transition-colors hover:bg-brand-dark"
            >
              Get Started
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center text-ink lg:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M4 4l14 14M18 4L4 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 5.5h16M3 11h16M3 16.5h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-line/40 bg-white px-6 py-4 lg:hidden">
          <ul className="space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="block text-base text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
            {authed ? (
              <>
                <li>
                  <Link href="/profile/settings" className="block text-base text-ink">
                    Settings
                  </Link>
                </li>
                <li>
                  <Link
                    href="/profile"
                    className="inline-block rounded-[5px] bg-brand px-[10px] py-[5px] text-sm font-semibold text-white"
                  >
                    My Account
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={signOut}
                    className="block text-base text-ink"
                  >
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className="block text-base text-ink">
                    Signin
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="inline-block rounded-[5px] bg-brand px-[10px] py-[5px] text-sm font-semibold text-white"
                  >
                    Get Started
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
