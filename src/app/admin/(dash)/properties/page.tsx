import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllVillasAdmin, getVillaLocksAdmin } from "@/lib/queries";
import AdminProperties from "@/components/admin/AdminProperties";

export const metadata: Metadata = {
  title: "Admin · Properties",
  description: "Every listing on the platform.",
};

export default async function AdminPropertiesPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  // Live-booking counts come along so the delete dialog can say up front that a
  // listing can't go yet — the action refuses it either way.
  const [items, locks] = await Promise.all([
    getAllVillasAdmin(),
    getVillaLocksAdmin(),
  ]);
  return <AdminProperties items={items} locks={locks} />;
}
