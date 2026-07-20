import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllBookings } from "@/lib/queries";
import AdminBookings from "@/components/admin/AdminBookings";

export const metadata: Metadata = {
  title: "Admin · Bookings",
  description: "Every booking on the platform.",
};

// Rent requests ARE booking rows — the owner's Rent Requests and the guest's
// My Bookings are two halves of this one table. The admin sees it whole, with
// a status filter instead of a second section.
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** Show one booking on its own, expanded — the reviews list links here to
     *  point at the stay a rating is about. */
    booking?: string;
  }>;
}) {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const { booking } = await searchParams;
  const items = await getAllBookings();
  // Anything that isn't a positive id is ignored rather than filtering every
  // row away.
  const id = Number(booking);
  const focus = Number.isInteger(id) && id > 0 ? id : null;
  return <AdminBookings items={items} focusBookingId={focus} />;
}
