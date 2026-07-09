import Image from "next/image";
import Link from "next/link";
import FavoriteButton from "@/components/site/FavoriteButton";

export type Villa = {
  id: number;
  name: string;
  city: string;
  price: number;
  distance: string;
  dates: string;
  image: string;
  liked?: boolean;
};

export default function VillaCard({
  villa,
  authed = false,
  refreshOnFavorite = false,
}: {
  villa: Villa;
  authed?: boolean;
  refreshOnFavorite?: boolean;
}) {
  const placeHref = `/place?id=${villa.id}`;

  return (
    <article className="overflow-hidden rounded-[12px] bg-white shadow-[0px_2px_4px_0px_rgba(28,5,77,0.1),0px_12px_32px_0px_rgba(0,0,0,0.05)]">
      <div className="relative">
        <Link href={placeHref} className="block">
          <div className="relative h-[242px] w-full">
            <Image
              src={villa.image}
              alt={`${villa.name}, ${villa.city}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 298px"
              className="object-cover"
            />
          </div>
        </Link>
        <div className="absolute right-[9px] top-[9px]">
          <FavoriteButton
            villaId={villa.id}
            initialLiked={!!villa.liked}
            authed={authed}
            variant="card"
            refreshOnToggle={refreshOnFavorite}
          />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-4">
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-heading">
            <h3 className="truncate text-[16px] font-semibold">
              <Link href={placeHref}>
                {villa.name},{" "}
                <span className="text-purple">{villa.city}</span>
              </Link>
            </h3>
            <p className="shrink-0 text-right text-[13px] font-semibold">
              ${villa.price}/night
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 text-gray">
            <p className="text-[15px]">{villa.distance}</p>
            <p className="text-[13px]">{villa.dates}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
