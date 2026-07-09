import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import VillaCard, { type Villa } from "@/components/home/VillaCard";
import { getCurrentUser } from "@/lib/session";
import {
  getFavoriteVillaIds,
  searchVillas,
  getVillaCities,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Villas",
  description: "Browse every villa listed on MyVilla.",
};

export default async function VillasPage() {
  const user = await getCurrentUser();
  const favorites = user ? await getFavoriteVillaIds(user.id) : new Set<number>();
  const cities = await getVillaCities();

  const villas: Villa[] = (await searchVillas({
    sort: "newest",
    excludeOwnerId: user?.id,
  })).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    price: v.price,
    distance: "110 Kilometers away",
    dates: "Feb 18 - 29",
    image: v.image,
    liked: favorites.has(v.id),
  }));

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        {/* Hero band */}
        <div className="relative h-[286px] w-full overflow-hidden">
          <Image
            src="/images/villa-1.jpg"
            alt="Villa with a private pool"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          <p className="absolute inset-x-0 top-[190px] text-center text-[28px] font-semibold leading-[1.3] text-white">
            {villas.length} villas across {cities.length}{" "}
            {cities.length === 1 ? "destination" : "destinations"}
          </p>
        </div>

        <div className="mx-auto w-full px-6 md:px-10 lg:px-[max(6%,calc((100%-1312px)/2))] xl:px-[max(8.33%,calc((100%-1312px)/2))]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <span>Villas</span>
          </nav>

          <div className="mt-[30px] flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-nunito text-[32px] font-bold text-heading">
              All Villas
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {cities.map((city) => (
                <Link
                  key={city}
                  href={`/search?q=${encodeURIComponent(city)}`}
                  className="rounded-full bg-[#e9e8fd] px-3.5 py-1.5 text-[13px] text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  {city}
                </Link>
              ))}
              <Link
                href="/search"
                className="rounded-full border border-brand px-3.5 py-1.5 text-[13px] text-brand transition-colors hover:bg-brand/5"
              >
                Filters &amp; search
              </Link>
            </div>
          </div>

          {villas.length === 0 ? (
            <div className="mt-14 rounded-[10px] bg-white px-6 py-16 text-center shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)]">
              <p className="text-[18px] font-semibold text-[#121212]">
                No villas listed yet.
              </p>
              <Link href="/host" className="mt-2 inline-block text-brand underline">
                Be the first to host your villa
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {villas.map((villa) => (
                <VillaCard key={villa.id} villa={villa} authed={user !== null} />
              ))}
            </div>
          )}

          <div className="mt-16 rounded-[10px] bg-white p-8 text-center shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)]">
            <h2 className="font-nunito text-[24px] font-bold text-heading">
              Have a villa of your own?
            </h2>
            <p className="mt-2 text-[15px] text-body">
              List it on MyVilla and start receiving rent requests.
            </p>
            <Link
              href="/host"
              className="mt-5 inline-block rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Host your Villa
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
