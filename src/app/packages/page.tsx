import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import { searchVillas, type CatalogVilla } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { dayFromNow } from "@/lib/dates";
import { quote } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Stay packages on MyVilla — weekend getaways, weekly escapes and monthly retreats with automatic long-stay discounts.",
};

type Tier = {
  title: string;
  nights: number;
  blurb: string;
  badge: string;
  villas: CatalogVilla[];
};

function PackageCard({
  villa,
  nights,
  checkIn,
  checkOut,
}: {
  villa: CatalogVilla;
  nights: number;
  checkIn: string;
  checkOut: string;
}) {
  const q = quote(villa.price, nights);
  return (
    <article className="overflow-hidden rounded-[12px] bg-white shadow-[0px_2px_4px_0px_rgba(28,5,77,0.1),0px_12px_32px_0px_rgba(0,0,0,0.05)]">
      <Link href={`/place?id=${villa.id}`} className="relative block h-[200px]">
        <Image
          src={villa.image}
          alt={`${villa.name}, ${villa.city}`}
          fill
          sizes="(max-width: 640px) 100vw, 340px"
          className="object-cover"
        />
      </Link>
      <div className="p-5">
        <h3 className="truncate text-[16px] font-semibold text-heading">
          <Link href={`/place?id=${villa.id}`}>
            {villa.name}, <span className="text-purple">{villa.city}</span>
          </Link>
        </h3>
        <p className="mt-1 text-[13px] text-gray">
          {nights} nights · ${villa.price}/night
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          {q.discountAmount > 0 && (
            <span className="text-[14px] text-gray line-through">
              ${(q.subtotal + q.serviceFee).toFixed(0)}
            </span>
          )}
          <span className="text-[20px] font-semibold text-heading">
            ${q.total.toFixed(0)}
          </span>
          <span className="text-[12px] text-gray">total incl. fees</span>
        </div>
        <Link
          href={`/payment?villa=${villa.id}&in=${checkIn}&out=${checkOut}&guests=2`}
          className="mt-4 flex h-11 items-center justify-center rounded-[8px] bg-brand text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Book this package
        </Link>
      </div>
    </article>
  );
}

export default async function PackagesPage() {
  const user = await getCurrentUser();
  const excludeOwnerId = user?.id;
  const cheapest = searchVillas({ sort: "price_asc", excludeOwnerId }).slice(0, 3);
  const topRated = searchVillas({ sort: "rating", excludeOwnerId }).slice(0, 3);
  const newest = searchVillas({ sort: "newest", excludeOwnerId }).slice(0, 3);

  const tiers: Tier[] = [
    {
      title: "Weekend Getaway",
      nights: 3,
      badge: "3 nights",
      blurb:
        "A short escape at our most affordable villas. Standard nightly rate — perfect for trying a new place.",
      villas: cheapest,
    },
    {
      title: "Weekly Escape",
      nights: 7,
      badge: "7 nights · 15% off",
      blurb:
        "Stay a full week at our top-rated villas and a 15% long-stay discount is applied automatically at checkout.",
      villas: topRated,
    },
    {
      title: "Monthly Retreat",
      nights: 28,
      badge: "28 nights · 30% off",
      blurb:
        "Live like a local for a month. All 28-night stays get 30% off automatically — work remotely from paradise.",
      villas: newest,
    },
  ];

  const checkIn = dayFromNow(14);

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="relative h-[286px] w-full overflow-hidden">
          <Image
            src="/images/promo-resorts-v2.jpg"
            alt="Resort pool at dusk"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <p className="absolute inset-x-0 top-[190px] text-center text-[28px] font-semibold leading-[1.3] text-white">
            Stay longer, pay less — discounts applied automatically
          </p>
        </div>

        <div className="mx-auto w-full px-6 md:px-10 lg:px-[max(6%,calc((100%-1312px)/2))] xl:px-[max(8.33%,calc((100%-1312px)/2))]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>Packages</span>
          </nav>

          <h1 className="mt-[30px] font-nunito text-[32px] font-bold text-heading">
            Stay Packages
          </h1>
          <p className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-body">
            Every package below uses real, live pricing — the discount you see
            here is exactly what checkout charges. Dates start two weeks from
            today; you can adjust them on the villa page before paying.
          </p>

          {tiers.map((tier) => {
            const checkOut = dayFromNow(14 + tier.nights);
            return (
              <section key={tier.title} className="mt-14">
                <div className="flex flex-wrap items-center gap-4">
                  <h2 className="font-nunito text-[24px] font-bold text-heading">
                    {tier.title}
                  </h2>
                  <span className="rounded-full bg-[#e9e8fd] px-3.5 py-1.5 text-[13px] font-semibold text-brand">
                    {tier.badge}
                  </span>
                </div>
                <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-body">
                  {tier.blurb}
                </p>
                {tier.villas.length === 0 ? (
                  <p className="mt-6 text-[14px] text-gray">
                    No villas available for this package yet.
                  </p>
                ) : (
                  <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {tier.villas.map((villa) => (
                      <PackageCard
                        key={villa.id}
                        villa={villa}
                        nights={tier.nights}
                        checkIn={checkIn}
                        checkOut={checkOut}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}
