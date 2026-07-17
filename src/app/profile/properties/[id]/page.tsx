import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PropertyView from "@/components/account/PropertyView";
import { getCurrentUser } from "@/lib/session";
import { getVillaBookingLock, getVillaDetail } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Property details",
  description: "Review your villa's listing settings on MyVilla.",
};

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const villa = await getVillaDetail(Number(id));
  // Only the owner may inspect a listing's settings here — a guest-facing view
  // lives on /place. An unknown id or someone else's villa is a 404.
  if (!villa || villa.owner_id !== user.id) notFound();

  // Editing is frozen while guests hold live bookings; surface that here so the
  // view's Edit button matches the list and the /host route.
  const lock = await getVillaBookingLock(villa.id);

  return <PropertyView villa={villa} editable={lock.active === 0} />;
}
