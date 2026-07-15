import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import CustomerIdChip from "@/components/account/CustomerIdChip";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import { redirect } from "next/navigation";
import VillaCard, { type Villa } from "@/components/home/VillaCard";
import { Star } from "@/components/home/sections";
import { getCurrentUser } from "@/lib/session";
import {
  getFavoriteVillaIds,
  getHostReviewDistribution,
  getHostReviews,
  getHostReviewSummary,
  getVillasByOwner,
} from "@/lib/queries";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "My Account",
  description: "Your public MyVilla host profile.",
};

/* eslint-disable @next/next/no-img-element */

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/account"));

  const joined = new Date(user.created_at.replace(" ", "T") + "Z");
  const joinedLabel = joined.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const reviewSummary = await getHostReviewSummary(user.id);
  const hostReviews = await getHostReviews(user.id);
  const reviewDist = await getHostReviewDistribution(user.id);
  const reviewDistTotal = reviewDist.reduce((s, d) => s + d.count, 0);
  const favorites = await getFavoriteVillaIds(user.id);
  const myVillas: Villa[] = (await getVillasByOwner(user.id)).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    price: v.price,
    discount: v.discount,
    freeServices: v.freeServices,
    image: v.image,
    liked: favorites.has(v.id),
  }));
  // Only hosts have villas to show — a guest (hosting off, owns nothing) never
  // sees the "My Villas" section, not even an empty-state prompt to list one.
  const isHost = user.hosting_enabled === 1 || myVillas.length > 0;

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{" / "}</span>
            <Link href="/profile/settings" className="underline">Settings</Link>
            <span className="font-light">{" / "}</span>
            <span>Profile</span>
          </nav>

          <h1 className="mt-5 text-[36px] font-semibold leading-[1.3] text-[#121212]">
            My Account
          </h1>

          <div className="mt-[35px] flex flex-col gap-12 lg:flex-row lg:gap-[112px]">
            {/* Host info */}
            <section className="w-full max-w-[523px] shrink-0">
              <div className="flex items-center gap-5">
                <Avatar
                  src={user.avatar}
                  alt={user.full_name || user.email}
                  className="h-[103px] w-[103px] rounded-full object-cover"
                />
                <div>
                  <h2 className="text-[24px] font-semibold leading-[1.3] text-[#121212]">
                    {user.full_name || user.email}
                  </h2>
                  <p className="mt-[9px] text-[20px] leading-[1.3] text-[#525252]">
                    Joined in {joinedLabel}
                  </p>
                </div>
              </div>
              <div className="mt-[30px] flex flex-wrap items-center gap-10 text-[20px] leading-[1.3] text-[#121212]">
                {/* Review count is a host stat — guests (no villas) don't see it. */}
                {isHost && (
                  <span className="flex items-center gap-[11px]">
                    <img src="/icons/place/star-vector.svg" alt="" width={27} height={26} className="h-[26px] w-[27px]" />
                    {reviewSummary.count} Review{reviewSummary.count === 1 ? "" : "s"}
                  </span>
                )}
                <span className="flex items-center gap-[7px]">
                  <img src="/icons/place/verified.svg" alt="" width={32} height={32} className="h-8 w-8" />
                  Identity Verified
                </span>
              </div>
              <div className="mt-[25px] text-[20px] leading-[1.5] text-[#121212]">
                <p>Email: {user.email}</p>
                {(user.phone_code || user.phone_number) && (
                  <p>
                    Phone: {[user.phone_code, user.phone_number].filter(Boolean).join("-")}
                  </p>
                )}
              </div>
              {/* Assigned at signup and fixed for life — the handle to quote at
                  support. Read-only by design; there's nothing to edit. */}
              {user.customer_id && <CustomerIdChip customerId={user.customer_id} />}
              <Link
                href="/profile"
                className="mt-[35px] inline-block rounded-[10px] border border-brand bg-white px-5 py-[10px] text-[16px] leading-[1.3] text-brand transition-colors hover:bg-brand/5"
              >
                Edit Profile
              </Link>
              <p className="mt-[35px] flex max-w-[523px] items-center gap-[21px] text-[18px] leading-[1.35] text-black">
                <img src="/icons/place/shield.svg" alt="" width={32} height={36} className="h-9 w-8 shrink-0" />
                To protect your payment, never transfer money or communicate
                outside of the MyVilla website or app.
              </p>
            </section>

            {/* My Villas — hosts only */}
            {isHost && (
            <section className="min-w-0 flex-1">
              <div className="mb-[30px] flex items-center justify-between">
                <h2 className="font-nunito text-[24px] font-bold text-heading">My Villas</h2>
                <Link
                  href="/profile/properties"
                  className="flex items-center gap-1 font-nunito text-[24px] text-soft transition-colors hover:text-gray"
                >
                  View all
                  <img src="/icons/arrow-right.svg" alt="" width={32} height={32} className="h-8 w-8" />
                </Link>
              </div>
              <div className="relative overflow-hidden">
                {myVillas.length === 0 ? (
                  <p className="text-[18px] text-[#525252]">
                    You haven&apos;t listed any villas yet.{" "}
                    <Link href="/host" className="text-brand underline">
                      Add your first villa
                    </Link>
                  </p>
                ) : (
                  <div className="flex w-max gap-5">
                    {myVillas.map((villa) => (
                      <div key={villa.id} className="w-[300px] sm:w-[348px]">
                        <VillaCard villa={villa} authed />
                      </div>
                    ))}
                  </div>
                )}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-[135px] bg-gradient-to-l from-[#fafafa] to-transparent"
                />
              </div>
            </section>
            )}
          </div>

          {/* Reviews — hosts only; a guest with no villas has no reviews to show. */}
          {isHost && (
          <section className="mt-[70px] flex flex-col gap-10 lg:flex-row lg:justify-between">
            <div className="max-w-[839px]">
              <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">Reviews</h2>
              {hostReviews.length === 0 ? (
                <p className="mt-[30px] text-[18px] leading-[1.35] text-[#525252]">
                  No guest reviews yet.
                </p>
              ) : (
                <div className="mt-[30px] space-y-[25px]">
                  {hostReviews.map((r) => (
                    <article key={r.id}>
                      <div className="flex items-center gap-[15px]">
                        <Avatar
                          src={r.authorAvatar}
                          alt=""
                          className="h-[103px] w-[103px] rounded-full object-cover"
                        />
                        <div>
                          <p className="text-[24px] font-semibold leading-[1.3] text-heading">{r.authorName}</p>
                          <p className="mt-[5px] text-[20px] leading-[1.3] text-[#525252]">{r.date}</p>
                          <div className="mt-[5px] flex" aria-label={`${r.stars} out of 5 stars`}>
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} filled={i < r.stars} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-[15px] text-[18px] leading-[1.35] text-heading">
                        {r.comment}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full max-w-[544px]">
              <p className="flex items-center text-[20px] leading-[1.3] text-black">
                <span className="flex items-center">
                  <img src="/icons/place/star-51.svg" alt="" width={51} height={50} className="h-[50px] w-[51px]" />
                  {reviewSummary.count > 0 ? `${reviewSummary.average} Rating` : "No rating yet"}
                </span>
                <img src="/icons/place/dot.svg" alt="" width={27} height={27} className="h-[27px] w-[27px]" />
                <span>{reviewSummary.count} reviews</span>
              </p>
              {reviewDistTotal > 0 && (
                <dl className="mt-[24px] space-y-[15px]">
                  {reviewDist.map((d) => (
                    <div key={d.stars} className="flex items-center justify-between gap-4">
                      <dt className="text-[20px] leading-[1.3] text-[#121212]">
                        {d.stars} star{d.stars === 1 ? "" : "s"}
                      </dt>
                      <dd className="flex items-center gap-[15px]">
                        <span className="relative h-[5px] w-[180px] rounded-[10px] bg-[#c4c4c4] xl:w-[275px]">
                          <span
                            className="absolute left-0 top-0 h-[5px] rounded-[10px] bg-brand"
                            style={{ width: `${(d.count / reviewDistTotal) * 100}%` }}
                          />
                        </span>
                        <span className="w-[38px] text-[20px] leading-[1.3] text-black">{d.count}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
