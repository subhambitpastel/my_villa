import Image from "next/image";
import Link from "next/link";

export default function ArticleListItem({
  image,
  compact = false,
}: {
  image: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/blog/article"
      className="flex overflow-hidden rounded-[6px] bg-white shadow-[0px_4px_14px_0px_rgba(0,0,0,0.07)] transition-shadow hover:shadow-[0px_6px_18px_0px_rgba(0,0,0,0.12)]"
    >
      <span
        className={`relative block shrink-0 ${
          compact ? "w-[110px] sm:w-[130px]" : "w-[150px] sm:w-[219px]"
        }`}
      >
        <Image src={image} alt="" fill sizes="219px" className="object-cover" />
      </span>
      <span className={`flex min-w-0 flex-1 flex-col ${compact ? "p-3" : "p-3 sm:p-[12px]"}`}>
        <span
          className={`font-semibold leading-[1.3] text-[#121212] ${
            compact ? "text-[14px]" : "text-[16px]"
          }`}
        >
          Top 10 best villas you can find for your next trip right now!
        </span>
        <span
          className={`mt-1.5 leading-[1.5] text-[#6f6f78] ${
            compact ? "text-[11px]" : "text-[13px]"
          }`}
        >
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris
          venenatis nisi eget augue vehicula, at dignissim ligula pretium.
        </span>
        <span
          className={`mt-auto flex items-center gap-2 pt-2 text-[#8a8a94] ${
            compact ? "text-[10px]" : "text-[12px]"
          }`}
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-[#8a8a94]" />
          3 hours ago
        </span>
      </span>
    </Link>
  );
}
