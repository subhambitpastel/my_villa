"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountSectionsFor } from "@/lib/accountNav";

export default function ProfileShell({
  children,
  isHost = false,
  pendingPayments = 0,
}: {
  children: React.ReactNode;
  isHost?: boolean;
  /** Stays a host arranged that this guest hasn't paid for. Badged on the tab
   *  because they hold no rooms until settled — an unnoticed one is a lost stay,
   *  so it has to be visible without opening the page. */
  pendingPayments?: number;
}) {
  const pathname = usePathname();
  // Same order as the header's avatar menu — both read from accountNav.
  const tabs = accountSectionsFor(isHost);

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
                    {tab.href === "/profile/payments" && pendingPayments > 0 && (
                      <span
                        aria-label={`${pendingPayments} awaiting payment`}
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff3d6] px-1.5 text-[11px] font-semibold text-[#a06a00]"
                      >
                        {pendingPayments}
                      </span>
                    )}
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
