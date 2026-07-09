import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import TrendingSidebar from "@/components/blog/TrendingSidebar";
import ArticleListItem from "@/components/blog/ArticleListItem";

export const metadata: Metadata = {
  title:
    "People are Sharing the amazing discounts My Villa is offering to new users",
  description:
    "Get 30% discount on your first booking when you invite your friends to MyVilla.",
};

const RELATED_IMAGES = [
  "/images/search-2.jpg",
  "/images/search-5.jpg",
  "/images/search-3.jpg",
  "/images/search-4.jpg",
];

export default function ArticlePage() {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        {/* Hero band */}
        <div className="relative h-[286px] w-full overflow-hidden">
          <Image
            src="/images/search-hero.jpg"
            alt="Beach loungers under palm trees"
            fill
            priority
            sizes="100vw"
            className="object-cover [object-position:50%_60%]"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <p className="absolute inset-x-0 top-[190px] text-center text-[28px] font-semibold leading-[1.3] text-white">
            Best travel blogs for you to read today!
          </p>
        </div>

        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <div className="mt-[56px] flex flex-col gap-10 lg:flex-row lg:gap-[70px]">
            {/* Article */}
            <div className="min-w-0 flex-1">
              {/* Cover */}
              <div className="relative h-[300px] w-full overflow-hidden rounded-[10px] sm:h-[493px]">
                <Image
                  src="/images/article-hero.jpg"
                  alt="Umbrella and loungers on a wooden deck by the sea"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 1182px"
                  className="object-cover"
                />
                <div className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <h1 className="absolute bottom-[76px] left-7 max-w-[915px] pr-6 text-[22px] font-semibold leading-[1.35] text-white sm:text-[24px]">
                  People are Sharing the amazing discounts My Villa is offering
                  to new users. Get 30% dsicount on first booking.
                </h1>
                <p className="absolute bottom-[32px] left-7 flex items-center gap-2 text-[15px] text-white">
                  By Benny Franklin
                  <span aria-hidden className="h-1 w-1 rounded-full bg-white" />
                  3 hours ago
                </p>
                <div className="absolute bottom-[32px] right-7 flex gap-[10px]">
                  <a
                    href="#"
                    className="flex h-[35px] items-center gap-2 rounded-[4px] bg-[#3b5998] px-4 text-[12px] font-medium text-white hover:opacity-90"
                  >
                    <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true">
                      <path d="M6.5 18V9.8h2.8L9.7 6.6H6.5V4.5c0-.9.3-1.6 1.6-1.6h1.7V.1C9.5.1 8.4 0 7.2 0 4.6 0 2.9 1.6 2.9 4.2v2.4H0v3.2h2.9V18h3.6z" />
                    </svg>
                    Share
                  </a>
                  <a
                    href="#"
                    className="flex h-[35px] items-center gap-2 rounded-[4px] bg-[#1da1f2] px-4 text-[12px] font-medium text-white hover:opacity-90"
                  >
                    <svg width="18" height="15" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
                      <path d="M24 2.4c-.9.4-1.8.7-2.8.8 1-.6 1.8-1.6 2.2-2.7-1 .6-2 1-3.1 1.2A4.9 4.9 0 0011.8 6C7.7 5.8 4.1 3.9 1.7 1a4.9 4.9 0 001.5 6.6C2.4 7.5 1.7 7.3 1 7v.1c0 2.4 1.7 4.4 3.9 4.8-.7.2-1.5.2-2.2.1a4.9 4.9 0 004.6 3.4A9.9 9.9 0 010 17.6a13.9 13.9 0 007.5 2.2c9 0 14-7.5 14-14v-.6c1-.7 1.8-1.6 2.5-2.6z" />
                    </svg>
                    Tweet
                  </a>
                </div>
              </div>

              {/* Body */}
              <div className="mt-[43px] max-w-[1122px] text-[16px] leading-[1.7] text-[#121212]">
                <p>
                  Shondale Barnett was one of the three men arrested for the
                  murder of Young Dolph.
                </p>
                <p className="mt-4">
                  Barnett wasn&apos;t involved in the shooting of Dolph and is
                  being charged with being an accessory to a role in helping one
                  of the shooters, Justin Johnson, flee from Memphis.  He is
                  facing additional charges of criminal attempt to commit
                  first-degree murder and theft of property.{" "}
                  <Link href="#" className="font-semibold text-brand">
                    He&apos;s also now missing.
                  </Link>
                </p>
                <p className="mt-4">
                  Barnett had been booked in the Clay County, Indiana jail on
                  January 11. He was supposed to then be extradited to Shelby
                  County, Tennessee to face his charges.
                </p>
                <p className="mt-4">
                  However, instead, Clay County released him after ten days and
                  Shelby County has no idea where he is.
                </p>
                <p className="mt-4">
                  Clay County Sheriff Paul Harden says Shebly county is at fault
                  for the apparent mix-up.
                </p>

                <blockquote className="mt-10 flex gap-[17px]">
                  <span aria-hidden className="w-[20px] shrink-0 rounded-[4px] bg-brand" />
                  <div className="text-[16px] leading-[1.8]">
                    <p>
                      “On January 11, Mr. Shundale Barnett was brought to the
                      Clay County Jail by the Indiana State Police from an
                      arrest on I-70,” Harden explained. “He was booked in the
                      Clay County Jail on an outstanding warrant from Shelby
                      County, Tennessee.
                    </p>
                    <p className="mt-4">
                      “We contacted Shelby County and held him on their warrant.
                      And we were contacted on January 21 and they told us that
                      they were no longer wanting to come and pick up Mr.
                      Barnett and that we were to release him at that time.”
                    </p>
                  </div>
                </blockquote>

                <p className="mt-8">
                  Dolph&apos;s two shooters Justin Johnson and Cornelius Smith
                  are both still locked up and struggling to get legal
                  representation.
                </p>
              </div>

              <h2 className="mt-[80px] text-[16px] font-semibold text-[#121212]">
                Related Articles
              </h2>
              <ul className="mt-[25px] space-y-4">
                {RELATED_IMAGES.map((img, i) => (
                  <li key={i}>
                    <ArticleListItem image={img} />
                  </li>
                ))}
              </ul>
            </div>

            <TrendingSidebar moreLabel="View more" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
