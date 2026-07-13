import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import {
  getPublicPackages,
  type PackageItem,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { isRoomBased } from "@/lib/rooms";
import { PACKAGE_TYPES } from "@/lib/packageTypes";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Stay packages on MyVilla — weekend getaways, weekly escapes and monthly retreats with automatic long-stay discounts.",
};

/** A real owner-created package: fixed nights, occupancy and all-inclusive price. */
function HostPackageCard({ pkg }: { pkg: PackageItem }) {
  const roomBased = isRoomBased(pkg.villaKind);
  return (
    <article className="flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0px_2px_4px_0px_rgba(28,5,77,0.1),0px_12px_32px_0px_rgba(0,0,0,0.05)]">
      <Link href={`/package?id=${pkg.id}`} className="relative block h-[180px]">
        <Image
          src={pkg.villaImage}
          alt={`${pkg.villaName}, ${pkg.villaCity}`}
          fill
          sizes="(max-width: 640px) 100vw, 340px"
          className="object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-brand">
          {pkg.nights} night{pkg.nights === 1 ? "" : "s"}
        </span>
        {pkg.discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white">
            {pkg.discount}% off
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[16px] font-semibold text-heading">{pkg.name}</h3>
        <p className="mt-0.5 text-[13px] text-gray">
          {pkg.villaName}, {pkg.villaCity}
        </p>
        <p className="mt-1 text-[12px] text-muted">
          Up to {pkg.maxGuests} guest{pkg.maxGuests === 1 ? "" : "s"} ·{" "}
          {roomBased ? "hotel/resort" : "whole villa"}
        </p>
        {pkg.inclusions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {pkg.inclusions.slice(0, 4).map((inc) => (
              <li
                key={inc}
                className="rounded-full bg-[#e9e8fd] px-2.5 py-0.5 text-[11px] text-brand"
              >
                {inc}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-[20px] font-semibold text-heading">
            {pkg.price > 0 ? `$${pkg.price.toFixed(0)}` : "Free"}
          </span>
          <span className="text-[12px] text-gray">all-inclusive</span>
        </div>
        <Link
          href={`/package?id=${pkg.id}`}
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
  const hostPackages = await getPublicPackages(excludeOwnerId);

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
            All-inclusive getaways put together by our hosts — a fixed number of
            nights, a set price, and every experience included. Pick a start date
            on the villa page and the whole bundle is yours.
          </p>

          {PACKAGE_TYPES.map((t) => {
            const list = hostPackages.filter((p) => p.type === t.value);
            if (list.length === 0) return null;
            return (
              <section key={t.value} className="mt-12">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-nunito text-[24px] font-bold text-heading">
                    {t.label}s
                  </h2>
                  {t.nights && (
                    <span className="rounded-full bg-[#e9e8fd] px-3.5 py-1.5 text-[13px] font-semibold text-brand">
                      {t.nights} nights
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-body">
                  {t.blurb}
                </p>
                <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((pkg) => (
                    <HostPackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </section>
            );
          })}

        </div>
      </main>
      <Footer />
    </>
  );
}
