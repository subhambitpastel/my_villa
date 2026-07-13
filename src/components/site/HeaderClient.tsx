"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import Avatar from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/actions";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Packages", href: "/packages" },
  { label: "Promotions", href: "/promotions" },
  { label: "Help", href: "/help" },
  { label: "Blog", href: "/blog" },
];

// Account links shown in the signed-in avatar dropdown. hostOnly entries are
// hidden from guests whose hosting mode is off (same rule as the profile
// sidebar's host tabs).
const ACCOUNT_LINKS: { label: string; href: string; hostOnly?: boolean }[] = [
  { label: "My Account", href: "/account" },
  { label: "My Bookings", href: "/profile/bookings" },
  { label: "My Property", href: "/profile/properties", hostOnly: true },
  { label: "My Favorites", href: "/profile/favorites" },
  { label: "Settings", href: "/profile/settings" },
];

/** Round avatar that reveals an account menu on hover (and click/keyboard). */
function UserMenu({
  avatar,
  name,
  email,
  links,
  onSignOut,
}: {
  avatar: string;
  name: string;
  email: string;
  links: typeof ACCOUNT_LINKS;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Keep the menu open briefly after the cursor leaves so there's time to move
  // from the avatar down onto the menu without it snapping shut.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CLOSE_DELAY = 350;

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Clear any pending close timer if the menu unmounts.
  useEffect(() => cancelClose, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => {
          cancelClose();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="block h-10 w-10 overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-brand/40 focus:outline-none focus-visible:ring-brand"
      >
        <Avatar src={avatar} alt="" className="h-full w-full object-cover" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-[12px] border border-line/50 bg-white p-1.5 text-[14px] shadow-[0px_12px_40px_0px_rgba(0,0,0,0.15)]"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar
              src={avatar}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">
                {name || "Your account"}
              </span>
              {email && (
                <span className="block truncate text-[12px] text-muted">
                  {email}
                </span>
              )}
            </span>
          </div>
          <hr className="my-1 border-line/50" />
          {links.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-[8px] px-3 py-2 text-ink transition-colors hover:bg-brand/5 hover:text-brand"
            >
              {it.label}
            </Link>
          ))}
          <hr className="my-1 border-line/50" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full rounded-[8px] px-3 py-2 text-left font-medium text-[#eb5757] transition-colors hover:bg-[#eb5757]/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function HeaderClient({
  authed,
  isHost = false,
  avatar = "",
  name = "",
  email = "",
}: {
  authed: boolean;
  /** Hosting mode on (or owns villas) — shows the host-only account links. */
  isHost?: boolean;
  avatar?: string;
  name?: string;
  email?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const accountLinks = ACCOUNT_LINKS.filter((it) => !it.hostOnly || isHost);

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
            {!authed && (
              <Link
                href="/login"
                className="opacity-50 transition-opacity hover:opacity-100"
              >
                Signin
              </Link>
            )}
          </nav>
          {authed ? (
            <UserMenu
              avatar={avatar}
              name={name}
              email={email}
              links={accountLinks}
              onSignOut={signOut}
            />
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
                <li className="flex items-center gap-3 border-t border-line/40 pt-3">
                  <Avatar
                    src={avatar}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {name || "Your account"}
                    </span>
                    {email && (
                      <span className="block truncate text-xs text-muted">{email}</span>
                    )}
                  </span>
                </li>
                {accountLinks.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="block text-base text-ink">
                      {it.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={signOut}
                    className="block text-base font-medium text-[#eb5757]"
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
