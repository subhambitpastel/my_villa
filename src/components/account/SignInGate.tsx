"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/lib/actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const input =
  "block w-full rounded-[8px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-[#9d9da6] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function SignInGate({
  title,
  subtitle,
  onSignedIn,
}: {
  title: string;
  subtitle: string;
  onSignedIn?: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next: typeof errors = {};
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const result = await loginAction(data);
    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }
    onSignedIn?.();
    router.refresh();
  }

  return (
    <div className="rounded-[10px] bg-white px-6 py-24 shadow-[0px_15px_50px_0px_rgba(0,0,0,0.08)]">
      <div className="mx-auto max-w-[430px]">
        <h2 className="text-center text-[20px] font-semibold text-black">{title}</h2>
        <p className="mt-1 text-center text-[13px] text-[#121212]">{subtitle}</p>
        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="gate-email" className="mb-1.5 block text-[15px] font-semibold text-ink">
              Email
            </label>
            <input
              id="gate-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="someone@example.com"
              aria-invalid={!!errors.email}
              className={input}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="gate-password" className="mb-1.5 block text-[15px] font-semibold text-ink">
              Password
            </label>
            <input
              id="gate-password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              className={input}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.password}
              </p>
            )}
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-red-600">
              {errors.form}
            </p>
          )}
          <button
            type="submit"
            className="h-11 w-full rounded-[8px] bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Sign in
          </button>
          <p className="text-center text-[12px] text-[#121212]">
            Don&apos;t have an Account?{" "}
            <Link href="/register" className="text-brand underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
