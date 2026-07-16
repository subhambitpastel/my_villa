import type { Metadata } from "next";
import Coupons from "@/components/account/Coupons";
import { getCurrentUser } from "@/lib/session";
import { getCouponsForOwner, getVillasByOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Coupons",
  description: "Discount coupons for your properties.",
};

export default async function CouponsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const [villas, coupons] = await Promise.all([
    getVillasByOwner(user.id),
    getCouponsForOwner(user.id),
  ]);
  return (
    <Coupons
      villas={villas.map((v) => ({ id: v.id, name: v.name, kind: v.kind }))}
      coupons={coupons}
    />
  );
}
