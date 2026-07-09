import type { Metadata } from "next";
import MyProperties from "@/components/account/MyProperties";
import { getCurrentUser } from "@/lib/session";
import { getVillasByOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Property",
  description: "Manage the villas you have listed on MyVilla.",
};

export default async function MyPropertyPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  return <MyProperties properties={getVillasByOwner(user.id)} />;
}
