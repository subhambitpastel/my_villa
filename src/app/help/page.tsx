import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Answers to common questions about booking and hosting on MyVilla.",
};

const SECTIONS: { title: string; faqs: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Booking a villa",
    faqs: [
      {
        q: "How do I book a villa?",
        a: (
          <>
            Find a place via{" "}
            <Link href="/villas" className="text-brand underline">Villas</Link> or{" "}
            <Link href="/search" className="text-brand underline">Search</Link>,
            open it, pick your check-in and check-out dates and number of
            guests, then press Reserve and complete checkout. Paying confirms
            your stay instantly — you&apos;ll get a booking reference (like
            MV-000123) and the host is notified.
          </>
        ),
      },
      {
        q: "What do the booking statuses mean?",
        a: "Confirmed means your stay is booked — that happens as soon as you pay at checkout, with nothing for the host to approve. Cancelled shows bookings you called off, and Completed appears automatically after your checkout date passes.",
      },
      {
        q: "Why can't I select certain dates?",
        a: "Dates that overlap another guest's confirmed stay can't be booked — the villa page tells you when your selection is unavailable. Past dates can't be booked either.",
      },
      {
        q: "How do discounts work?",
        a: "Stays of 7 nights or more get 15% off, and 28 nights or more get 30% off. The discount is applied automatically on the villa page and at checkout — no promo code needed.",
      },
      {
        q: "How do I cancel a booking?",
        a: (
          <>
            Open{" "}
            <Link href="/profile/bookings" className="text-brand underline">
              My Bookings
            </Link>{" "}
            and press Cancel Booking next to an active stay. Cancellation
            charges may apply depending on the property.
          </>
        ),
      },
    ],
  },
  {
    title: "Hosting your villa",
    faqs: [
      {
        q: "How do I list my villa?",
        a: (
          <>
            Go to{" "}
            <Link href="/host" className="text-brand underline">
              Host your Villa
            </Link>{" "}
            and follow the six steps — personal details, villa details, photos,
            services, pricing and payout method. Your villa appears on the site
            immediately after the last step.
          </>
        ),
      },
      {
        q: "Where do I see bookings for my villas?",
        a: (
          <>
            Every stay guests book at your properties appears under{" "}
            <Link href="/profile/requests" className="text-brand underline">
              Rent Requests
            </Link>
            . Guests pay in full at checkout, so bookings are confirmed
            automatically and the dates are blocked — there&apos;s nothing for
            you to approve.
          </>
        ),
      },
      {
        q: "Can I edit or remove my listing?",
        a: (
          <>
            Yes — in{" "}
            <Link href="/profile/properties" className="text-brand underline">
              My Property
            </Link>{" "}
            press Edit to reopen the wizard with your villa&apos;s details, or
            Remove to delist it.
          </>
        ),
      },
    ],
  },
  {
    title: "Account & payments",
    faqs: [
      {
        q: "How do I change my profile details or picture?",
        a: (
          <>
            Everything is under{" "}
            <Link href="/profile" className="text-brand underline">
              Profile Settings
            </Link>{" "}
            — edit any field and press Apply Changes, or use Change Picture to
            upload a new photo.
          </>
        ),
      },
      {
        q: "I forgot my password.",
        a: (
          <>
            Use{" "}
            <Link href="/recover" className="text-brand underline">
              Recover your password
            </Link>{" "}
            from the sign-in page to set a new one.
          </>
        ),
      },
      {
        q: "Is my card information stored?",
        a: "No. Card details are used only in your browser to simulate the payment step and are never sent to or stored on our servers. Only the booking itself (dates, guests, villa) is saved.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[900px] px-6">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>Help</span>
          </nav>

          <h1 className="mt-[30px] font-nunito text-[32px] font-bold text-heading">
            Help Center
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-body">
            Quick answers about booking, hosting and your account.
          </p>

          {SECTIONS.map((section) => (
            <section key={section.title} className="mt-10">
              <h2 className="font-nunito text-[22px] font-bold text-heading">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3">
                {section.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-[10px] bg-white p-5 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-[#121212]">
                      {faq.q}
                      <svg
                        width="14"
                        height="9"
                        viewBox="0 0 14 9"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 transition-transform group-open:rotate-180"
                      >
                        <path d="M1 1.5l6 6 6-6" stroke="#4a4a4a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <p className="mt-3 text-[14px] leading-relaxed text-body">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <section
            id="contact"
            className="mt-14 rounded-[10px] bg-white p-8 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)]"
          >
            <h2 className="font-nunito text-[22px] font-bold text-heading">
              Still need help?
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-body">
              Our support team answers within one business day.
            </p>
            <div className="mt-4 space-y-1 text-[15px] text-[#121212]">
              <p>
                Email:{" "}
                <a href="mailto:support@myvilla.com" className="text-brand underline">
                  support@myvilla.com
                </a>
              </p>
              <p>Phone: +1 (300) 2590-212 — Mon–Fri, 9:00–18:00</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
