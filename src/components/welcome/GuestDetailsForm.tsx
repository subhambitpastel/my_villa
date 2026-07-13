"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeGuestProfileAction, updateAvatarAction } from "@/lib/actions";
import { isAtLeastAge, toDateInput } from "@/lib/dates";
import DateOfBirthField from "@/components/ui/DateOfBirthField";

const label = "mb-2 block text-[16px] text-brand";
const input =
  "block w-full rounded-[8px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-[#9d9da6] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// "Prefer not to say" is rendered as the first option (and is the default),
// so it's not repeated in this list — that made it appear twice before.
const GENDERS = ["Female", "Male", "Non-binary"];
const DEFAULT_GENDER = "Prefer not to say";

type Defaults = {
  fullName: string;
  gender: string;
  dob: string;
  address: string;
};

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {children}
    </p>
  );
}

export default function GuestDetailsForm({
  defaults,
  avatarUrl,
}: {
  defaults: Defaults;
  avatarUrl: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [pending, startTransition] = useTransition();
  const [avatar, setAvatar] = useState<string | null>(avatarUrl || null);
  // The picked avatar is only previewed until the form is saved — it's uploaded
  // as part of "Save", not the moment it's chosen.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview the picked photo and remember it; it's only uploaded on Save.
  function pickAvatar(file: File) {
    setAvatar(URL.createObjectURL(file));
    setAvatarFile(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const next: typeof errors = {};
    const values = {
      fullName: get("fullName"),
      gender: get("gender"),
      dob: get("dob"),
      address: get("address"),
    };

    if (!values.fullName) next.fullName = "Full name is required.";
    if (!values.dob) next.dob = "Date of birth is required.";
    else if (!isAtLeastAge(values.dob)) next.dob = "You must be at least 18 years old.";
    if (!values.address) next.address = "Home address is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      // Persist the chosen profile photo (if any) as part of saving — not when
      // it was picked.
      if (avatarFile) {
        const data = new FormData();
        data.append("avatar", avatarFile);
        const av = await updateAvatarAction(data);
        if (!av.ok) {
          setErrors({ form: av.error });
          return;
        }
      }
      const result = await completeGuestProfileAction(values);
      if (!result.ok) {
        setErrors({ form: result.error });
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[10px] bg-white p-6 text-left shadow-[0px_15px_50px_0px_rgba(0,0,0,0.08)] sm:p-8"
    >
      <h2 className="text-[17px] font-bold text-ink">
        A few details before you book
      </h2>

      <div className="mt-6 flex flex-col-reverse gap-8 sm:flex-row">
        <div className="flex-1 space-y-4">
          <div>
            <label htmlFor="g-fullName" className={label}>Full name</label>
            <input
              id="g-fullName"
              name="fullName"
              defaultValue={defaults.fullName}
              placeholder="Add Full name"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              className={input}
            />
            {errors.fullName && <ErrorText>{errors.fullName}</ErrorText>}
          </div>
          <div>
            <label htmlFor="g-dob" className={label}>Date of Birth</label>
            <DateOfBirthField
              id="g-dob"
              name="dob"
              defaultValue={toDateInput(defaults.dob)}
              ariaInvalid={!!errors.dob}
              triggerClassName={input}
              placeholder="Add date of birth"
            />
            {errors.dob && <ErrorText>{errors.dob}</ErrorText>}
          </div>
          <div>
            <label htmlFor="g-address" className={label}>Home Address</label>
            <input
              id="g-address"
              name="address"
              defaultValue={defaults.address}
              placeholder="Where do you live?"
              autoComplete="street-address"
              aria-invalid={!!errors.address}
              className={input}
            />
            {errors.address && <ErrorText>{errors.address}</ErrorText>}
          </div>
          <div>
            <label htmlFor="g-gender" className={label}>
              Gender <span className="text-[#9d9da6]">(optional)</span>
            </label>
            <select
              id="g-gender"
              name="gender"
              defaultValue={defaults.gender || DEFAULT_GENDER}
              className={input}
            >
              <option value={DEFAULT_GENDER}>{DEFAULT_GENDER}</option>
              {GENDERS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:w-52">
          <span className="relative block h-32 w-32 overflow-hidden rounded-full bg-line/40">
            {avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-full w-full p-6 text-muted">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-40 text-center text-[13px] text-ink underline"
          >
            Add a profile photo (optional)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {errors.form}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Link href="/" className="text-[13px] text-[#7a7a85] underline">
          Skip for now
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[8px] bg-brand px-7 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save and start exploring"}
        </button>
      </div>
    </form>
  );
}
