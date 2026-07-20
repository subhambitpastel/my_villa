import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllPackagesAdmin } from "@/lib/queries";
import AdminPackages from "@/components/admin/AdminPackages";

export const metadata: Metadata = {
  title: "Admin · Packages",
  description: "Every package on the platform.",
};

export default async function AdminPackagesPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const items = await getAllPackagesAdmin();
  return <AdminPackages items={items} />;
}
