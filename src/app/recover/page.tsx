import type { Metadata } from "next";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import RecoverForm from "@/components/auth/RecoverForm";

export const metadata: Metadata = {
  title: "Recover your password",
  description: "Recover access to your MyVilla account.",
};

export default function RecoverPage() {
  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-16">
        <div className="mx-auto mt-[89px] flex min-h-[786px] w-full max-w-[1440px] items-center justify-center rounded-[5px] bg-white px-6 py-16 shadow-[0px_15px_60px_0px_rgba(0,0,0,0.05)]">
          <RecoverForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
