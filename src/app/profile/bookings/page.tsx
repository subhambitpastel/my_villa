import type { Metadata } from "next";
import MyBookings from "@/components/account/MyBookings";
import { getCurrentUser } from "@/lib/session";
import { getBookingsForGuest } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Bookings",
  description: "Your villa bookings on MyVilla.",
};

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  return <MyBookings bookings={await getBookingsForGuest(user.id)} />;
}
