"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  accountSectionsFor,
  NO_ACCOUNT_COUNTS,
  type AccountCounts,
} from "@/lib/accountNav";
import NavCountBadge from "@/components/ui/NavCountBadge";

export default function ProfileShell({
  children,
  isHost = false,
  counts = NO_ACCOUNT_COUNTS,
}: {
  children: React.ReactNode;
  isHost?: boolean;
  /** What's queued behind each tab — unpaid stays, guests awaiting a call.
   *  Badged here because both hold something up while they sit unread, so
   *  neither should need the page opened to be noticed. */
  counts?: AccountCounts;
}) {
  const pathname = usePathname();
  // Same order as the header's avatar menu — both read from accountNav.
  const tabs = accountSectionsFor(isHost, counts);

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-14">
      <aside className="shrink-0 lg:w-48">
        <Link
          href="/profile/settings"
          aria-current={pathname === "/profile/settings" ? "page" : undefined}
          className={`text-[18px] transition-colors ${
            pathname === "/profile/settings"
              ? "font-semibold text-brand"
              : "text-[#121212] hover:text-brand"
          }`}
        >
          Settings
        </Link>
        <nav aria-label="Profile sections" className="mt-6">
          <ul className="flex flex-row flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-y-[26px]">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 text-[16px] transition-colors ${
                      active
                        ? "font-semibold text-brand"
                        : "text-[#121212] hover:text-brand"
                    }`}
                  >
                    {tab.label}
                    <NavCountBadge section={tab} counts={counts} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
