"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { registerAction } from "@/lib/actions";
import { safeNext } from "@/lib/returnTo";
import {
  CountryField,
  OrDivider,
  PhoneField,
  PrimaryButton,
  SocialButtons,
  TextField,
} from "./fields";

type Errors = Partial<
  Record<"email" | "phone" | "country" | "password" | "confirm" | "form", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm() {
  const router = useRouter();
  const returnTo = safeNext(useSearchParams().get("next"));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const phoneCode = String(data.get("phoneCode") ?? "").trim();
    const phoneNumber = String(data.get("phoneNumber") ?? "").trim();
    const country = String(data.get("country") ?? "");
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    const next: Errors = {};
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!phoneNumber) next.phone = "Phone number is required.";
    else if (!phoneCode) next.phone = "Select your country code.";
    else if (phoneNumber.replace(/[\s-]/g, "").length < 6 || /[^\d\s-]/.test(phoneNumber))
      next.phone = "Enter a valid phone number.";
    if (!country) next.country = "Please choose your country or region.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (!confirm) next.confirm = "Please confirm your password.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const result = await registerAction(data);
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    // New accounts choose guest vs host on the welcome screen — unless they
    // arrived mid-flow (e.g. booking), in which case they continue there.
    router.push(returnTo ?? "/welcome");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold leading-normal text-black">
          Welcome to MyVilla
        </h1>
        <p className="text-[18px] leading-normal text-black">
          Create your account to continue
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
        <PhoneField
          label="Phone Number"
          codeName="phoneCode"
          numberName="phoneNumber"
          error={errors.phone}
        />
        <CountryField
          label="Country or Region"
          name="country"
          error={errors.country}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Use a strong password"
          error={errors.password}
        />
        <TextField
          label="Confirm Password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Use a strong password"
          error={errors.confirm}
        />

        {errors.form && (
          <p role="alert" className="text-[13px] text-[#eb5757]">
            {errors.form}
          </p>
        )}

        <PrimaryButton submitting={submitting}>
          {submitting ? "Registering…" : "Register"}
        </PrimaryButton>

        <p className="text-center text-[13px] text-[#121212]">
          By clicking Register I agree to the{" "}
          <Link href="/terms" className="text-brand underline">
            Terms &amp; Conditions
          </Link>{" "}
          of MyVilla
        </p>

        <OrDivider />
        <SocialButtons />
      </form>

      <p className="text-center text-[15px] text-[#121212]">
        Already have an account?{" "}
        <Link
          href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login"}
          className="text-brand underline hover:text-brand-dark"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
