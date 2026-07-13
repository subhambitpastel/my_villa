import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import VillaGallery from "@/components/place/VillaGallery";
import PackageBookingWidget from "@/components/place/PackageBookingWidget";
import { getCurrentUser } from "@/lib/session";
import {
  getBookedRanges,
  getPackageDetail,
  getRoomBookings,
} from "@/lib/queries";
import { isRoomBased, roomsForGuests } from "@/lib/rooms";
import { dayFromNow, parseDay } from "@/lib/dates";

type Search = { searchParams: Promise<{ id?: string; in?: string }> };

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { id } = await searchParams;
  const pkg = id ? await getPackageDetail(Number(id)) : null;
  if (!pkg) return { title: "Package" };
  return {
    title: `${pkg.name} — ${pkg.villaName}`,
    description:
      pkg.description ||
      `${pkg.nights}-night all-inclusive package at ${pkg.villaName}, ${pkg.villaCity}.`,
  };
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default async function PackagePage({ searchParams }: Search) {
  const { id, in: startParam } = await searchParams;
  const pkg = id ? await getPackageDetail(Number(id)) : null;
  const user = await getCurrentUser();
  // Preselect a start date only when checkout's "Edit" sends the guest back with
  // a real, non-past `in`; the widget still re-checks availability for it.
  const today = dayFromNow(0);
  const defaultStart =
    startParam && parseDay(startParam) && startParam >= today ? startParam : "";

  if (!pkg) {
    return (
      <>
        <Header />
        <main className="bg-[#fafafa] px-6 py-40 text-center">
          <h1 className="text-[28px] font-semibold text-black">
            This package could not be found.
          </h1>
          <Link href="/packages" className="mt-4 inline-block text-brand underline">
            Browse all packages
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const isOwner = !!user && pkg.ownerId === user.id;
  const roomBased = isRoomBased(pkg.villaKind);
  const roomBookings = roomBased ? await getRoomBookings(pkg.villaId) : [];
  const bookedRanges = roomBased ? [] : await getBookedRanges(pkg.villaId);
  const roomsNeeded = roomsForGuests(pkg.villaKind, pkg.maxGuests, pkg.peoplePerRoom);

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-[100px]">
        <div className="mx-auto w-full max-w-[1920px] px-6 md:px-10 lg:px-[6%] xl:px-[8.33%]">
          <nav aria-label="Breadcrumb" className="pt-10 text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{"  /  "}</span>
            <Link href="/packages" className="underline">Packages</Link>
            <span className="font-light">{" / "}</span>
            <span>{pkg.name}</span>
          </nav>

          <div className="mt-[30px] flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-semibold leading-[1.2] text-[#121212]">
                {pkg.name}
              </h1>
              <p className="mt-2 text-[20px] leading-[1.3] text-[#4a4a4a]">
                <Link href={`/place?id=${pkg.villaId}`} className="underline">
                  {pkg.villaName}, {pkg.villaCity}
                </Link>{" "}
                · {pkg.villaKind}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {pkg.discount > 0 && (
                <span className="rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-white">
                  {pkg.discount}% off
                </span>
              )}
              <span className="rounded-full bg-[#e9e8fd] px-4 py-2 text-[15px] font-semibold text-brand">
                {pkg.nights} night{pkg.nights === 1 ? "" : "s"} · up to{" "}
                {pkg.maxGuests} guest{pkg.maxGuests === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <VillaGallery gallery={pkg.gallery} name={pkg.villaName} />

          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:gap-[5.875%]">
            <div className="w-full lg:w-[58.125%] lg:shrink-0">
              <section>
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">
                  About this package
                </h2>
                <p className="mt-[15px] max-w-[930px] text-justify text-[18px] leading-[1.4] text-[#121212]">
                  {pkg.description ||
                    `A fixed ${pkg.nights}-night all-inclusive stay at ${pkg.villaName}, ${pkg.villaCity}.`}
                </p>
                <p className="mt-4 text-[16px] leading-[1.4] text-[#4a4a4a]">
                  Runs for {pkg.nights} night{pkg.nights === 1 ? "" : "s"}, hosts up
                  to {pkg.maxGuests} guest{pkg.maxGuests === 1 ? "" : "s"}, and{" "}
                  {roomBased
                    ? `reserves ${roomsNeeded} room${roomsNeeded === 1 ? "" : "s"} at the ${pkg.villaKind.toLowerCase()}`
                    : "books the whole villa"}
                  . One price covers everything — no nightly rate or service fee on
                  top.
                </p>
              </section>

              <hr className="mt-[30px] border-t border-[#c6c6c6]" />

              <section className="mt-[30px]">
                <h2 className="text-[24px] font-semibold leading-[1.3] text-brand">
                  What&rsquo;s included
                </h2>
                <ul className="mt-[15px] grid gap-x-8 gap-y-[12px] text-[18px] leading-[1.35] text-[#121212] sm:grid-cols-2">
                  {pkg.inclusions.map((inc) => (
                    <li key={inc} className="flex items-center gap-[12px]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <Check />
                      </span>
                      {inc}
                    </li>
                  ))}
                </ul>
              </section>

              <p className="mt-8 text-[15px] leading-[1.4] text-[#7a7a85]">
                Prefer to book nightly instead?{" "}
                <Link href={`/place?id=${pkg.villaId}`} className="text-brand underline">
                  View {pkg.villaName}
                </Link>
                .
              </p>
            </div>

            {isOwner ? (
              <aside className="h-fit w-full min-w-0 max-w-[576px] rounded-[20px] bg-white px-[41px] py-[40px] shadow-[0px_15px_50px_0px_rgba(0,0,0,0.18)] lg:mt-[60px]">
                <p className="text-[24px] font-semibold text-black">
                  This is your package
                </p>
                <p className="mt-3 text-[16px] leading-[1.4] text-[#4a4a4a]">
                  Guests book it from here. Manage it from My Packages.
                </p>
                <Link
                  href="/profile/packages"
                  className="mt-[25px] flex h-16 items-center justify-center rounded-[10px] bg-brand text-[20px] font-medium text-white transition-colors hover:bg-brand-dark"
                >
                  Manage packages
                </Link>
              </aside>
            ) : (
              <PackageBookingWidget
                packageId={pkg.id}
                villaId={pkg.villaId}
                villaKind={pkg.villaKind}
                nights={pkg.nights}
                maxGuests={pkg.maxGuests}
                price={pkg.price}
                authed={user !== null}
                today={today}
                bookedRanges={bookedRanges}
                roomBookings={roomBookings}
                roomBased={roomBased}
                totalRooms={pkg.villaRooms}
                peoplePerRoom={pkg.peoplePerRoom}
                defaultStart={defaultStart}
              />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
