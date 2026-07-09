"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Profile Settings", href: "/profile" },
  { label: "My Property", href: "/profile/properties", hostOnly: true },
  { label: "My Bookings", href: "/profile/bookings" },
  { label: "My Favorites", href: "/profile/favorites" },
  { label: "Rent Requests", href: "/profile/requests", hostOnly: true },
];

export default function ProfileShell({
  children,
  isHost = false,
}: {
  children: React.ReactNode;
  isHost?: boolean;
}) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => isHost || !tab.hostOnly);

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
                    className={`text-[16px] transition-colors ${
                      active
                        ? "font-semibold text-brand"
                        : "text-[#121212] hover:text-brand"
                    }`}
                  >
                    {tab.label}
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
