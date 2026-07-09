"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions";

const inputClasses =
  "mt-3 block h-[60px] w-full rounded-[10px] border border-[#4a4a4a] bg-white p-[10px] text-[18px] text-[#121212] placeholder:text-[#696969] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (confirm !== password) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    const result = await resetPasswordAction(token, data);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/login");
  }

  return (
    <div className="w-full max-w-[430px]">
      <h1 className="text-[24px] font-semibold leading-normal text-black">
        Reset your password
      </h1>
      <p className="mt-[5px] text-[18px] leading-normal text-black">
        Reset your password with a new one!
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-[23px] space-y-[30px]">
        <div>
          <label
            htmlFor="reset-password"
            className="block text-[20px] font-medium leading-normal text-black"
          >
            New Password
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="someone@example.com"
            className={inputClasses}
          />
        </div>
        <div>
          <label
            htmlFor="reset-confirm"
            className="block text-[20px] font-medium leading-normal text-black"
          >
            Confirm Password
          </label>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="someone@example.com"
            className={inputClasses}
          />
        </div>
        {error && (
          <p role="alert" className="!mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="flex h-16 w-full items-center justify-center rounded-[10px] bg-brand p-[10px] text-[18px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Create Password
        </button>

        <p className="!mt-[15px] text-center text-[15px] text-[#121212]">
          Already have an Account?{" "}
          <Link href="/login" className="text-brand underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
