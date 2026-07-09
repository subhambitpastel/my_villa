import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import TrendingSidebar from "@/components/blog/TrendingSidebar";
import ArticleListItem from "@/components/blog/ArticleListItem";

export const metadata: Metadata = {
  title: "Blog",
  description: "Best travel blogs for you to read today on MyVilla.",
};

const LIST_IMAGES = [
  "/images/search-2.jpg",
  "/images/search-3.jpg",
  "/images/search-4.jpg",
];

const RELATED_IMAGES = [
  "/images/search-2.jpg",
  "/images/search-5.jpg",
  "/images/search-3.jpg",
  "/images/search-4.jpg",
  "/images/search-2.jpg",
  "/images/search-5.jpg",
  "/images/search-3.jpg",
];

export default function BlogPage() {
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
          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:gap-[70px]">
            {/* Articles */}
            <div className="min-w-0 flex-1">
              {/* Featured */}
              <article className="rounded-[6px] bg-white p-[10px] pb-4 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.07)]">
                <Link href="/blog/article" className="block">
                  <span className="relative block h-[220px] w-full overflow-hidden rounded-[4px] sm:h-[290px]">
                    <Image
                      src="/images/blog-featured.png"
                      alt="A bed with a view of sand dunes"
                      fill
                      sizes="(max-width: 1024px) 100vw, 900px"
                      className="object-cover"
                    />
                  </span>
                  <span className="mt-4 block px-2 text-[16px] font-semibold leading-[1.5] text-[#121212]">
                    People are Sharing the amazing discounts MyVilla is offering
                    to new users. Invite your friends to get 30% discount on
                    first booking.
                  </span>
                </Link>
                <div className="mt-3 flex items-center gap-4 px-2 text-[#6f6f78]">
                  <button type="button" aria-label="Share article" className="hover:text-brand">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="6" cy="12" r="2.6" />
                      <circle cx="17.5" cy="5.5" r="2.6" />
                      <circle cx="17.5" cy="18.5" r="2.6" />
                      <path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" />
                    </svg>
                  </button>
                  <button type="button" aria-label="Save article" className="hover:text-brand">
                    <svg width="18" height="18" viewBox="0 0 24 22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M12 20.7l-1.6-1.5C4.7 14.1 1 10.7 1 6.6 1 3.3 3.6.7 6.9.7c1.9 0 3.7.9 4.9 2.3A6.5 6.5 0 0116.7.7C20 .7 22.6 3.3 22.6 6.6c0 4.1-3.7 7.5-9.4 12.6L12 20.7z" />
                    </svg>
                  </button>
                  <Link
                    href="/blog/article"
                    className="ml-auto flex items-center gap-1 text-[13px] text-brand hover:underline"
                  >
                    Read
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                  </Link>
                </div>
              </article>

              {/* Latest */}
              <ul className="mt-[35px] space-y-[18px]">
                {LIST_IMAGES.map((img, i) => (
                  <li key={i}>
                    <ArticleListItem image={img} compact />
                  </li>
                ))}
              </ul>

              <h2 className="mt-[45px] text-[16px] font-semibold text-[#121212]">
                Related Articles
              </h2>
              <ul className="mt-[25px] space-y-[18px]">
                {RELATED_IMAGES.map((img, i) => (
                  <li key={i}>
                    <ArticleListItem image={img} compact />
                  </li>
                ))}
              </ul>
            </div>

            <TrendingSidebar moreLabel="Load more" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
