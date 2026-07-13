import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import { getCurrentUser } from "@/lib/session";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Choose how you want to use MyVilla — book stays or host your villa.",
};

const CHOICES = [
  {
    key: "guest",
    title: "I'm looking for a place",
    description:
      "Browse villas around the world, save your favorites and book your next stay.",
    cta: "Start exploring",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7.5" />
        <path d="M16.5 16.5L21 21" />
      </svg>
    ),
  },
  {
    key: "host",
    title: "I have a villa to rent",
    description:
      "List your property, set your price and start receiving bookings from guests.",
    cta: "Host your villa",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-7 9 7" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    ),
  },
];

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/welcome"));

  // Guests with a complete profile go straight to browsing; new ones fill in
  // their guest details first (name, age, address — no villa details).
  const profileComplete = !!(
    user.full_name.trim() &&
    user.dob.trim() &&
    user.address.trim()
  );
  const hrefs: Record<string, string> = {
    guest: profileComplete ? "/" : "/welcome/guest",
    host: "/host",
  };

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-24">
        <div className="mx-auto w-full max-w-[900px] px-6 pt-16 text-center">
          <h1 className="text-[32px] font-semibold leading-[1.3] text-black">
            Welcome to MyVilla!
          </h1>
          <p className="mt-2 text-[17px] text-[#4a4a4a]">
            How would you like to start?
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {CHOICES.map((choice) => (
              <Link
                key={choice.key}
                href={hrefs[choice.key]}
                className="group flex flex-col items-center rounded-[12px] bg-white px-8 py-10 shadow-[0px_15px_50px_0px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-1"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e9e8fd] text-brand">
                  {choice.icon}
                </span>
                <h2 className="mt-6 text-[20px] font-semibold text-black">
                  {choice.title}
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">
                  {choice.description}
                </p>
                <span className="mt-6 rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors group-hover:bg-brand-dark">
                  {choice.cta}
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-[13px] text-[#7a7a85]">
            You can always do both — host a villa or book a stay anytime from
            your account.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
