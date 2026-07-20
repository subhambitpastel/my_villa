import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  description: "Sign in to the MyVilla admin dashboard.",
};

// The admin door. Deliberately NOT the site's AuthShell (which renders the
// home page as a modal backdrop) — a back-office entrance is a plain, quiet
// card. Already-signed-in admins skip straight to the dashboard; everyone
// else (including signed-in non-admins) sees the form.
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.is_admin === 1) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6 py-16">
      <div className="w-full max-w-[430px] rounded-lg border border-line/60 bg-white p-6 sm:p-8">
        <p className="text-[22px] font-bold text-[#121212]">
          My<span className="text-brand">Villa</span>.com{" "}
          <span className="font-normal text-[#7a7a85]">Admin</span>
        </p>
        <p className="mt-1 text-[15px] text-[#4a4a4a]">
          Sign in with your administrator credentials.
        </p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
