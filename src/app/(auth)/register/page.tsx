import type { Metadata } from "next";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Create your MyVilla host account and register your villa for renting.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      image="/images/auth-register.jpg"
      imageAlt="White villa with a swimming pool and blue door"
    >
      {/* Suspense: RegisterForm reads the ?next= return URL via useSearchParams */}
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
