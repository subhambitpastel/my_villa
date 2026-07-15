import type { Metadata } from "next";
import RentRequests from "@/components/account/RentRequests";
import { getCurrentUser } from "@/lib/session";
import { getRequestsForOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Rent Requests",
  description: "Tenant requests for your listed villas.",
};

export default async function RentRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  // Call requests live on their own page (/profile/calls) — they're a different
  // job (ring the guest, arrange it by hand) from confirming a booking.
  return <RentRequests requests={await getRequestsForOwner(user.id)} />;
}
