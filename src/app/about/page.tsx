import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn more about MyVilla and our mission.",
};

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Amet, aliquet et sit proin feugiat placerat pretium. At augue tellus mi, eu. In tincidunt gravida duis fringilla mi tristique. Mollis consectetur sed viverra nisi, adipiscing mauris. ";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>About Us</span>
          </nav>

          <h1 className="mt-[50px] text-[24px] font-semibold leading-[1.2] text-brand">
            About Us
          </h1>

          <div className="relative mt-[25px] h-64 w-full max-w-[920px] overflow-hidden rounded-[10px] sm:h-[430px]">
            <Image
              src="/images/about-hero.jpg"
              alt="The MyVilla team in a meeting"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 920px"
              className="object-cover"
            />
          </div>

          <p className="mt-[25px] max-w-[920px] text-[16px] leading-[1.75] text-[#4a4a4a]">
            {LOREM}
            {LOREM}
            {LOREM.trim()}
          </p>

          <h2 className="mt-10 text-[24px] font-semibold leading-[1.2] text-brand">
            Our Mission
          </h2>

          <div className="relative mt-[25px] h-64 w-full max-w-[920px] overflow-hidden rounded-[10px] sm:h-[430px]">
            <Image
              src="/images/about-mission.jpg"
              alt="Scrabble tiles spelling the word missions"
              fill
              sizes="(max-width: 1024px) 100vw, 920px"
              className="object-cover"
            />
          </div>

          <p className="mt-[25px] max-w-[920px] text-[16px] leading-[1.75] text-[#4a4a4a]">
            {LOREM}
            {LOREM}
            {LOREM.trim()}
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
