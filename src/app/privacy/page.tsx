import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MyVilla collects, uses and shares personal information.",
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-7 font-semibold text-[#121212]">{children}</h2>;
}

export default function PrivacyPage() {
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
            <span>Privacy Policy</span>
          </nav>

          <h1 className="mt-[50px] text-[24px] font-semibold leading-[1.2] text-brand">
            Privacy Policy
          </h1>

          <div className="relative mt-[25px] h-64 w-full max-w-[920px] overflow-hidden rounded-[10px] sm:h-[430px]">
            <Image
              src="/images/about-hero.jpg"
              alt="A MyVilla stay by the water"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 920px"
              className="object-cover"
            />
          </div>

          <div className="mt-[25px] max-w-[920px] text-[16px] leading-[1.75] text-[#4a4a4a]">
            <p className="rounded-[8px] border border-[#e3d9a1] bg-[#fdf8e2] px-4 py-3 text-[14px] text-[#7a6a1f]">
              <strong>Template notice:</strong> This is a plain-language
              template describing the data MyVilla handles today. It is not
              legal advice and should be reviewed by qualified counsel and
              aligned with the laws that apply to you before launch.
            </p>
            <p className="mt-5">Last updated: {new Date().getFullYear()}</p>
            <p className="mt-5">
              This Privacy Policy explains what personal information MyVilla
              collects, how we use it, and the choices you have.
            </p>

            <H>Information we collect</H>
            <p className="mt-3">
              When you create an account we collect your name, email, phone
              number, country, and (for booking) your date of birth and address.
              Hosts additionally provide listing details and photos. When you
              book, we store the stay dates, guest count, and villa. If you
              upload a profile or listing photo, we store that image. We do{" "}
              <strong>not</strong> store card numbers — payment details entered
              at checkout are used only for that step.
            </p>

            <H>How we use it</H>
            <p className="mt-3">
              We use your information to operate the Platform: to authenticate
              you, show hosts who is requesting a stay, process and display
              bookings and reviews, prevent abuse, and communicate with you
              about your account and bookings.
            </p>

            <H>How it&rsquo;s shared</H>
            <p className="mt-3">
              When you book a stay, the host sees the information needed to host
              you (such as your name and the booking details), and vice versa.
              We don&rsquo;t sell your personal information. We may share data
              with service providers who help us run MyVilla, or where required
              by law.
            </p>

            <H>Cookies</H>
            <p className="mt-3">
              We use a strictly necessary session cookie to keep you signed in.
              We don&rsquo;t use advertising or cross-site tracking cookies.
            </p>

            <H>Your choices &amp; rights</H>
            <p className="mt-3">
              You can view and update your profile details at any time from{" "}
              <Link href="/profile" className="text-brand underline">
                Profile Settings
              </Link>
              . Depending on where you live, you may have rights to access,
              correct, export, or delete your personal information — contact us
              to make a request.
            </p>

            <H>Data retention &amp; security</H>
            <p className="mt-3">
              We keep your information for as long as your account is active and
              as needed to provide the service. Passwords are stored only as
              salted hashes, and sessions are protected with secure,
              HTTP-only cookies.
            </p>

            <H>Contact</H>
            <p className="mt-3">
              Questions or privacy requests? Email{" "}
              <a href="mailto:privacy@myvilla.com" className="text-brand underline">
                privacy@myvilla.com
              </a>{" "}
              or visit our{" "}
              <Link href="/help" className="text-brand underline">
                Help Center
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
