import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAdminUsers } from "@/lib/adminQueries";
import AdminUsers from "@/components/admin/AdminUsers";

export const metadata: Metadata = {
  title: "Admin · Users",
  description: "Every account, with what they do here.",
};

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (user?.is_admin !== 1) return null;
  const items = await getAdminUsers();
  return <AdminUsers items={items} currentAdminId={user.id} />;
}
