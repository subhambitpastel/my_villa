import type { Metadata } from "next";
import Link from "next/link";
import HostingToggle from "@/components/account/HostingToggle";
import { getCurrentUser } from "@/lib/session";
import { getVillasByOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your MyVilla account settings.",
};

const SETTINGS: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
}[] = [
  {
    title: "Personal Settings",
    description: "Settings related to Personal details and contact informations",
    href: "/profile",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a3 3 0 110 6 3 3 0 010-6zm0 13a8 8 0 01-5.8-2.5c.6-1.8 3-2.7 5.8-2.7s5.2.9 5.8 2.7A8 8 0 0112 20z" />
      </svg>
    ),
  },
  {
    title: "Login & Security",
    description: "Reset your password and manage your sign-in details.",
    href: "/recover",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.5 2a7.5 7.5 0 00-7.1 9.9L2 17.3V22h4.7l1.2-1.2v-2.1H10l1.5-1.5v-2.1h2.1l.8-.8A7.5 7.5 0 1014.5 2zm2 7a1.8 1.8 0 110-3.5 1.8 1.8 0 010 3.5z" />
      </svg>
    ),
  },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const ownsVillas = (await getVillasByOwner(user.id)).length > 0;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-[44px]">
      <HostingToggle
        enabled={user.hosting_enabled === 1 || ownsVillas}
        ownsVillas={ownsVillas}
      />
      <ul className="mt-[14px] space-y-[14px]">
        {SETTINGS.map((s) => (
          <li key={s.title}>
            <Link
              href={s.href ?? "#"}
              className="flex items-center gap-4 rounded-[8px] border border-[#d9d9ea] bg-white px-5 py-[15px] transition-colors hover:border-brand"
            >
              <span className="flex w-10 shrink-0 justify-center text-brand">{s.icon}</span>
              <span>
                <span className="block text-[16px] font-medium leading-[1.4] text-brand">
                  {s.title}
                </span>
                <span className="mt-1 block text-[12px] leading-[1.4] text-[#7a7a85]">
                  {s.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
