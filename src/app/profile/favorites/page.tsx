import type { Metadata } from "next";
import MyFavorites from "@/components/account/MyFavorites";
import { type Villa } from "@/components/home/VillaCard";
import { getCurrentUser } from "@/lib/session";
import { getFavoriteVillas } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Favorites",
  description: "Villas you saved on MyVilla.",
};

export default async function MyFavoritesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const favorites: Villa[] = (await getFavoriteVillas(user.id)).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    price: v.price,
    discount: v.discount,
    freeServices: v.freeServices,
    image: v.image,
    liked: true,
  }));

  return <MyFavorites favorites={favorites} />;
}
