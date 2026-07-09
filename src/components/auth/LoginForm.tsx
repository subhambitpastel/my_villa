"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions";
import { safeNext } from "@/lib/returnTo";
import {
  OrDivider,
  PrimaryButton,
  SocialButtons,
  TextField,
} from "./fields";

type Errors = Partial<Record<"email" | "password" | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const router = useRouter();
  const returnTo = safeNext(useSearchParams().get("next"));
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
    const result = await loginAction(data);
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    router.push(returnTo ?? "/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold leading-normal text-black">
          Welcome back!
        </h1>
        <p className="text-[18px] leading-normal text-black">
          Continue with your MyVilla credentials
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="someone@example.com"
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Use a strong password"
          error={errors.password}
        />

        <div className="flex items-center justify-between pt-[-5px]">
          <label className="flex items-center gap-[10px] text-[13px] text-[#121212]">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-6 w-6 rounded accent-brand"
            />
            Remember me
          </label>
          <Link
            href="/recover"
            className="text-[13px] text-[#121212] underline hover:text-black"
          >
            Forget Password?
          </Link>
        </div>

        {errors.form && (
          <p role="alert" className="text-[13px] text-[#eb5757]">
            {errors.form}
          </p>
        )}

        <PrimaryButton submitting={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </PrimaryButton>

        <div className="pt-[5px]">
          <OrDivider />
        </div>
        <SocialButtons />
      </form>

      <p className="text-center text-[15px] text-[#121212]">
        New to MyVilla?{" "}
        <Link
          href={returnTo ? `/register?next=${encodeURIComponent(returnTo)}` : "/register"}
          className="text-brand underline hover:text-brand-dark"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
