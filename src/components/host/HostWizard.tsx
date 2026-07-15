"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createVillaAction,
  updateAvatarAction,
  updateVillaAction,
  uploadImagesAction,
} from "@/lib/actions";
import { useMounted } from "@/lib/useMounted";
import { isRoomBased } from "@/lib/rooms";
import { isAtLeastAge, toDateInput } from "@/lib/dates";
import DateOfBirthField from "@/components/ui/DateOfBirthField";
import SignInGate from "@/components/account/SignInGate";
import {
  DEFAULT_DRAFT,
  FACILITY_CHIPS,
  MAX_VILLA_IMAGES,
  MIN_VILLA_IMAGES,
  SERVICES,
  type Draft,
} from "./draft";

const STEPS = [
  "Personal Details",
  "Villa Details",
  "Add Images",
  "Extra Services",
  "Pricing",
  "Payment Method",
] as const;

const DRAFT_KEY = "myvilla.hostDraft";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shown when the host tries to leave a section (or the page) with edits they
// haven't saved. Each section saves on its own, so leaving loses only that
// section's in-progress changes.
const DISCARD_MSG =
  "You have unsaved changes in this section. Leave without saving? Your changes here will be lost.";

// Shown when the host abandons the add-villa wizard before finishing — the villa
// is only created on the final step, so leaving submits nothing.
const LEAVE_MSG =
  "Leave without finishing? The villa details you've entered won't be saved.";

const label = "mb-2 block text-[16px] text-brand";
const input =
  "block w-full rounded-[8px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-[#9d9da6] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// Numeric-only fields (area, rooms, guests): strip anything that
// isn't a digit as the guest types, so letters can never be entered. Works on
// uncontrolled inputs (defaultValue + FormData) by correcting the DOM value.
function onlyDigits(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const cleaned = el.value.replace(/\D/g, "");
  if (cleaned !== el.value) el.value = cleaned;
}

/** "1111222233334444" → "1111 2222 3333 4444" (max 19 digits) — matches the
 * guest payment page so the host's card number reads the same way. */
const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {children}
    </p>
  );
}

function SaveAndNext({ children = "Save and Next" }: { children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex justify-end">
      <button
        type="submit"
        className="rounded-[8px] bg-brand px-7 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        {children}
      </button>
    </div>
  );
}

/* ---------------- Stepper ---------------- */

