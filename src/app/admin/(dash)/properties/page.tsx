import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllVillasAdmin } from "@/lib/queries";
import AdminProperties from "@/components/admin/AdminProperties";

export const metadata: Metadata = {
  title: "Admin · Properties",
  description: "Every listing on the platform.",
};

export default async function AdminPropertiesPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const items = await getAllVillasAdmin();
  return <AdminProperties items={items} />;
}
