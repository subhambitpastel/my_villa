import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Set a new password for your MyVilla account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-16">
        <div className="mx-auto mt-[89px] flex min-h-[786px] w-full max-w-[1440px] items-center justify-center rounded-[5px] bg-white px-6 py-16 shadow-[0px_15px_60px_0px_rgba(0,0,0,0.05)]">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="w-full max-w-[430px]">
              <h1 className="text-[24px] font-semibold leading-normal text-black">
                Invalid reset link
              </h1>
              <p className="mt-[10px] text-[18px] leading-normal text-black">
                This password-reset link is missing or malformed. Please request
                a new one.
              </p>
              <p className="mt-[20px] text-[15px]">
                <Link href="/recover" className="text-brand underline">
                  Request a reset link
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
