import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import { getVillaCities, searchVillas } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Promotions",
  description: "Current deals and discounts on MyVilla stays.",
};

function DealCard({
  image,
  title,
  subtitle,
  href,
  cta,
}: {
  image: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="overflow-hidden rounded-[12px] bg-white shadow-[0px_2px_4px_0px_rgba(28,5,77,0.1),0px_12px_32px_0px_rgba(0,0,0,0.05)]">
      <Link href={href} className="group relative block h-[200px] overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 440px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/35 mix-blend-multiply" />
        <h2 className="absolute bottom-[18px] left-5 right-5 text-[24px] font-semibold leading-[1.15] text-white">
          {title}
        </h2>
      </Link>
      <div className="flex items-center justify-between gap-4 p-5">
        <p className="text-[14px] leading-relaxed text-body">{subtitle}</p>
        <Link
          href={href}
          className="shrink-0 rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}

export default async function PromotionsPage() {
  const user = await getCurrentUser();
  const excludeOwnerId = user?.id;
  const under110 = searchVillas({ max: 110, excludeOwnerId }).length;
  const topRated = searchVillas({ rating: 4.5, excludeOwnerId }).length;
  const newListings = searchVillas({ excludeOwnerId }).filter(
    (v) => v.reviews === 0,
  ).length;
  const cities = getVillaCities();

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="relative h-[286px] w-full overflow-hidden">
          <Image
            src="/images/promo-discount-v2.jpg"
            alt="Beachfront villas"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <p className="absolute inset-x-0 top-[190px] text-center text-[28px] font-semibold leading-[1.3] text-white">
            Live deals — updated with our real inventory
          </p>
        </div>

        <div className="mx-auto w-full px-6 md:px-10 lg:px-[max(6%,calc((100%-1312px)/2))] xl:px-[max(8.33%,calc((100%-1312px)/2))]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>Promotions</span>
          </nav>

          <h1 className="mt-[30px] font-nunito text-[32px] font-bold text-heading">
            Current Promotions
          </h1>

          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <DealCard
              image="/images/promo-resorts-v2.jpg"
              title="Stay a week, save 15%"
              subtitle="Automatic discount on every 7+ night stay. 30% off for 28+ nights."
              href="/packages"
              cta="See packages"
            />
            <DealCard
              image="/images/promo-discount-v2.jpg"
              title={`Villas under $110 — ${under110} available`}
              subtitle="Budget-friendly stays without compromising on comfort."
              href="/search?max=110"
              cta="Browse deals"
            />
            <DealCard
              image="/images/promo-friends-v2.jpg"
              title={`Top-rated stays — ${topRated} villas`}
              subtitle="Rated 4.5 stars and above by guests like you."
              href="/search?rating=4&sort=rating"
              cta="See top rated"
            />
          </div>

          <h2 className="mt-14 font-nunito text-[24px] font-bold text-heading">
            Destination spotlights
          </h2>
          <div className="mt-6 flex flex-wrap gap-4">
            {cities.map((city) => (
              <Link
                key={city}
                href={`/search?q=${encodeURIComponent(city)}`}
                className="rounded-full bg-white px-5 py-2.5 text-[15px] text-heading shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)] transition-colors hover:bg-brand hover:text-white"
              >
                {city}
              </Link>
            ))}
          </div>

          {newListings > 0 && (
            <div className="mt-14 flex flex-col items-start gap-4 rounded-[10px] bg-white p-8 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-nunito text-[24px] font-bold text-heading">
                  Be the first to stay
                </h2>
                <p className="mt-1 text-[14px] text-body">
                  {newListings} brand-new {newListings === 1 ? "listing" : "listings"}{" "}
                  with no reviews yet — try something nobody else has.
                </p>
              </div>
              <Link
                href="/villas"
                className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Browse new listings
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
