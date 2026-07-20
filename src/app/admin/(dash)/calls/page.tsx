import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllCallRequestsAdmin } from "@/lib/adminQueries";
import AdminCalls from "@/components/admin/AdminCalls";

export const metadata: Metadata = {
  title: "Admin · Call requests",
  description: "Every call request, open and resolved.",
};

export default async function AdminCallsPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const items = await getAllCallRequestsAdmin();
  return <AdminCalls items={items} />;
}
