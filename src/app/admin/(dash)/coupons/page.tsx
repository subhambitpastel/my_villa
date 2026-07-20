import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllCouponsAdmin } from "@/lib/queries";
import AdminCoupons from "@/components/admin/AdminCoupons";

export const metadata: Metadata = {
  title: "Admin · Coupons",
  description: "Every discount code on the platform.",
};

export default async function AdminCouponsPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const items = await getAllCouponsAdmin();
  return <AdminCoupons items={items} />;
}