function Stepper({
  current,
  minStep = 0,
  onSelect,
}: {
  current: number;
  minStep?: number;
  /** When provided (edit mode), sections become clickable. */
  onSelect?: (i: number) => void;
}) {
  const interactive = !!onSelect;
  // Drop any steps before minStep entirely and renumber from 1 — they aren't
  // part of the flow (Personal Details is skipped both when editing a villa and
  // when a returning host adds one whose profile is already complete).
  const visible = STEPS.map((title, i) => ({ title, i })).filter(
    ({ i }) => i >= minStep,
  );
  return (
    <ol className="flex flex-row flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-0">
      {visible.map(({ title, i }, pos) => {
        const active = i === current;
        const done = i <= current;
        const isLast = pos === visible.length - 1;
        const marker = (
          <div className="flex flex-col items-center">
            <span
              className={`flex h-[29px] w-[29px] items-center justify-center rounded-full text-[15px] font-medium text-white ${
                done ? "bg-brand" : "bg-[#c4c4c4]"
              }`}
            >
              {pos + 1}
            </span>
            {!isLast && (
              <span
                aria-hidden="true"
                className="hidden h-[10px] w-px bg-[#c4c4c4] lg:block"
              />
            )}
          </div>
        );
        const labelText = (
          <span
            className={`pt-0.5 text-[18px] ${
              done ? "font-medium text-brand" : "text-[#121212]"
            } ${interactive && active ? "underline underline-offset-4" : ""}`}
          >
            {title}
          </span>
        );
        return (
          <li key={title} className="lg:w-full">
            {interactive ? (
              <button
                type="button"
                onClick={() => onSelect!(i)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-start gap-[18px] text-left ${
                  active ? "" : "hover:opacity-60"
                }`}
              >
                {marker}
                {labelText}
              </button>
            ) : (
              <div className="flex items-start gap-[18px]">
                {marker}
                {labelText}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Step 1: Personal Details ---------------- */

function StepPersonal({
  draft,
  avatarUrl,
  onNext,
}: {
  draft: Draft;
  avatarUrl?: string;
  onNext: (d: Partial<Draft>) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [avatar, setAvatar] = useState<string | null>(
    avatarUrl || "/images/host/avatar.png",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function changeAvatar(file: File) {
    setAvatar(URL.createObjectURL(file)); // instant preview; persists below
    const data = new FormData();
    data.append("avatar", file);
    await updateAvatarAction(data);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const next: typeof errors = {};
    const personal = {
      fullName: get("fullName"),
      gender: get("gender"),
      email: get("email"),
      dob: get("dob"),
      address: get("address"),
    };
    if (!personal.fullName) next.fullName = "Full name is required.";
    if (!personal.gender) next.gender = "Please select your gender.";
    if (!personal.email) next.email = "Email address is required.";
    else if (!EMAIL_RE.test(personal.email)) next.email = "Enter a valid email address.";
    if (!personal.dob) next.dob = "Date of birth is required.";
    else if (!isAtLeastAge(personal.dob)) next.dob = "You must be at least 18 years old.";
    if (!personal.address) next.address = "Address is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onNext({ personal });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        First time hosting? You must add your personal details first to start
        hosting
      </h2>
      <div className="mt-6 flex flex-col-reverse gap-8 sm:flex-row">
        <div className="flex-1 space-y-4">
          <div>
            <label htmlFor="h-fullName" className={label}>Full name</label>
            <input
              id="h-fullName"
              name="fullName"
              defaultValue={draft.personal.fullName}
              placeholder="Add Full name"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              className={input}
            />
            {errors.fullName && <ErrorText>{errors.fullName}</ErrorText>}
          </div>
          <div>
            <label htmlFor="h-gender" className={label}>Gender</label>
            <select
              id="h-gender"
              name="gender"
              defaultValue={draft.personal.gender}
              aria-invalid={!!errors.gender}
              className={input}
            >
              <option value="" disabled>Select your gender.</option>
              {["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            {errors.gender && <ErrorText>{errors.gender}</ErrorText>}
          </div>
          <div>
            <label htmlFor="h-email" className={label}>
              Email Address{" "}
              <span className="text-[#9d9da6]">(can&apos;t be changed)</span>
            </label>
            {/* Email is fixed at signup — shown for reference, not editable. */}
            <input
              id="h-email"
              name="email"
              type="email"
              defaultValue={draft.personal.email}
              readOnly
              tabIndex={-1}
              autoComplete="email"
              aria-invalid={!!errors.email}
              className={`${input} cursor-not-allowed border-[#d9d9d9] bg-[#f3f3f3] text-[#6b6b6b] focus:border-[#d9d9d9] focus:ring-0`}
            />
            {errors.email && <ErrorText>{errors.email}</ErrorText>}
          </div>
          <div>
            <label htmlFor="h-dob" className={label}>Date of Birth</label>
            <DateOfBirthField
              id="h-dob"
              name="dob"
              defaultValue={toDateInput(draft.personal.dob)}
              ariaInvalid={!!errors.dob}
              triggerClassName={input}
              placeholder="Add date of birth"
            />
            {errors.dob && <ErrorText>{errors.dob}</ErrorText>}
          </div>
          <div>
            <label htmlFor="h-address" className={label}>Address</label>
            <input
              id="h-address"
              name="address"
              defaultValue={draft.personal.address}
              placeholder="Not Provided"
              autoComplete="street-address"
              aria-invalid={!!errors.address}
              className={input}
            />
            {errors.address && <ErrorText>{errors.address}</ErrorText>}
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
            className="w-32 text-center text-[13px] text-ink underline"
          >
            Upload your profile picture
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void changeAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <SaveAndNext />
    </form>
  );
}

/* ---------------- Step 2: Villa Details ---------------- */

const VILLA_KINDS = ["Villa Living", "Combinative Villa", "Hotel", "Resort", "Bungalow", "Others (specify)"];

function VillaMapPreview() {
  return (
    <div className="relative h-[330px] w-full overflow-hidden rounded-[10px]" aria-label="Choose your villa location on the map">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/place/map.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/place/map-home.svg"
        alt="Villa location marker"
        className="absolute left-[6%] top-[22%] w-[110px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/place/map-zoom.svg"
        alt="Map zoom controls"
        className="absolute right-3 top-2 w-10"
      />
    </div>
  );
}

function StepVilla({
  draft,
  onNext,
  submitLabel = "Save and Next",
}: {
  draft: Draft;
  onNext: (d: Partial<Draft>) => void;
  submitLabel?: string;
}) {
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [kind, setKind] = useState(draft.villa.kind);
  // Hotels/resorts book by the room, so they collect "people per room" instead
  // of a single whole-property guest cap.
  const roomBased = isRoomBased(kind);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const rooms = get("rooms");
    const peoplePerRoom = get("peoplePerRoom");
    const villa = {
      kind,
      name: get("name"),
      description: get("description"),
      area: get("area"),
      address: get("address"),
      city: get("city"),
      rooms,
      // For hotels/resorts total capacity is rooms × people-per-room.
      maxGuests: roomBased
        ? String((Number(rooms) || 0) * (Number(peoplePerRoom) || 0))
        : get("maxGuests"),
      peoplePerRoom: roomBased ? peoplePerRoom : "",
      // Facilities are picked on the Extra Services step.
      facilities: draft.villa.facilities,
    };
    const next: typeof errors = {};
    if (!villa.name) next.name = "Villa name is required.";
    if (!villa.area || !/^\d+$/.test(villa.area))
      next.area = "Enter the build-up area in square yards (numbers only).";
    if (!villa.address) next.address = "Villa address is required.";
    if (!villa.city) next.city = "City is required.";
    if (!villa.rooms || !/^\d+$/.test(villa.rooms)) next.rooms = "Enter the number of rooms.";
    if (roomBased) {
      if (!peoplePerRoom || !/^\d+$/.test(peoplePerRoom) || Number(peoplePerRoom) < 1)
        next.peoplePerRoom = "Enter how many guests each room sleeps (at least 1).";
    } else if (!villa.maxGuests || !/^\d+$/.test(villa.maxGuests) || Number(villa.maxGuests) < 1) {
      next.maxGuests = "Enter the maximum number of guests (at least 1).";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onNext({ villa });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        What kind of a villa are you hosting?
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {VILLA_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
              kind === k
                ? "bg-brand text-white"
                : "border border-brand text-brand hover:bg-brand/5"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <h3 className="mt-7 text-[17px] font-bold text-ink">Details</h3>
      <div className="mt-3 space-y-4">
        <div>
          <label htmlFor="v-name" className={label}>Name of your Villa</label>
          <input
            id="v-name"
            name="name"
            defaultValue={draft.villa.name}
            placeholder="Complete Name"
            aria-invalid={!!errors.name}
            className={input}
          />
          {errors.name && <ErrorText>{errors.name}</ErrorText>}
        </div>
        <div>
          <label htmlFor="v-description" className={label}>
            Describe your Villa (Max 150 words)
          </label>
          <textarea
            id="v-description"
            name="description"
            defaultValue={draft.villa.description}
            placeholder="Description"
            rows={3}
            className={`${input} resize-none`}
          />
        </div>
        <div>
          <label htmlFor="v-area" className={label}>Villa Dimensions</label>
          <input
            id="v-area"
            name="area"
            defaultValue={draft.villa.area}
            placeholder="Total Build up Area (in Square Yards)"
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={onlyDigits}
            aria-invalid={!!errors.area}
            className={input}
          />
          {errors.area && <ErrorText>{errors.area}</ErrorText>}
        </div>
        <div>
          <label htmlFor="v-address" className={label}>Villa Address</label>
          <input
            id="v-address"
            name="address"
            defaultValue={draft.villa.address}
            placeholder="Registered Address of Villa"
            aria-invalid={!!errors.address}
            className={input}
          />
          {errors.address && <ErrorText>{errors.address}</ErrorText>}
        </div>
        <div>
          <label htmlFor="v-city" className={label}>City</label>
          <input
            id="v-city"
            name="city"
            defaultValue={draft.villa.city}
            placeholder="City where the Villa is located"
            aria-invalid={!!errors.city}
            className={input}
          />
          {errors.city && <ErrorText>{errors.city}</ErrorText>}
        </div>
        <div>
          <label htmlFor="v-rooms" className={label}>Number of Rooms</label>
          <input
            id="v-rooms"
            name="rooms"
            defaultValue={draft.villa.rooms}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={onlyDigits}
            placeholder="e.g. 3"
            aria-invalid={!!errors.rooms}
            className={input}
          />
          {errors.rooms && <ErrorText>{errors.rooms}</ErrorText>}
        </div>
        {roomBased ? (
          <div>
            <label htmlFor="v-peoplePerRoom" className={label}>
              Guests per Room
            </label>
            <input
              id="v-peoplePerRoom"
              name="peoplePerRoom"
              key="peoplePerRoom"
              defaultValue={draft.villa.peoplePerRoom}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={onlyDigits}
              placeholder="How many guests fit in one room? e.g. 2"
              aria-invalid={!!errors.peoplePerRoom}
              className={input}
            />
            {errors.peoplePerRoom ? (
              <ErrorText>{errors.peoplePerRoom}</ErrorText>
            ) : (
              <p className="mt-1 text-xs text-body">
                Guests book individual rooms — total capacity is rooms × guests
                per room.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="v-maxGuests" className={label}>
              Maximum Number of Guests
            </label>
            <input
              id="v-maxGuests"
              name="maxGuests"
              key="maxGuests"
              defaultValue={draft.villa.maxGuests}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={onlyDigits}
              placeholder="How many guests can stay? e.g. 6"
              aria-invalid={!!errors.maxGuests}
              className={input}
            />
            {errors.maxGuests && <ErrorText>{errors.maxGuests}</ErrorText>}
          </div>
        )}
      </div>

      <h3 className="mt-7 mb-3 text-[15px] font-semibold text-brand">
        Villa Location on Map
      </h3>
      <VillaMapPreview />

      <SaveAndNext>{submitLabel}</SaveAndNext>
    </form>
  );
}

/* ---------------- Step 3: Add Images ---------------- */

function StepImages({
  draft,
  onNext,
  submitLabel = "Save and Next",
}: {
  draft: Draft;
  onNext: (d: Partial<Draft>) => void;
  submitLabel?: string;
}) {
  const [images, setImages] = useState<string[]>(draft.images);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: File[]) {
    // Every file must be an image — reject the whole batch if any isn't, so a
    // stray PDF/video can't slip through (checked again server-side on save).
    const notImage = files.find((f) => !f.type.startsWith("image/"));
    if (notImage) {
      setError(
        `"${notImage.name}" isn't an image. Only image files (JPG, PNG, WEBP, GIF or AVIF) are allowed.`,
      );
      return;
    }
    if (images.length + files.length > MAX_VILLA_IMAGES) {
      const room = MAX_VILLA_IMAGES - images.length;
      setError(
        `You can upload at most ${MAX_VILLA_IMAGES} images. You have ${images.length}` +
          (room > 0 ? ` — add up to ${room} more.` : ` — remove some first.`),
      );
      return;
    }
    setUploading(true);
    setError("");
    const data = new FormData();
    for (const f of files) data.append("files", f);
    const result = await uploadImagesAction(data);
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setImages((cur) => [...cur, ...result.paths]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (images.length < MIN_VILLA_IMAGES) {
      const short = MIN_VILLA_IMAGES - images.length;
      setError(
        `Please add at least ${MIN_VILLA_IMAGES} images of your villa — you have ${images.length}, add ${short} more.`,
      );
      return;
    }
    if (images.length > MAX_VILLA_IMAGES) {
      setError(
        `You can upload at most ${MAX_VILLA_IMAGES} images — remove ${images.length - MAX_VILLA_IMAGES}.`,
      );
      return;
    }
    setError("");
    onNext({ images });
  }

  const atMax = images.length >= MAX_VILLA_IMAGES;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        Add clear and sharp images of your villa.
      </h2>
      <p className="mt-1 text-sm text-body">
        Its better to show the images of facilities you&apos;re providing as well.
        <br />
        (Add {MIN_VILLA_IMAGES}–{MAX_VILLA_IMAGES} images — you&apos;ve added {images.length})
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="group relative h-32 overflow-hidden rounded-[6px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Villa photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
              className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1.5 1.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {!atMax && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-[6px] border border-[#d9d9d9] text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <circle cx="13" cy="13" r="11.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13 8.5v9M8.5 13h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="text-xs">{uploading ? "Uploading…" : "Add photo"}</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void addFiles(files);
          e.target.value = "";
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}

      <SaveAndNext>{submitLabel}</SaveAndNext>
    </form>
  );
}

/* ---------------- Step 4: Extra Services ---------------- */

function StepServices({
  draft,
  onNext,
  submitLabel = "Save and Next",
}: {
  draft: Draft;
  onNext: (d: Partial<Draft>) => void;
  submitLabel?: string;
}) {
  // One uniform list — every row (service or facility) has a checkbox and a
  // price box. Selections split apart on save: facility-type picks stay
  // searchable amenities, and anything with a price becomes a chargeable extra.
  const customFacilities = draft.villa.facilities.filter(
    (f) => !FACILITY_CHIPS.includes(f) && !SERVICES.includes(f),
  );
  // Owner-added services; old drafts stored one free-text service in `custom`.
  const legacyCustom = (draft.services.custom ?? "").trim();
  const [customServices, setCustomServices] = useState<string[]>(() => {
    const list = draft.services.customs ?? [];
    return legacyCustom && !list.includes(legacyCustom)
      ? [...list, legacyCustom]
      : list;
  });
  const saved = [
    ...new Set([
      ...draft.services.selected,
      ...(legacyCustom ? [legacyCustom] : []),
      ...draft.villa.facilities,
    ]),
  ];
  const [selected, setSelected] = useState<string[]>(
    saved.length
      ? saved
      : ["Free Cancellation before a week", "Free Wifi", "Long Stays"],
  );
  const [prices, setPrices] = useState<Record<string, string>>(
    draft.services.prices ?? {},
  );
  const [newService, setNewService] = useState("");

  const serviceRows = [...SERVICES, ...customServices];
  const facilityRows = [
    ...FACILITY_CHIPS.filter((f) => !SERVICES.includes(f)),
    ...customFacilities,
  ];

  function toggle(name: string) {
    setSelected((cur) =>
      cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
    );
  }

  function addService() {
    const name = newService.trim();
    if (name && !serviceRows.includes(name) && !facilityRows.includes(name)) {
      setCustomServices((cur) => [...cur, name]);
      setSelected((cur) => [...cur, name]);
    }
    setNewService("");
  }

  const priceNum = (name: string) => parseFloat(prices[name] ?? "") || 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const facilityNames = selected.filter(
      (f) => FACILITY_CHIPS.includes(f) || customFacilities.includes(f),
    );
    const serviceNames = selected.filter((s) => serviceRows.includes(s));
    onNext({
      services: {
        // Service-type picks, plus any facility the owner put a price on — a
        // priced facility becomes a chargeable extra too. Free facilities stay
        // amenities only (in villa.facilities below), so they don't clutter the
        // guest's checkout with $0 rows.
        selected: [
          ...serviceNames,
          ...facilityNames.filter(
            (f) => priceNum(f) > 0 && !serviceNames.includes(f),
          ),
        ],
        prices,
        customs: customServices,
        custom: "",
      },
      // Facility-type picks stay searchable amenities + villa-page icons.
      villa: { ...draft.villa, facilities: facilityNames },
    });
  }

  // Every row — services and facilities alike — renders with a price box.
  const PricedRow = (name: string) => (
    <div key={name} className="flex items-center gap-3">
      <label className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-body">
        <input
          type="checkbox"
          checked={selected.includes(name)}
          onChange={() => toggle(name)}
          className="checkbox-brand"
        />
        {name}
      </label>
      <label className="flex shrink-0 items-center gap-1 rounded-[6px] border border-[#d9d9d9] bg-white px-2.5 py-1.5 text-sm text-body focus-within:border-brand">
        <span className="sr-only">Price for {name} (leave empty if free)</span>
        <span aria-hidden className="text-[#9d9da6]">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={prices[name] ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, "");
            setPrices((cur) => ({ ...cur, [name]: v }));
          }}
          placeholder="Free"
          className="w-16 bg-transparent focus:outline-none"
        />
      </label>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        Select the extra services you would be providing to your guests.
      </h2>
      <p className="mt-2 text-sm text-body">
        Set a price to charge guests for a service — leave it empty and the
        service is free.
      </p>

      <div className="mt-5 flex max-w-xl flex-col gap-y-3.5">
        {[...serviceRows, ...facilityRows].map((name) => PricedRow(name))}

        <div className="mt-1.5 flex items-center gap-3">
          <input
            type="text"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addService();
              }
            }}
            placeholder="Add your own service"
            aria-label="Add your own service"
            className={input}
          />
          <button
            type="button"
            onClick={addService}
            className="shrink-0 rounded-[8px] border border-brand px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            Add Service
          </button>
        </div>
      </div>

      <SaveAndNext>{submitLabel}</SaveAndNext>
    </form>
  );
}

/* ---------------- Step 5: Pricing ---------------- */

function StepPricing({
  draft,
  onNext,
  submitLabel = "Save and Next",
}: {
  draft: Draft;
  onNext: (d: Partial<Draft>) => void;
  submitLabel?: string;
}) {
  const [price, setPrice] = useState(draft.price);
  const [discount, setDiscount] = useState(draft.discount);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!price || price <= 0) {
      setError("Please set a nightly price for your villa.");
      return;
    }
    setError("");
    onNext({ price, discount: Math.min(90, Math.max(0, Math.trunc(discount) || 0)) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        Set your price according to your place.
      </h2>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-body">You are offering</span>
            <button
              type="button"
              aria-label="Increase price"
              onClick={() => setPrice((p) => p + 5)}
              className="text-xl font-bold text-brand"
            >
              +
            </button>
            <span className="rounded-md border border-brand px-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Price per night in dollars"
                value={`$${price}`}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setPrice(Number.isNaN(n) ? 0 : n);
                }}
                className="w-20 bg-transparent py-1.5 text-center text-[15px] font-semibold text-muted focus:outline-none"
              />
            </span>
            <button
              type="button"
              aria-label="Decrease price"
              onClick={() => setPrice((p) => Math.max(5, p - 5))}
              className="text-2xl font-bold text-brand"
            >
              −
            </button>
            <span className="text-sm text-body">per night for your villa!</span>
          </div>
          {error && <ErrorText>{error}</ErrorText>}

          <p className="mt-5 flex items-center gap-2 text-xs text-body">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-brand">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7.2v6M12 16.4v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Places like yours have an average price range from $130 to $200.
          </p>

          <div className="mt-7 flex items-center gap-3">
            <span className="text-sm text-body">Offer a discount of</span>
            <button
              type="button"
              aria-label="Decrease discount"
              onClick={() => setDiscount((d) => Math.max(0, d - 5))}
              className="text-2xl font-bold text-brand"
            >
              −
            </button>
            <span className="rounded-md border border-brand px-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Discount percentage"
                value={`${discount}%`}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setDiscount(Number.isNaN(n) ? 0 : Math.min(90, n));
                }}
                className="w-16 bg-transparent py-1.5 text-center text-[15px] font-semibold text-muted focus:outline-none"
              />
            </span>
            <button
              type="button"
              aria-label="Increase discount"
              onClick={() => setDiscount((d) => Math.min(90, d + 5))}
              className="text-xl font-bold text-brand"
            >
              +
            </button>
            <span className="text-sm text-body">off the nightly price</span>
          </div>
          {discount > 0 && (
            <p className="mt-2 text-xs text-brand">
              Guests will see ${Math.round(price * (1 - discount / 100))}/night after
              the {discount}% discount.
            </p>
          )}
        </div>

        <div className="relative max-w-56">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="absolute -top-7 left-1/2 -translate-x-1/2 text-brand">
            <path
              d="M12 2.5a6.5 6.5 0 00-3.6 11.9c.6.4 1 1 1.1 1.7l.1.9h4.8l.1-.9c.1-.7.5-1.3 1.1-1.7A6.5 6.5 0 0012 2.5zM9.8 19.5h4.4M10.6 21.5h2.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="rounded-md border border-line/60 bg-white px-4 py-3 text-xs leading-relaxed text-body shadow-sm">
            Offer discount to your first 3 guests to help your villa get booked
            faster!
          </p>
        </div>
      </div>

      <SaveAndNext>{submitLabel}</SaveAndNext>
    </form>
  );
}

/* ---------------- Step 6: Payment Method ---------------- */

const PAY_METHODS = ["Mastercard", "G Pay", "PayPal", "VISA"];

const PAY_LOGO_FILES: Record<string, { src: string; h: string }> = {
  Mastercard: { src: "/images/pay/mastercard.png", h: "h-8" },
  "G Pay": { src: "/images/pay/gpay.png", h: "h-7" },
  PayPal: { src: "/images/pay/paypal.png", h: "h-6" },
  VISA: { src: "/images/pay/visa.png", h: "h-4" },
};

function PayLogo({ method }: { method: string }) {
  const logo = PAY_LOGO_FILES[method] ?? PAY_LOGO_FILES.VISA;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={logo.src} alt={method} className={`${logo.h} w-auto`} />
  );
}

