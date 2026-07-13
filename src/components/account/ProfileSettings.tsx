"use client";

import { useRef, useState, useTransition } from "react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { updateAvatarAction, updateProfileAction } from "@/lib/actions";
import { formatBirthday, isAtLeastAge, toDateInput } from "@/lib/dates";
import {
  isValidPhoneNumber,
  joinDialNumber,
  splitDialNumber,
} from "@/lib/countries";
import DateOfBirthField from "@/components/ui/DateOfBirthField";
import PhoneNumberInput from "@/components/ui/PhoneNumberInput";

type Profile = {
  fullName: string;
  gender: string;
  email: string;
  dob: string;
  address: string;
  emergency: string;
};

// `readOnly` fields are shown but can't be edited. Email is set at signup and
// isn't changeable from the app, so it has no Edit control.
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
  { key: "emergency", label: "Emergency Contact" },
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
  const [editing, setEditing] = useState<keyof Profile | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  // The picked avatar is only previewed until the user clicks "Apply Changes" —
  // it's uploaded then, not the moment it's chosen.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const initEmergency = splitDialNumber(initialProfile.emergency);
  const [emgCode, setEmgCode] = useState(initEmergency.code);
  const [emgNumber, setEmgNumber] = useState(initEmergency.number);
  const fileRef = useRef<HTMLInputElement>(null);

  function update(key: keyof Profile, value: string) {
    setProfile((cur) => ({ ...cur, [key]: value }));
    setStatus(null);
  }

  // Emergency contact edits flow through here so its two inputs (code + number)
  // stay in sync with the single stored "+CC number" string.
  function setEmergency(code: string, number: string) {
    setEmgCode(code);
    setEmgNumber(number);
    update("emergency", joinDialNumber(code, number));
  }

  function applyChanges() {
    setEditing(null);
    // Date of birth is stored as YYYY-MM-DD; hosts/guests must be 18+.
    const dob = toDateInput(profile.dob);
    if (dob && !isAtLeastAge(dob)) {
      setStatus({ ok: false, text: "You must be at least 18 years old." });
      return;
    }
    // Emergency contact is optional, but a provided number must be valid and
    // carry a country code.
    if (profile.emergency) {
      const emg = splitDialNumber(profile.emergency);
      if (!emg.code || !isValidPhoneNumber(emg.number, emg.code)) {
        setStatus({
          ok: false,
          text: "Enter a valid emergency contact number with its country code.",
        });
        return;
      }
    }
    const next = { ...profile, dob };
    startTransition(async () => {
      // Persist a newly-picked profile photo (if any) as part of applying the
      // changes — not the moment it was chosen.
      if (avatarFile) {
        const data = new FormData();
        data.append("avatar", avatarFile);
        const av = await updateAvatarAction(data);
        if (!av.ok) {
          setAvatar(null);
          setStatus({ ok: false, text: av.error });
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
    });
  }

  // Preview the picked photo and remember it; it's only uploaded on Apply.
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
            const isEditing = editing === field.key && !field.readOnly;
            return (
              <div key={field.key}>
                <span className="mb-1.5 block text-[15px] text-brand">
                  {field.label}
                </span>
                <div
                  className={`flex items-center justify-between gap-3 border-b bg-white px-1 py-2 ${
                    isEditing ? "border-brand" : "border-[#c6c6c6]"
                  }`}
                >
                  {isEditing ? (
                    field.key === "gender" ? (
                      <select
                        autoFocus
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
                        defaultOpen
                      />
                    ) : field.key === "emergency" ? (
                      <PhoneNumberInput
                        bare
                        label="Emergency Contact"
                        code={emgCode}
                        number={emgNumber}
                        onCode={(c) => setEmergency(c, emgNumber)}
                        onNumber={(n) => setEmergency(emgCode, n)}
                      />
                    ) : (
                      <input
                        autoFocus
                        type={field.type ?? "text"}
                        value={value}
                        aria-label={field.label}
                        onChange={(e) => update(field.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditing(null);
                        }}
                        className="w-full bg-transparent text-[15px] text-ink focus:outline-none"
                      />
                    )
                  ) : (
                    <span className={`truncate text-[15px] ${value ? "text-body" : "text-muted"}`}>
                      {(field.key === "dob" && value ? formatBirthday(value) : value) ||
                        "Not Provided"}
                    </span>
                  )}
                  {!field.readOnly && (
                    <button
                      type="button"
                      onClick={() => setEditing(isEditing ? null : field.key)}
                      className="shrink-0 text-[13px] font-medium text-[#121212] underline"
                    >
                      {isEditing ? "Done" : value ? "Edit" : "Add"}
                    </button>
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
              disabled={pending}
              onClick={applyChanges}
              className="rounded-[8px] bg-brand px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : "Apply Changes"}
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
    </div>
  );
}
