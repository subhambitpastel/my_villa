"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "@/lib/adminActions";
import { PrimaryButton, TextField } from "@/components/auth/fields";

type Errors = Partial<Record<"email" | "password" | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The /admin/login credentials form — a trimmed LoginForm: no remember-me,
// social sign-in, register or recover. Admin accounts are provisioned, not
// self-served, so the only path is email + password.
export default function AdminLoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Errors = {};
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const result = await adminLoginAction(data);
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="admin@myvilla.com"
        error={errors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Your admin password"
        error={errors.password}
      />
      {errors.form && (
        <p role="alert" className="text-[14px] font-medium text-[#c0392b]">
          {errors.form}
        </p>
      )}
      <PrimaryButton submitting={submitting}>Sign in</PrimaryButton>
    </form>
  );
}
