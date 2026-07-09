import type { Metadata } from "next";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Continue with your MyVilla credentials.",
};

export default function LoginPage() {
  return (
    <AuthShell
      image="/images/auth-login.jpg"
      imageAlt="Bright lounge interior with floor-to-ceiling windows"
    >
      {/* Suspense: LoginForm reads the ?next= return URL via useSearchParams */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
