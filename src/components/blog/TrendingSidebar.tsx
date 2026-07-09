import Image from "next/image";
import Link from "next/link";

const TRENDING = [
  "/images/trend-1.jpg",
  "/images/trend-2.jpg",
  "/images/trend-3.jpg",
  "/images/trend-4.jpg",
  "/images/trend-5.jpg",
  "/images/trend-6.jpg",
];

export default function TrendingSidebar({
  moreLabel = "Load more",
}: {
  moreLabel?: string;
}) {
  return (
    <aside className="h-fit w-full shrink-0 rounded-[10px] border border-[#e7e7ee] bg-white p-[19px] lg:w-[436px]">
      <p className="flex items-center gap-2 p-[10px] pl-0 text-[15px] font-semibold text-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
        Trending Now
      </p>

      <ul className="mt-3 space-y-[14px]">
        {TRENDING.map((src, i) => (
          <li key={src} className="rounded-[4px] border border-[#ececf1] p-[3px]">
            <Link href="/blog/article" className="block">
              <span className="relative block h-[229px] w-full overflow-hidden rounded-[3px]">
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="390px"
                  className="object-cover"
                />
              </span>
              <span className="block px-0.5 py-[10px] text-[15px] leading-[1.5] text-[#121212]">
                Best restaurants to visit on your next tour to Barcelona, Spain.
                Plan your next stay with MyVilla!
              </span>
            </Link>
            {i === TRENDING.length - 1 ? null : null}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="rounded-full border border-brand bg-white px-4 py-[9px] text-[13px] text-brand transition-colors hover:bg-brand/5"
        >
          {moreLabel}
        </button>
      </div>
    </aside>
  );
}
