import Image from "next/image";
import Link from "next/link";
import FavoriteButton from "@/components/site/FavoriteButton";

export type Villa = {
  id: number;
  name: string;
  city: string;
  price: number;
  /** Host-set % off the nightly price (0 = none). */
  discount?: number;
  /** The villa's free amenities/services — shown as chips (like the search page). */
  freeServices: string[];
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
  const discount = villa.discount ?? 0;
  const discounted = Math.round(villa.price * (1 - discount / 100));

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
        {discount > 0 && (
          <span className="absolute left-[9px] top-[9px] rounded-full bg-[#eb5757] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {discount}% OFF
          </span>
        )}
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
            {discount > 0 ? (
              <p className="shrink-0 text-right text-[13px] font-semibold">
                ${discounted}
                <span className="ml-1 text-[11px] font-normal text-[#9d9da6] line-through">
                  ${villa.price}
                </span>
                <span className="font-normal">/night</span>
              </p>
            ) : (
              <p className="shrink-0 text-right text-[13px] font-semibold">
                ${villa.price}/night
              </p>
            )}
          </div>
          {villa.freeServices.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {villa.freeServices.slice(0, 3).map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 rounded-full bg-[#e9e8fd] px-2.5 py-1 text-[10px] text-brand"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
