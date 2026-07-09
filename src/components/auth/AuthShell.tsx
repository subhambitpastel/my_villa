import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import HomeContent from "@/components/home/HomeContent";

/* eslint-disable @next/next/no-img-element */

export default function AuthShell({
  image,
  imageAlt,
  heading = "Book best villas around you",
  subheading = "Create an account and let’s help you find a better place to enjoy.",
  children,
}: {
  image: string;
  imageAlt: string;
  heading?: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Home page rendered as the modal backdrop — clipped to one viewport so
          the page behind the modal can't be scrolled */}
      <div
        aria-hidden
        className="pointer-events-none h-dvh select-none overflow-hidden"
      >
        <Header />
        <HomeContent />
      </div>

      {/* Scrim */}
      <div className="fixed inset-0 z-40 bg-[rgba(56,70,82,0.2)] mix-blend-darken" />

      {/* Modal layer: scrolls on its own when the card is taller than the
          viewport; clicking anywhere outside the card returns home */}
      <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
        <div className="relative min-h-full">
          <Link
            href="/"
            aria-label="Close and return to home"
            className="absolute inset-0"
          />
          <div className="pointer-events-none relative px-6 pb-[80px] pt-[80px] lg:px-4 lg:pt-[200px] 2xl:px-16">
            <div className="pointer-events-auto mx-auto flex min-h-[600px] w-full max-w-[1600px] overflow-hidden rounded-[15px] bg-white shadow-[0px_15px_60px_0px_rgba(0,0,0,0.1)] lg:h-[1178px]">
              {/* Photo panel — Figma's exact 58.375% share only kicks in near
                  the 1600px design width; on smaller laptops it's narrower so
                  the form column keeps a generous, symmetric side gutter. */}
              <aside className="relative hidden w-[52%] shrink-0 overflow-hidden rounded-l-[15px] lg:block 2xl:w-[58.375%]">
                <Image
                  src={image}
                  alt={imageAlt}
                  fill
                  priority
                  sizes="934px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[rgba(18,18,18,0.28)] mix-blend-darken" />

                <Link
                  href="/"
                  className="absolute left-9 top-[30px] flex items-center text-[24px] leading-[30px] tracking-[0.24px] text-white hover:opacity-80"
                >
                  <img src="/icons/cancel.svg" alt="" width={38} height={38} className="h-[38px] w-[38px]" />
                  <span className="underline">Cancel</span>
                </Link>

                <div className="absolute left-10 top-[150px] text-white">
                  <h1 className="text-[48px] font-semibold leading-normal tracking-[0.48px]">
                    {heading}
                  </h1>
                  <p className="mt-[15px] max-w-[716px] text-[24px] leading-[30px] tracking-[0.24px]">
                    {subheading}
                  </p>
                </div>
              </aside>

              {/* Form panel — the centered 430px form plus this padding lands
                  on the Figma's ~118px side gutter at the design width and stays
                  generous and symmetric on smaller laptops. */}
              <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-10 lg:py-16 2xl:px-16">
                <div className="w-full max-w-[430px]">
                  <p className="mb-10 text-2xl font-bold text-[#151515] lg:hidden">
                    My<span className="text-brand">Villa</span>.com
                  </p>
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}