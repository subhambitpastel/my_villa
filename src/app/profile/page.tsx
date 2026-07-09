import type { Metadata } from "next";
import ProfileSettings from "@/components/account/ProfileSettings";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Profile Settings",
  description: "Manage your MyVilla profile details.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  return (
    <ProfileSettings
      initialProfile={{
        fullName: user.full_name,
        gender: user.gender,
        email: user.email,
        dob: user.dob,
        address: user.address,
        emergency: user.emergency,
      }}
      avatar={user.avatar}
    />
  );
}
