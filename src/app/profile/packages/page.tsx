import type { Metadata } from "next";
import MyPackages from "@/components/account/MyPackages";
import { getCurrentUser } from "@/lib/session";
import {
  getPackageLocksForOwner,
  getPackagesForOwner,
  getVillasByOwner,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Packages",
  description: "Create and manage stay packages for your villas.",
};

export default async function MyPackagesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const [villas, packages, locks] = await Promise.all([
    getVillasByOwner(user.id),
    getPackagesForOwner(user.id),
    // A package with live bookings has its guest count frozen (server-enforced
    // in updatePackageAction); the editor shows why.
    getPackageLocksForOwner(user.id),
  ]);
  return <MyPackages villas={villas} packages={packages} locks={locks} />;
}
