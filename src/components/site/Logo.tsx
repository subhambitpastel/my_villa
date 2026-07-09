import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`text-[24px] leading-normal text-[#151515] ${className}`}
    >
      <span className="font-medium">My</span>
      <span className="font-bold text-brand">Villa</span>
      <span className="font-medium">.com</span>
    </Link>
  );
}
