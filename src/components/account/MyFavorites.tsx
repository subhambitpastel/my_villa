"use client";

import { useState } from "react";
import Link from "next/link";
import VillaCard, { type Villa } from "@/components/home/VillaCard";
import AccountSearch, { matchesSearch } from "@/components/account/AccountSearch";

export default function MyFavorites({ favorites }: { favorites: Villa[] }) {
  const [query, setQuery] = useState("");
  const visible = favorites.filter((v) => matchesSearch(query, v.name, v.city));

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
          href="/search"
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
          <AccountSearch
            value={query}
            onChange={setQuery}
            placeholder="Search your saved villas by name or city"
            className="mt-6"
          />
          {visible.length === 0 ? (
            <p className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-10 text-center text-[13px] text-muted">
              No saved villas match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="mt-6 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((villa) => (
                <VillaCard
                  key={villa.id}
                  villa={villa}
                  authed
                  refreshOnFavorite
                />
              ))}
            </div>
          )}
          <p className="mt-6 text-[11px] leading-relaxed text-[#7a7a85]">
            Tap the heart to remove a villa. Booking a saved villa removes it
            from this list automatically.
          </p>
        </>
      )}
    </div>
  );
}
