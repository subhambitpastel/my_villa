import Footer from "@/components/site/Footer";
import HomeShowcase, {
  type ShowcaseVilla,
} from "@/components/home/HomeShowcase";
import { Testimonials, UniquePlaces } from "@/components/home/sections";
import {
  getCatalogVillas,
  getFavoriteVillaIds,
  getFeaturedVillas,
  getMaxGuestsByType,
  getVillaCities,
  type CatalogVilla,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function HomeContent() {
  const user = await getCurrentUser();
  const favorites = user ? await getFavoriteVillaIds(user.id) : new Set<number>();

  const toShowcase = (v: CatalogVilla): ShowcaseVilla => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    discount: v.discount,
    freeServices: v.freeServices,
    image: v.image,
    liked: favorites.has(v.id),
  });

  // Hosts browse other people's villas — their own are managed in My Property.
  // Fetch with `kind` so the hero's Resort / Hotels / Rent tabs filter live.
  const villas = (await getCatalogVillas(24, user?.id)).map(toShowcase);
  // Owner-promoted "featured" listings power their own home-page row — but a
  // host never sees their own villas while browsing, so drop the viewer's.
  const featured = (await getFeaturedVillas(8, user?.id)).map(toShowcase);
  return (
    <>
      <main className="bg-[#fafafa]">
        <HomeShowcase
          villas={villas}
          featured={featured}
          cities={await getVillaCities()}
          maxGuestsByType={await getMaxGuestsByType()}
          authed={user !== null}
        />

        <div className="mx-auto w-full px-6 md:px-10 lg:px-[max(6%,calc((100%-1312px)/2))] xl:px-[max(8.33%,calc((100%-1312px)/2))]">
          <div className="mt-16">
            <UniquePlaces />
          </div>

          <div className="mt-11 pb-16">
            <Testimonials />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
