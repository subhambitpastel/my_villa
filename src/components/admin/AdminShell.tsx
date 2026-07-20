"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS } from "@/lib/adminNav";

// The admin sidebar + content column — a structural sibling of ProfileShell,
// driven by adminNav instead of accountNav.
export default function AdminShell({
  children,
  openCalls = 0,
}: {
  children: React.ReactNode;
  /** Open call requests platform-wide — badged on the Call Requests tab so a
   *  guest waiting on a host can't sit unnoticed. */
  openCalls?: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-14">
      <aside className="shrink-0 lg:w-48">
        <p className="text-[18px] font-semibold text-[#121212]">Admin</p>
        <nav aria-label="Admin sections" className="mt-6">
          <ul className="flex flex-row flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-y-[26px]">
            {ADMIN_SECTIONS.map((tab) => {
              // Overview is "/admin", a prefix of every other tab — exact
              // match for it, prefix match for the rest.
              const active =
                tab.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(tab.href);
              const count = tab.badge === "openCalls" ? openCalls : 0;
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
                    {count > 0 && (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff3d6] px-1.5 text-[11px] font-semibold text-[#a06a00]"
                        aria-label={`${count} open`}
                      >
                        {count > 99 ? "99+" : count}
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
