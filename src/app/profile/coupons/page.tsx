import type { Metadata } from "next";
import Coupons from "@/components/account/Coupons";
import { getCurrentUser } from "@/lib/session";
import { getCouponsForOwner, getVillasByOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Coupons",
  description: "Discount coupons for your properties.",
};

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const { villa } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const [villas, coupons] = await Promise.all([
    getVillasByOwner(user.id),
    getCouponsForOwner(user.id),
  ]);
  // "Create coupon" on a property card lands here with that property picked.
  // Only honoured if it really is one of THEIR properties — a stray id in the
  // URL silently falls back to the first.
  const requested = Number(villa);
  const defaultVillaId = villas.some((v) => v.id === requested)
    ? requested
    : undefined;
  return (
    <Coupons
      villas={villas.map((v) => ({ id: v.id, name: v.name, kind: v.kind }))}
      coupons={coupons}
      defaultVillaId={defaultVillaId}
    />
  );
}
