import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import GuestDetailsForm from "@/components/welcome/GuestDetailsForm";
import { getCurrentUser } from "@/lib/session";
import { loginHref } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "Tell us about you",
  description: "Complete your guest profile to start booking villas.",
};

export default async function GuestWelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/welcome/guest"));

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-24">
        <div className="mx-auto w-full max-w-[820px] px-6 pt-14">
          <h1 className="text-center text-[32px] font-semibold leading-[1.3] text-black">
            Almost there!
          </h1>
          <div className="mt-8">
            <GuestDetailsForm
              defaults={{
                fullName: user.full_name,
                gender: user.gender,
                dob: user.dob,
                address: user.address,
                emergency: user.emergency,
              }}
              avatarUrl={user.avatar}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
