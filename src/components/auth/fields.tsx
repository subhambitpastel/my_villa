"use client";

import { useId, useState } from "react";
import { COUNTRIES, DIAL_CODE_OPTIONS } from "@/lib/countries";

const inputClasses = (hasError: boolean) =>
  `block h-[60px] w-full rounded-[10px] border bg-white p-[10px] text-[18px] text-[#121212] placeholder:text-[#696969] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 ${
    hasError ? "border-red-500" : "border-[#4a4a4a]"
  }`;

function FieldWrapper({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-3 block text-[20px] font-medium leading-normal text-black"
      >
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  autoComplete,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  type?: "text" | "email" | "password";
}) {
  const id = useId();
  return (
    <FieldWrapper label={label} id={id} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={inputClasses(!!error)}
      />
    </FieldWrapper>
  );
}

export function PhoneField({
  label,
  codeName,
  numberName,
  error,
}: {
  label: string;
  codeName: string;
  numberName: string;
  error?: string;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  return (
    <FieldWrapper label={label} id={id} error={error}>
      <div
        className={`flex h-[60px] rounded-[10px] border bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25 ${
          error ? "border-red-500" : "border-[#4a4a4a]"
        }`}
      >
        <select
          id={id}
          name={codeName}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="tel-country-code"
          aria-label={`${label} country code`}
          aria-invalid={!!error}
          className={`w-[150px] shrink-0 cursor-pointer rounded-l-[10px] bg-transparent p-[10px] text-[18px] focus:outline-none ${
            code ? "text-[#121212]" : "text-[#696969]"
          }`}
        >
          <option value="" disabled>
            Code
          </option>
          {DIAL_CODE_OPTIONS.map((d) => (
            <option key={d.value} value={d.value} className="text-[#121212]">
              {d.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="my-[5px] w-px bg-[#4a4a4a]" />
        <input
          name={numberName}
          type="text"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="000 - 0000 - 000"
          aria-label={label}
          aria-invalid={!!error}
          className="min-w-0 flex-1 rounded-r-[10px] bg-transparent p-[10px] text-[18px] text-[#121212] placeholder:text-[#696969] focus:outline-none"
        />
      </div>
    </FieldWrapper>
  );
}

export function CountryField({
  label,
  name,
  error,
}: {
  label: string;
  name: string;
  error?: string;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <FieldWrapper label={label} id={id} error={error}>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          className={`${inputClasses(!!error)} cursor-pointer appearance-none pr-14 ${
            value ? "text-[#121212]" : "text-[#696969]"
          }`}
        >
          <option value="" disabled>
            Choose country or region
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c} className="text-[#121212]">
              {c}
            </option>
          ))}
        </select>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/place/dropdown.svg"
          alt=""
          width={49}
          height={49}
          className="pointer-events-none absolute right-[5px] top-1/2 h-[49px] w-[49px] -translate-y-1/2"
        />
      </div>
    </FieldWrapper>
  );
}

export function PrimaryButton({
  children,
  submitting,
}: {
  children: React.ReactNode;
  submitting: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="flex h-16 w-full items-center justify-center gap-2.5 rounded-[10px] bg-brand p-[10px] text-[18px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting && (
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M22 12a10 10 0 00-10-10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="h-px w-[190px] bg-[#aaaaaa]" />
      <span className="text-[16px] font-medium text-[#aaa]">Or</span>
      <span className="h-px w-[190px] bg-[#aaaaaa]" />
    </div>
  );
}

export function SocialButtons() {
  return (
    <div className="space-y-[15px]">
      {["Continue with facebook", "Continue with Google"].map((label) => (
        <button
          key={label}
          type="button"
          className="block h-[60px] w-full rounded-[10px] border border-[#4a4a4a] bg-white p-[10px] text-left text-[18px] text-[#696969] transition-colors hover:bg-gray-50"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md bg-brand/10 px-4 py-3 text-sm text-brand-dark"
    >
      {children}
    </p>
  );
}
