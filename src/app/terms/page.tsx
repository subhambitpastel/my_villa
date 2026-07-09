import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of MyVilla.",
};

const ALSO_CHECK = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Help Center", href: "/help" },
  { label: "Contact us", href: "/help#contact" },
  { label: "How to book a villa", href: "/help" },
];

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-7 font-semibold text-[#121212]">{children}</h2>;
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <Link href="/help" className="underline">Help</Link>
            <span className="font-light">{" / "}</span>
            <span>Terms of Service</span>
          </nav>

          <div className="mt-[50px] flex flex-col-reverse gap-10 lg:flex-row lg:items-start lg:justify-between">
            {/* Body */}
            <div className="max-w-[1056px] text-[16px] leading-[1.75] text-[#4a4a4a]">
              <h1 className="text-[24px] font-semibold leading-[1.2] text-brand">
                Terms of Service
              </h1>

              <p className="mt-6 rounded-[8px] border border-[#e3d9a1] bg-[#fdf8e2] px-4 py-3 text-[14px] text-[#7a6a1f]">
                <strong>Template notice:</strong> This is a plain-language
                template describing how MyVilla currently works. It is not legal
                advice and should be reviewed and adapted by qualified legal
                counsel before any real-world launch.
              </p>
              <p className="mt-5">Last updated: {new Date().getFullYear()}</p>

              <p className="mt-5">
                Welcome to MyVilla. These Terms of Service (&ldquo;Terms&rdquo;)
                govern your access to and use of the MyVilla website and
                services (the &ldquo;Platform&rdquo;). By creating an account or
                using the Platform, you agree to these Terms. If you don&rsquo;t
                agree, please don&rsquo;t use MyVilla.
              </p>

              <H>1. About MyVilla</H>
              <p className="mt-3">
                MyVilla is an online marketplace that connects people who want
                to rent out villas and other stays (&ldquo;Hosts&rdquo;) with
                people looking to book them (&ldquo;Guests&rdquo;). MyVilla is
                not a party to the agreement between a Host and a Guest, and is
                not a real-estate broker, travel agency, or insurer. We provide
                the technology that makes listing, discovering, and booking
                stays possible.
              </p>

              <H>2. Your Account</H>
              <p className="mt-3">
                You must be at least 18 years old to book a stay. You&rsquo;re
                responsible for keeping your account details accurate and your
                password secure, and for all activity under your account. Let us
                know promptly if you believe your account has been compromised.
              </p>

              <H>3. Booking a Stay</H>
              <p className="mt-3">
                When you book a villa, you agree to pay the nightly price, any
                applicable service fee, and any discounts or taxes shown at
                checkout. A booking is confirmed once checkout is completed, and
                the reserved dates are held for you. The Host sets the price,
                availability, and house rules for each listing — please read
                them before you book.
              </p>

              <H>4. Payments</H>
              <p className="mt-3">
                Pricing, including any long-stay discounts and the service fee,
                is shown transparently before you confirm a booking. Card
                details you enter at checkout are used only to complete the
                booking step and are not stored by MyVilla. (A production
                deployment would process payments through a regulated payment
                provider.)
              </p>

              <H>5. Cancellations</H>
              <p className="mt-3">
                You can cancel an upcoming booking from your bookings page.
                Depending on the listing and timing, cancellation charges may
                apply. Hosts should honour confirmed bookings; if a listing is
                removed, existing confirmed stays are protected.
              </p>

              <H>6. Hosting</H>
              <p className="mt-3">
                As a Host, you&rsquo;re responsible for the accuracy of your
                listing, for the condition and legality of your property, and
                for complying with all laws, taxes, and regulations that apply
                to your rental. You control your pricing, availability, and
                house rules. You may not list a property you don&rsquo;t have
                the right to rent.
              </p>

              <H>7. Reviews</H>
              <p className="mt-3">
                Guests can review a stay after their checkout date. Reviews must
                reflect a genuine experience and follow our content standards.
                We may remove reviews that are fraudulent, abusive, or violate
                these Terms.
              </p>

              <H>8. Acceptable Use</H>
              <p className="mt-3">
                Don&rsquo;t use MyVilla to break the law, infringe others&rsquo;
                rights, post harmful or misleading content, or interfere with
                the Platform&rsquo;s operation or security. We may suspend or
                terminate accounts that violate these Terms.
              </p>

              <H>9. Content</H>
              <p className="mt-3">
                You retain ownership of the content you post (such as listing
                photos and reviews), and grant MyVilla a licence to host and
                display it in connection with operating the Platform. You&rsquo;re
                responsible for having the rights to any content you upload.
              </p>

              <H>10. Disclaimers &amp; Liability</H>
              <p className="mt-3">
                The Platform is provided &ldquo;as is.&rdquo; To the extent
                permitted by law, MyVilla is not liable for the conduct of Hosts
                or Guests or for the condition of any listing. You use the
                Platform, and stay at any property, at your own risk.
              </p>

              <H>11. Changes to These Terms</H>
              <p className="mt-3">
                We may update these Terms from time to time. If we make material
                changes, we&rsquo;ll take reasonable steps to notify you.
                Continuing to use MyVilla after changes take effect means you
                accept the updated Terms.
              </p>

              <H>12. Contact</H>
              <p className="mt-3">
                Questions about these Terms? Reach us at{" "}
                <a href="mailto:support@myvilla.com" className="text-brand underline">
                  support@myvilla.com
                </a>{" "}
                or through our{" "}
                <Link href="/help" className="text-brand underline">
                  Help Center
                </Link>
                .
              </p>
            </div>

            {/* Sidebar */}
            <aside className="h-fit w-full max-w-[407px] shrink-0 rounded-[10px] bg-white p-[25px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.08)]">
              <h2 className="text-[24px] font-semibold leading-[1.3] text-[#121212]">
                Also check
              </h2>
              <ol className="mt-[10px] list-inside list-decimal text-[16px] leading-[1.9] text-[#4a4a4a]">
                {ALSO_CHECK.map((t) => (
                  <li key={t.label}>
                    <Link href={t.href} className="underline hover:text-brand">
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
