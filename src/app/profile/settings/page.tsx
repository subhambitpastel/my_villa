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
    title: "Privacy & Sharing",
    description:
      "Control the apps that are connected to your accounts, things you share, and who sees them.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5l8.5 3.7v5.6c0 5.3-3.6 10.2-8.5 12-4.9-1.8-8.5-6.7-8.5-12V5.2L12 1.5zm0 6a2.2 2.2 0 00-2.2 2.2c0 .9.5 1.6 1.2 2v2.6c0 .6.4 1 1 1s1-.4 1-1v-2.6c.7-.4 1.2-1.1 1.2-2A2.2 2.2 0 0012 7.5z" />
      </svg>
    ),
  },
  {
    title: "Notifications Settings",
    description:
      "Choose how your prefer your notifications to be & how you like to be contacted.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 22a2.5 2.5 0 002.5-2.5h-5A2.5 2.5 0 0012 22zm8-5.5v1H4v-1l2-2v-5a6 6 0 014.5-5.9V3a1.5 1.5 0 013 0v.6A6 6 0 0118 9.5v5l2 2z" />
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
  {
    title: "Professional Tools",
    description: "Manage professional Tools if you own a bigger business in MyVilla",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="13" width="4.5" height="8" rx="0.8" />
        <rect x="9.75" y="8" width="4.5" height="13" rx="0.8" />
        <rect x="16.5" y="3" width="4.5" height="18" rx="0.8" />
      </svg>
    ),
  },
  {
    title: "Global Preferences",
    description: "Settings related to currency, languages and others.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M3 7h10M17.5 7H21M3 17h3.5M11 17h10" />
        <circle cx="15.5" cy="7" r="2.4" fill="none" />
        <circle cx="8.5" cy="17" r="2.4" fill="none" />
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
