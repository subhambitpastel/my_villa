import type { Metadata } from "next";
import MyPackages from "@/components/account/MyPackages";
import { getCurrentUser } from "@/lib/session";
import { getPackagesForOwner, getVillasByOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Packages",
  description: "Create and manage stay packages for your villas.",
};

export default async function MyPackagesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const [villas, packages] = await Promise.all([
    getVillasByOwner(user.id),
    getPackagesForOwner(user.id),
  ]);
  return <MyPackages villas={villas} packages={packages} />;
}
