import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAllCouponsAdmin, getVillaOptionsAdmin } from "@/lib/queries";
import AdminCoupons from "@/components/admin/AdminCoupons";

export const metadata: Metadata = {
  title: "Admin · Coupons",
  description: "Every discount code on the platform.",
};

export default async function AdminCouponsPage() {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  // Every listing on the platform feeds the property picker — support can put a
  // coupon on any of them, not just one owner's.
  const [items, villas] = await Promise.all([
    getAllCouponsAdmin(),
    getVillaOptionsAdmin(),
  ]);
  return <AdminCoupons items={items} villas={villas} />;
}
