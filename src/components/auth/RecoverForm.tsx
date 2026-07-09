"use client";

import { useState } from "react";
import Link from "next/link";
import { recoverAction } from "@/lib/actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecoverForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await recoverAction(data);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Generic confirmation regardless of whether the email is registered —
    // the reset link is delivered to the account's inbox, not this browser.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-[430px]">
        <h1 className="text-[24px] font-semibold leading-normal text-black">
          Check your email
        </h1>
        <p className="mt-[10px] text-[18px] leading-normal text-black">
          If an account exists for that address, we&rsquo;ve sent a link to
          reset your password. It&rsquo;s valid for 15 minutes.
        </p>
        <p className="mt-[20px] text-[15px] text-[#121212]">
          <Link href="/login" className="text-brand underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[430px]">
      <h1 className="text-[24px] font-semibold leading-normal text-black">
        Recover your password
      </h1>
      <p className="mt-[5px] text-[18px] leading-normal text-black">
        Enter your email and we&rsquo;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-[13px]">
        <label
          htmlFor="recover-email"
          className="block text-[20px] font-medium leading-normal text-black"
        >
          Enter Email
        </label>
        <input
          id="recover-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="someone@example.com"
          aria-invalid={!!error}
          className="mt-3 block h-[60px] w-full rounded-[10px] border border-[#4a4a4a] bg-white p-[10px] text-[18px] text-[#121212] placeholder:text-[#696969] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
        />
        {error && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-[30px] flex h-16 w-full items-center justify-center rounded-[10px] bg-brand p-[10px] text-[18px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>

        <p className="mt-[15px] text-center text-[15px] text-[#121212]">
          Remembered it?{" "}
          <Link href="/login" className="text-brand underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
