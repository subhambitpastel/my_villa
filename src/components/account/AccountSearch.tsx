"use client";

/**
 * The rounded search pill used across the account pages (My Properties, My
 * Packages, My Bookings, My Favorites) — same look as the search page's field,
 * with a leading magnifier so it reads as a filter for the list below it.
 */
export default function AccountSearch({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className={`relative ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6f6f78]"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[46px] w-full rounded-full bg-[#e4e4e7] pl-12 pr-6 text-[14px] text-[#121212] placeholder:text-[#6f6f78] focus:outline-none focus:ring-2 focus:ring-brand/40"
      />
    </form>
  );
}
