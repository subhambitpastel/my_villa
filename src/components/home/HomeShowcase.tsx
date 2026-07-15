"use client";

import { useState } from "react";
import Hero from "./Hero";
import { PromoGrid, SectionHeading, VillaRow } from "./sections";
import type { Villa } from "./VillaCard";
import type { MaxGuestsByType, PropertyType } from "@/lib/queries";

export type ShowcaseVilla = Villa & { kind: string };

/** What each hero tab is showing, in prose — used by the section headings and
 *  the empty-state copy so they always name the same thing. */
const TAB_LABELS: Record<PropertyType, string> = {
  resort: "resorts",
  hotel: "hotels",
  rent: "villas for rent",
};

// Same mapping the search page uses: Resort and Hotel are their own kinds,
// everything else counts as a private stay you rent.
function matchesTab(kind: string, tab: PropertyType) {
  if (tab === "resort") return kind === "Resort";
  if (tab === "hotel") return kind === "Hotel";
  return kind !== "Resort" && kind !== "Hotel";
}

export default function HomeShowcase({
  villas,
  featured,
  cities,
  maxGuestsByType,
  authed,
}: {
  villas: ShowcaseVilla[];
  /** Owner-promoted "featured" listings, filtered by the hero tab like the rest
   *  of the page — picking Hotels shows the featured hotels, and so on. */
  featured: ShowcaseVilla[];
  cities: string[];
  /** Largest capacity per hero tab — caps the hero's guest picker per tab. */
  maxGuestsByType: MaxGuestsByType;
  authed: boolean;
}) {
  const [tab, setTab] = useState<PropertyType>("rent");
  const filtered = villas.filter((v) => matchesTab(v.kind, tab));
  const topPicks = filtered.slice(0, 4);
  // The featured row follows the tab too, so the whole page reflects the kind
  // of place the guest picked. Two rows of the 4-up grid, as before.
  const featuredForTab = featured
    .filter((v) => matchesTab(v.kind, tab))
    .slice(0, 8);
  const searchHref = `/search?type=${tab}`;

  return (
    <>
      <Hero
        cities={cities}
        tab={tab}
        onTabChange={setTab}
        maxGuests={Math.min(30, maxGuestsByType[tab])}
      />

      <div className="mx-auto w-full px-6 md:px-10 lg:px-[max(6%,calc((100%-1312px)/2))] xl:px-[max(8.33%,calc((100%-1312px)/2))]">
        <section className="pt-[60px]">
          <SectionHeading href={searchHref}>Top picks by myVilla</SectionHeading>
          {topPicks.length > 0 ? (
            <VillaRow villas={topPicks} authed={authed} />
          ) : (
            <p className="text-[16px] text-gray">
              No {TAB_LABELS[tab]} listed yet — try another tab above.
            </p>
          )}
        </section>

        <div className="mt-[120px]">
          <PromoGrid />
        </div>

        {/* Featured is a paid promotion row: when this tab has none, the row is
            dropped rather than showing an empty placeholder (same rule as
            before, just now per-tab instead of overall). */}
        {featuredForTab.length > 0 && (
          <section className="mt-[100px]">
            <SectionHeading href={searchHref}>
              Featured {TAB_LABELS[tab]}
            </SectionHeading>
            <VillaRow villas={featuredForTab} authed={authed} />
          </section>
        )}
      </div>
    </>
  );
}
