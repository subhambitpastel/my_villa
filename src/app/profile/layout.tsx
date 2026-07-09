import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import ProfileShell from "@/components/account/ProfileShell";
import SignInGate from "@/components/account/SignInGate";
import { getCurrentUser } from "@/lib/session";
import { getVillasByOwner } from "@/lib/queries";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Host tabs show for anyone in hosting mode (or who owns villas).
  const isHost = user
    ? user.hosting_enabled === 1 ||
      (await getVillasByOwner(user.id)).length > 0
    : false;

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          {user ? (
            <ProfileShell isHost={isHost}>{children}</ProfileShell>
          ) : (
            <SignInGate
              title="To view your profile you must be signed in first."
              subtitle="Login to manage your account, properties and rent requests."
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
