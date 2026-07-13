import Image from "next/image";
import GalleryLightbox from "@/components/place/GalleryLightbox";

// The shared photo gallery — a large hero plus a 2×2 of tiles, with a "Show all
// photos" button (via GalleryLightbox) once there are more than 5. Used by the
// villa detail page and the package detail page so both show the same layout.
export default function VillaGallery({
  gallery,
  name,
}: {
  gallery: string[];
  name: string;
}) {
  const sideImages = gallery.slice(1, 5);

  if (sideImages.length === 0) {
    return (
      <div className="relative mt-[14px] h-72 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:aspect-[950/622] lg:h-auto lg:w-[59.375%]">
        <Image
          src={gallery[0]}
          alt={`${name} main photo`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, (max-width: 1648px) 60vw, 950px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative mt-[14px] grid grid-cols-2 gap-x-[26px] gap-y-[22px] lg:grid-cols-[950fr_301fr_301fr] lg:gap-x-6">
      <div className="relative col-span-2 h-72 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:col-span-1 lg:row-span-2 lg:aspect-[950/622] lg:h-auto">
        <Image
          src={gallery[0]}
          alt={`${name} main photo`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, (max-width: 1648px) 60vw, 950px"
          className="object-cover"
        />
      </div>
      {sideImages.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className="relative h-40 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:aspect-square lg:h-auto"
        >
          <Image
            src={src}
            alt={`${name} photo ${i + 2}`}
            fill
            sizes="(max-width: 1024px) 50vw, (max-width: 1648px) 20vw, 300px"
            className="object-cover"
          />
        </div>
      ))}
      {gallery.length > 5 && <GalleryLightbox images={gallery} name={name} />}
    </div>
  );
}
