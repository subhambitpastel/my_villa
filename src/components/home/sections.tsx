import Image from "next/image";
import Link from "next/link";
import VillaCard, { type Villa } from "./VillaCard";

function ArrowRight() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src="/icons/arrow-right.svg" alt="" width={32} height={32} className="h-8 w-8" />
  );
}

export function SectionHeading({
  children,
  action = "View all",
  href = "/search",
}: {
  children: React.ReactNode;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-[30px] flex items-center justify-between">
      <h2 className="font-nunito text-[24px] font-bold text-heading">
        {children}
      </h2>
      <Link
        href={href}
        className="flex items-center gap-1 font-nunito text-[24px] text-soft transition-colors hover:text-gray"
      >
        {action}
        <ArrowRight />
      </Link>
    </div>
  );
}

export function VillaRow({
  villas,
  authed = false,
}: {
  villas: Villa[];
  authed?: boolean;
}) {
  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
      {villas.map((villa, i) => (
        <VillaCard key={i} villa={villa} authed={authed} />
      ))}
    </div>
  );
}

export function PromoGrid() {
  return (
    <div className="flex flex-col gap-[15px] lg:h-[527px] lg:flex-row lg:gap-[21px]">
      {/* Left large banner */}
      <Link
        href="/search?type=resort"
        className="group relative block h-72 overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)] lg:h-auto lg:w-[57.5%]"
      >
        <Image
          src="/images/promo-resorts-v2.jpg"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 755px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 rounded-[21px] bg-black/40 mix-blend-multiply" />
        <h3 className="absolute bottom-[29px] left-8 text-[36px] font-semibold leading-[0.8] text-white">
          Explore best resorts in
          <br />
          <span className="mt-[7px] inline-block">your area</span>
        </h3>
      </Link>

      {/* Right stacked banners */}
      <div className="flex flex-1 flex-col gap-[15px]">
        <Link
          href="/promotions"
          className="group relative block h-[256px] overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)]"
        >
          <Image
            src="/images/promo-discount-v2.jpg"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 544px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 rounded-[21px] bg-black/40 mix-blend-multiply" />
          <h3 className="absolute left-[30px] top-[144px] text-[38px] font-semibold leading-[0.8] text-white">
            Upto 25% off on your
            <br />
            <span className="mt-[8px] inline-block">first purchase</span>
          </h3>
        </Link>
        <Link
          href="/promotions"
          className="group relative block h-[256px] overflow-hidden rounded-[21px] shadow-[0px_15px_30px_0px_rgba(0,0,0,0.1)]"
        >
          <Image
            src="/images/promo-friends-v2.jpg"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 544px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 rounded-[21px] bg-black/40 mix-blend-multiply" />
          <h3 className="absolute left-[30px] top-[150px] w-[419px] max-w-full text-[36px] font-semibold leading-[0.8] text-white">
            Invite your friends to
            <br />
            <span className="mt-[7px] inline-block">get discounts</span>
          </h3>
        </Link>
      </div>
    </div>
  );
}

const UNIQUE_PLACES = [
  {
    lead: "Stay among the atolls in",
    place: "Maldives",
    text: "From the 2nd century AD, the islands were known as the 'Money Isles' due to the abundance of cowry shells, a currency of the early ages.",
    image: "/images/unique-maldives.jpg",
  },
  {
    lead: "Experience the Ourika Valley in",
    place: "Morocco",
    text: "Morocco's Hispano-Moorish architecture blends influences from Berber culture, Spain, and contemporary artistic currents in the Middle East.",
    image: "/images/unique-morocco.jpg",
  },
  {
    lead: "Live traditionally in",
    place: "Mongolia",
    text: "Traditional Mongolian yurts consists of an angled latticework of wood or bamboo for walls, ribs, and a wheel.",
    image: "/images/unique-mongolia.jpg",
  },
];

export function UniquePlaces() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[24px] font-bold text-heading">
          Explore unique{" "}
          <span className="bg-gradient-to-b from-[#7b61ff] to-[#3a13ff] bg-clip-text text-transparent">
            places to stay
          </span>
        </h2>
        <Link
          href="/search"
          className="flex items-center gap-1 font-nunito text-[24px] text-soft transition-colors hover:text-gray"
        >
          All
          <ArrowRight />
        </Link>
      </div>

      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {UNIQUE_PLACES.map((item) => (
          <article
            key={item.place}
            className="overflow-hidden rounded-[12px] bg-white p-[10px] shadow-[0px_2px_4px_0px_rgba(28,5,77,0.1),0px_12px_32px_0px_rgba(0,0,0,0.05)]"
          >
            <div className="relative h-[330px] w-full overflow-hidden rounded-[8px]">
              <Image
                src={item.image}
                alt={item.place}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 410px"
                className="object-cover"
              />
            </div>
            <div className="space-y-2 px-[10px] pb-3 pt-4">
              <h3 className="text-[16px] font-semibold text-heading">
                {item.lead} <span className="text-purple">{item.place}</span>
              </h3>
              <p className="text-[16px] leading-normal text-gray">{item.text}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-16 flex justify-center">
        <Link
          href="/search"
          className="rounded-[4px] bg-purple px-5 py-3 text-[16px] font-medium leading-[1.3] text-[#fafafa] transition-colors hover:bg-brand-dark"
        >
          Explore more stays
        </Link>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    name: "Yifei Chen",
    location: "Seoul, South Korea",
    date: "April 2019",
    stars: 5,
    avatar: "/images/avatar-yifei.jpg",
    size: 16,
    text: "What a great experience using MyVilla! I booked all of my resort for my gap year through MyVilla and never had any issues. When I had to cancel a resort because of an emergency, MyVilla support helped me",
  },
  {
    name: "Kaori Yamaguchi",
    location: "Honolulu, Hawaii",
    date: "February 2017",
    stars: 4,
    avatar: "/images/avatar-kaori.jpg",
    size: 18,
    text: "My family and I visit Hawaii every year, and we usually book our resort using other services. MyVilla was recommened to us by a long time friend, and I’m so glad we tried it out! The process was easy and",
  },
  {
    name: "Anthony Lewis",
    location: "Berlin, Germany",
    date: "April 2019",
    stars: 5,
    avatar: "/images/avatar-anthony.jpg",
    size: 18,
    text: "When I was looking to book my villa to Berlin from LAX, MyVilla had the best browsing experiece so I figured I’d give it a try. It was my first time using MyVilla, but I’d definitely recommend it to a friend and use it for",
  },
];

export function Star({ filled = true, size = 24 }: { filled?: boolean; size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={filled ? "/icons/star-filled.svg" : "/icons/star-unfilled.svg"}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

export function Testimonials() {
  return (
    <section className="flex flex-col items-center gap-6">
      <h2 className="text-[24px] font-semibold text-heading">
        What My<span className="text-purple">Villa</span> users are saying
      </h2>
      <div className="grid gap-10 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="flex gap-4 p-4">
            <Image
              src={t.avatar}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
            <div className="flex flex-col gap-3">
              <figcaption>
                <p className="text-[18px] font-semibold text-heading">{t.name}</p>
                <p className="text-[18px] text-heading">
                  {t.location} <span className="text-soft">|</span> {t.date}
                </p>
                <div
                  className="flex pt-2"
                  aria-label={`${t.stars} out of 5 stars`}
                >
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} filled={i < t.stars} />
                  ))}
                </div>
              </figcaption>
              <blockquote
                className="leading-normal text-body"
                style={{ fontSize: t.size }}
              >
                {t.text}{" "}
                <Link href="#" className="text-purple hover:underline">
                  read more...
                </Link>
              </blockquote>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