function StepPayment({
  draft,
  onNext,
  submitLabel = "Host your Villa",
}: {
  draft: Draft;
  onNext: (d: Partial<Draft>) => void;
  submitLabel?: string;
}) {
  const [methods, setMethods] = useState<string[]>(draft.payment.methods);
  const [cardNumber, setCardNumber] = useState(() =>
    formatCardNumber(draft.payment.cardNumber),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const accountType = String(data.get("accountType") ?? "");
    const cardNumber = String(data.get("cardNumber") ?? "").replace(/[\s-]/g, "");
    const next: typeof errors = {};
    if (methods.length === 0)
      next.methods = "Select at least one way for guests to pay you.";
    if (!accountType) next.accountType = "Please choose an account type.";
    if (!cardNumber) next.cardNumber = "Account / card number is required.";
    else if (!/^\d{8,19}$/.test(cardNumber))
      next.cardNumber = "Enter a valid account or card number.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onNext({ payment: { methods, accountType, cardNumber } });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-[17px] font-bold text-ink">
        Add payment method for guests.
      </h2>
      <p className="mt-3 text-sm text-body">Guests can pay using:</p>

      <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
        {PAY_METHODS.map((m) => (
          <label
            key={m}
            className={`flex h-11 cursor-pointer items-center gap-3 rounded-[8px] border-[1.5px] bg-white px-3 ${
              methods.includes(m) ? "border-brand" : "border-line"
            }`}
          >
            <input
              type="checkbox"
              checked={methods.includes(m)}
              onChange={() =>
                setMethods((cur) =>
                  cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
                )
              }
              className="checkbox-brand"
            />
            <PayLogo method={m} />
          </label>
        ))}
      </div>
      {errors.methods && <ErrorText>{errors.methods}</ErrorText>}

      <h3 className="mt-7 text-[15px] font-bold text-ink">
        Add your account details:
      </h3>
      <p className="mt-1 text-xs text-body">
        Payments from your guests will be transferred to this account.
      </p>
      <div className="mt-3 max-w-2xl space-y-4">
        <div className="relative">
          <select
            name="accountType"
            defaultValue={draft.payment.accountType || "Credit Card or Debit Card"}
            aria-label="Account type"
            aria-invalid={!!errors.accountType}
            className={`${input} appearance-none pr-12`}
          >
            {["Credit Card or Debit Card", "Bank Account", "PayPal Account"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body">
            <path d="M1 1.5l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {errors.accountType && <ErrorText>{errors.accountType}</ErrorText>}
        <div>
          <input
            name="cardNumber"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1111 1111 1111 1111"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={23}
            aria-label="Card or account number"
            aria-invalid={!!errors.cardNumber}
            className={input}
          />
          {errors.cardNumber && <ErrorText>{errors.cardNumber}</ErrorText>}
        </div>
      </div>

      <hr className="mt-7 max-w-2xl border-line/60" />
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-body">
        By clicking the button below, I agree to the{" "}
        <Link href="#" className="underline">Host&apos;s House Rules</Link>,{" "}
        <Link href="#" className="underline">MyVilla&apos;s COVID-19 Safety Requirements</Link>{" "}
        and the <Link href="#" className="underline">Guest Refund Policy.</Link>
      </p>

      <div className="mt-6">
        <button
          type="submit"
          className="rounded-[8px] bg-brand px-7 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Success ---------------- */

function SuccessView({ draft, edited }: { draft: Draft; edited?: boolean }) {
  const last4 = draft.payment.cardNumber.slice(-4);
  return (
    <div className="rounded-lg bg-white px-6 py-14 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
          <circle cx="19" cy="19" r="17" fill="#6c63ff" />
          <path d="M11.5 19.5l5 5 10-10.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="mt-6 text-2xl font-bold text-ink">
        {edited ? "Your villa has been updated!" : "Your villa has been registered!"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-body">
        {draft.villa.name ? (
          <>
            <span className="font-semibold">{draft.villa.name}</span> is now
            under review.{" "}
          </>
        ) : (
          "Your listing is now under review. "
        )}
        We&apos;ll notify you at{" "}
        <span className="font-semibold">{draft.personal.email || "your email"}</span>{" "}
        once it goes live. Guest payments will be transferred to your account
        {last4 ? ` ending in ${last4}` : ""}.
      </p>

      <dl className="mx-auto mt-8 max-w-sm space-y-2.5 rounded-lg border border-line/60 p-5 text-left text-sm">
        <div className="flex justify-between">
          <dt className="text-gray">Villa</dt>
          <dd className="font-semibold text-ink">{draft.villa.name || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray">Type</dt>
          <dd className="text-body">{draft.villa.kind}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray">Price</dt>
          <dd className="text-body">${draft.price}/night</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray">Payout account</dt>
          <dd className="text-body">{last4 ? `•••• ${last4}` : "—"}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="rounded-md border border-brand px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
        >
          Go to Home
        </Link>
        <Link
          href="/profile/properties"
          className="rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          View in My Property
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Wizard shell ---------------- */

export default function HostWizard({
  authed,
  initialPersonal,
  avatarUrl,
  editId,
  editDraft,
  skipPersonal = false,
}: {
  authed: boolean;
  initialPersonal?: Draft["personal"];
  avatarUrl?: string;
  /** When set, the wizard edits this villa instead of creating a new one. */
  editId?: number;
  editDraft?: Draft;
  /** Profile already has the personal details — start at Villa Details. */
  skipPersonal?: boolean;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const [submitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState("");
  // Personal details are only collected from first-time hosts; when editing a
  // villa or when the profile is already complete, the flow starts at step 1.
  const minStep = editId || skipPersonal ? 1 : 0;
  const [draft, setDraft] = useState<Draft>(() => {
    if (editId && editDraft) return { ...editDraft, step: minStep }; // editing: never load the local draft
    if (typeof window === "undefined") return DEFAULT_DRAFT;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const stored = { ...DEFAULT_DRAFT, ...JSON.parse(raw) } as Draft;
        return { ...stored, step: Math.max(stored.step, minStep) };
      }
    } catch {
      /* corrupted draft — start fresh */
    }
    // No draft yet — prefill personal details from the signed-in profile.
    const base = initialPersonal
      ? { ...DEFAULT_DRAFT, personal: { ...DEFAULT_DRAFT.personal, ...initialPersonal } }
      : DEFAULT_DRAFT;
    return { ...base, step: minStep };
  });
  const [done, setDone] = useState(false);
  // Edit mode only: confirmation shown after a section is saved in place.
  const [savedMsg, setSavedMsg] = useState("");
  // Edit mode only: the current section has edits that haven't been saved yet.
  const [dirty, setDirty] = useState(false);
  const markDirty = () => {
    setDirty(true);
    setSavedMsg("");
  };

  const buildVillaPayload = (m: Draft) => ({
    name: m.villa.name || "My Villa",
    kind: m.villa.kind,
    description: m.villa.description,
    area: m.villa.area,
    address: m.villa.address,
    city: m.villa.city,
    rooms: parseInt(m.villa.rooms, 10) || 1,
    maxGuests: parseInt(m.villa.maxGuests, 10) || 1,
    peoplePerRoom: parseInt(m.villa.peoplePerRoom, 10) || 0,
    facilities: m.villa.facilities,
    services: m.services.selected.map((name) => ({
      name,
      price: parseFloat(m.services.prices?.[name] ?? "") || 0,
    })),
    price: m.price,
    discount: m.discount,
    images: m.images,
  });

  // Create flow: walk the steps, persisting the new villa on the final step.
  function advance(patch: Partial<Draft>) {
    const merged = { ...draft, ...patch };

    if (draft.step === STEPS.length - 1) {
      if (submitting) return;
      startTransition(async () => {
        const result = await createVillaAction({
          ...buildVillaPayload(merged),
          hostProfile: merged.personal,
          payment: merged.payment,
        });
        if (!result.ok) {
          setSubmitError(result.error);
          return;
        }
        window.localStorage.removeItem(DRAFT_KEY);
        setSubmitError("");
        setDraft(merged);
        setDone(true);
        router.refresh();
        window.scrollTo({ top: 0 });
      });
      return;
    }

    const next = { ...merged, step: Math.min(draft.step + 1, STEPS.length - 1) };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    setDraft(next);
    window.scrollTo({ top: 0 });
  }

  // Edit flow: save the current section immediately and stay put, so the host
  // can jump to another section from the sidebar or leave.
  function saveSection(patch: Partial<Draft>) {
    if (!editId || submitting) return;
    const merged = { ...draft, ...patch };
    startTransition(async () => {
      const result = await updateVillaAction(
        editId,
        buildVillaPayload(merged),
        merged.payment,
      );
      if (!result.ok) {
        setSavedMsg("");
        setSubmitError(result.error);
        return;
      }
      setSubmitError("");
      setDirty(false);
      setDraft(merged);
      setSavedMsg(`${STEPS[draft.step]} saved.`);
      router.refresh();
      window.scrollTo({ top: 0 });
    });
  }

  // Edit flow: jump straight to any section from the sidebar, warning first if
  // the current section has unsaved edits.
  function goToStep(i: number) {
    if (i === draft.step) return;
    if (dirty && !window.confirm(DISCARD_MSG)) return;
    setDirty(false);
    setSavedMsg("");
    setSubmitError("");
    setDraft((cur) => ({ ...cur, step: i }));
    window.scrollTo({ top: 0 });
  }

  // Edit flow: leave the wizard entirely, warning first on unsaved edits.
  function leaveEditor(href: string) {
    if (dirty && !window.confirm(DISCARD_MSG)) return;
    setDirty(false);
    router.push(href);
  }

  // Create flow: leaving the add-villa wizard abandons it (nothing is submitted
  // until the final step). Warn if the host has entered anything, then discard
  // the saved draft so the warning holds true.
  function leaveWizard(href: string) {
    if (dirty) {
      if (!window.confirm(LEAVE_MSG)) return;
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setDirty(false);
    router.push(href);
  }

  function goBack() {
    setDraft((cur) => {
      const next = { ...cur, step: Math.max(minStep, cur.step - 1) };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
    window.scrollTo({ top: 0 });
  }

  // Edit mode: warn on tab close / refresh / hard navigation while a section
  // has unsaved edits. (Create mode auto-saves the draft to localStorage.)
  useEffect(() => {
    if (!editId || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editId, dirty]);

  if (!mounted) return <div className="min-h-[50vh]" aria-hidden="true" />;

  const step = draft.step;
  const editing = !!editId;
  const saveLabel = editing ? "Save" : "Save and Next";
  const onStep = editing ? saveSection : advance;

  return (
    <div>
      {/* The Figma "Add your Villa Login & Signup" screen shows only the card,
          without the breadcrumb / title row — so hide them until signed in. */}
      {authed && (
        <>
          <nav aria-label="Breadcrumb" className="text-[20px] leading-[1.2] text-ink">
            <Link href="/" className="underline">Home</Link>
            <span className="font-light">{"  /  "}</span>
            {editing ? (
              <>
                <Link href="/profile/properties" className="underline">My Properties</Link>
                <span className="font-light">{" / "}</span>
                <span>Edit Villa</span>
              </>
            ) : (
              <span>Host your Villa</span>
            )}
          </nav>

          <div className="mt-[30px] flex items-center justify-between">
            <h1 className="text-[28px] font-semibold leading-[1.3] text-black">
              {editId ? "Edit your Villa" : "Add your Villa"}
            </h1>
            {!editId && !done && step > minStep ? (
              <button
                type="button"
                onClick={goBack}
                className="text-[30px] leading-[1.35] text-black underline"
              >
                Back
              </button>
            ) : editId && !done ? (
              <button
                type="button"
                onClick={() => leaveEditor("/profile/properties")}
                className="text-[30px] leading-[1.35] text-black underline"
              >
                Back
              </button>
            ) : !editId && !done ? (
              <button
                type="button"
                onClick={() => leaveWizard("/")}
                className="text-[30px] leading-[1.35] text-black underline"
              >
                Back
              </button>
            ) : (
              <Link
                href={editId ? "/profile/properties" : "/"}
                className="text-[30px] leading-[1.35] text-black underline"
              >
                Back
              </Link>
            )}
          </div>
          {editId && !done && (
            <p className="mt-2 text-[15px] leading-relaxed text-body">
              Pick any section on the left to edit it, then{" "}
              <span className="font-semibold">Save</span>. Each section saves on
              its own — your changes go live right away.
            </p>
          )}
        </>
      )}

      <div className="mt-6">
        {!authed ? (
          <SignInGate
            title="To add your villa you must be signed in first."
            subtitle="Login to your account to start hosting right now!"
          />
        ) : done ? (
          <SuccessView draft={draft} edited={!!editId} />
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="shrink-0 lg:w-56">
              <Stepper
                current={step}
                minStep={minStep}
                onSelect={editing ? goToStep : undefined}
              />
            </div>
            <div
              className="min-w-0 flex-1 rounded-[10px] bg-white p-6 shadow-[0px_15px_50px_0px_rgba(0,0,0,0.08)] sm:p-8"
              // Any field edit (change bubbles) or control-button click inside a
              // step marks the wizard dirty — drives the unsaved warning on exit
              // (per-section in edit mode, whole-flow when adding a new villa).
              onChange={markDirty}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button[type="button"]'))
                  markDirty();
              }}
            >
              {submitError && (
                <p role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {submitError}
                </p>
              )}
              {savedMsg && (
                <p role="status" className="mb-4 rounded-md bg-brand/10 px-4 py-2.5 text-sm text-brand-dark">
                  {savedMsg} Choose another section on the left to keep editing.
                </p>
              )}
              {step === 0 && (
                <StepPersonal draft={draft} avatarUrl={avatarUrl} onNext={advance} />
              )}
              {step === 1 && (
                <StepVilla draft={draft} onNext={onStep} submitLabel={saveLabel} />
              )}
              {step === 2 && <StepImages draft={draft} onNext={onStep} submitLabel={saveLabel} />}
              {step === 3 && <StepServices draft={draft} onNext={onStep} submitLabel={saveLabel} />}
              {step === 4 && <StepPricing draft={draft} onNext={onStep} submitLabel={saveLabel} />}
              {step === 5 && (
                <StepPayment
                  draft={draft}
                  onNext={onStep}
                  submitLabel={editing ? "Save" : "Host your Villa"}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
