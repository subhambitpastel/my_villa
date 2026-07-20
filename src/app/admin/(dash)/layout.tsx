import { redirect } from "next/navigation";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminShell from "@/components/admin/AdminShell";
import { getCurrentUser } from "@/lib/session";
import { getOpenCallRequestCount } from "@/lib/adminQueries";

// Everything inside the (dash) group is /admin proper — this layout is the
// navigation gate. The login page is a sibling OUTSIDE the group, so there is
// no redirect loop by construction. Pages and server actions re-check the
// flag themselves: a layout guards navigation, requireAdmin guards writes.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.is_admin !== 1) redirect("/admin/login");

  const openCalls = await getOpenCallRequestCount();

  // No site Header/Footer here on purpose: those are the guest/host chrome
  // (search, "Host your villa", bookings, wishlist). An admin moderates the
  // platform rather than transacting on it, so the back office gets its own
  // minimal masthead instead of the shopfront navigation.
  return (
    <>
      <AdminTopBar email={user.email} />
      <main className="min-h-screen bg-[#fafafa] pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <AdminShell openCalls={openCalls}>{children}</AdminShell>
        </div>
      </main>
    </>
  );
}
