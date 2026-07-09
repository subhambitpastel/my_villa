import type { Metadata } from "next";
import Link from "next/link";
import VillaCard, { type Villa } from "@/components/home/VillaCard";
import { getCurrentUser } from "@/lib/session";
import { getFavoriteVillas } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Favorites",
  description: "Villas you saved on MyVilla.",
};

export default async function MyFavoritesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const favorites: Villa[] = getFavoriteVillas(user.id).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    price: v.price,
    distance: "110 Kilometers away",
    dates: "Feb 18 - 29",
    image: v.image,
    liked: true,
  }));

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#121212]">
          <span className="text-brand">
            {String(favorites.length).padStart(2, "0")}
          </span>{" "}
          Saved {favorites.length === 1 ? "Villa" : "Villas"}
        </h2>
        <Link
          href="/villas"
          className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Browse Villas
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-base font-semibold text-ink">No favorites yet</p>
          <p className="mt-1 text-sm text-body">
            Tap the heart on any villa and it will show up here. Booking a
            saved villa removes it from this list automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((villa) => (
              <VillaCard
                key={villa.id}
                villa={villa}
                authed
                refreshOnFavorite
              />
            ))}
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-[#7a7a85]">
            Tap the heart to remove a villa. Booking a saved villa removes it
            from this list automatically.
          </p>
        </>
      )}
    </div>
  );
}
