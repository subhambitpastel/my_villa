"use client";

import { useRef, useState, useTransition } from "react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { updateAvatarAction, updateProfileAction } from "@/lib/actions";
import { isAtLeastAge, toDateInput } from "@/lib/dates";
import DateOfBirthField from "@/components/ui/DateOfBirthField";

type Profile = {
  fullName: string;
  gender: string;
  email: string;
  dob: string;
  address: string;
};

// `readOnly` fields are shown but can't be edited. Email is set at signup and
// isn't changeable from the app, so it stays plain text.
const FIELDS: {
  key: keyof Profile;
  label: string;
  type?: string;
  readOnly?: boolean;
}[] = [
  { key: "fullName", label: "Full name" },
  { key: "gender", label: "Gender" },
  { key: "email", label: "Email Address", type: "email", readOnly: true },
  { key: "dob", label: "Date of Birth" },
  { key: "address", label: "Address" },
];

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

export default function ProfileSettings({
  initialProfile,
  avatar: savedAvatar,
}: {
  initialProfile: Profile;
  avatar: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  // The picked avatar is only previewed until the user confirms the save —
  // it's uploaded then, not the moment it's chosen.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function update(key: keyof Profile, value: string) {
    setProfile((cur) => ({ ...cur, [key]: value }));
    setStatus(null);
  }

  // Anything actually changed? Guards the Apply button so we never pop a
  // "save?" dialog for a no-op.
  const dirty =
    avatarFile !== null ||
    FIELDS.some((field) => {
      if (field.readOnly) return false;
      if (field.key === "dob")
        return toDateInput(profile.dob) !== toDateInput(initialProfile.dob);
      return profile[field.key] !== initialProfile[field.key];
    });

  // Validate first, then ask for confirmation — no point confirming a change
  // we'd reject anyway.
  function requestSave() {
    setStatus(null);
    const dob = toDateInput(profile.dob);
    if (dob && !isAtLeastAge(dob)) {
      setStatus({ ok: false, text: "You must be at least 18 years old." });
      return;
    }
    setConfirmOpen(true);
  }

  function confirmSave() {
    // Date of birth is stored as YYYY-MM-DD.
    const next = { ...profile, dob: toDateInput(profile.dob) };
    startTransition(async () => {
      // Persist a newly-picked profile photo (if any) as part of saving — not
      // the moment it was chosen.
      if (avatarFile) {
        const data = new FormData();
        data.append("avatar", avatarFile);
        const av = await updateAvatarAction(data);
        if (!av.ok) {
          setAvatar(null);
          setStatus({ ok: false, text: av.error });
          setConfirmOpen(false);
          return;
        }
        setAvatarFile(null);
      }
      const result = await updateProfileAction(next);
      setStatus(
        result.ok
          ? { ok: true, text: "Profile updated." }
          : { ok: false, text: result.error },
      );
      if (result.ok) {
        setProfile(next);
        router.refresh();
      }
      setConfirmOpen(false);
    });
  }

  // Preview the picked photo and remember it; it's only uploaded on save.
  function pickAvatar(file: File) {
    setAvatar(URL.createObjectURL(file));
    setAvatarFile(file);
    setStatus(null);
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex flex-col-reverse gap-10 sm:flex-row">
        <div className="max-w-md flex-1 space-y-5">
          {FIELDS.map((field) => {
            const value = profile[field.key];
            return (
              <div key={field.key}>
                <span className="mb-1.5 block text-[15px] text-brand">
                  {field.label}
                </span>
                <div
                  className={`flex items-center justify-between gap-3 border-b bg-white px-1 py-2 ${
                    field.readOnly
                      ? "border-[#c6c6c6]"
                      : "border-[#c6c6c6] focus-within:border-brand"
                  }`}
                >
                  {field.readOnly ? (
                    <span className={`truncate text-[15px] ${value ? "text-body" : "text-muted"}`}>
                      {value || "Not Provided"}
                    </span>
                  ) : field.key === "gender" ? (
                    <select
                      value={value}
                      aria-label={field.label}
                      onChange={(e) => update(field.key, e.target.value)}
                      className="w-full bg-transparent text-[15px] text-ink focus:outline-none"
                    >
                      {GENDERS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  ) : field.key === "dob" ? (
                    <DateOfBirthField
                      value={toDateInput(value)}
                      onChange={(d) => update(field.key, d)}
                      triggerClassName="w-full bg-transparent text-[15px]"
                      placeholder="Add date of birth"
                    />
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      value={value}
                      aria-label={field.label}
                      placeholder="Not Provided"
                      onChange={(e) => update(field.key, e.target.value)}
                      className="w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
                    />
                  )}
                </div>
              </div>
            );
          })}

          {status && (
            <p
              role="status"
              className={`rounded-md px-4 py-2.5 text-sm ${
                status.ok
                  ? "bg-brand/10 text-brand-dark"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {status.text}
            </p>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={requestSave}
              className="rounded-[8px] bg-brand px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 sm:w-52">
          <span className="relative block h-24 w-24 overflow-hidden rounded-full bg-line/40">
            <Avatar
              src={avatar || savedAvatar}
              alt="Profile"
              className="h-full w-full object-cover object-top"
            />
          </span>
          <p className="text-[18px] font-bold text-black">{profile.fullName}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[12px] text-ink underline"
          >
            Change Picture
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

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm saving your profile changes"
          onClick={(e) =>
            e.target === e.currentTarget && !pending && setConfirmOpen(false)
          }
        >
          <div className="w-full max-w-[440px] rounded-[12px] bg-white p-6 shadow-[0px_20px_60px_0px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h3 className="text-[18px] font-semibold text-[#121212]">
                  Save these changes?
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">
                  Do you want to update your profile with the changes you just
                  made?
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
                className="text-[14px] text-[#7a7a85] underline disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmSave}
                className="rounded-[8px] bg-brand px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Saving…" : "Yes, save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
