"use server";

import { randomBytes } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getDb, tx, type UserRow } from "./db";
import { addDays, formatRange, isAtLeastAge, nightsBetween, parseDay } from "./dates";
import { bookingReference } from "./pricing";
import { parsePackageType, presetNights, presetDiscount } from "./packageTypes";
import {
  getPackageById,
  isVillaAvailable,
  parsePackage,
  parseServiceList,
} from "./queries";
import { isRoomBased, roomCapacity, roomsForGuests } from "./rooms";
import { hashPasswordSync, verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";
import { appBaseUrl, sendEmail } from "./email";
import { clientIp, rateLimit } from "./rateLimit";
import { MAX_VILLA_IMAGES, MIN_VILLA_IMAGES } from "@/components/host/draft";

export type ActionResult = { ok: true } | { ok: false; error: string };

const TOO_MANY = "Too many attempts. Please wait a minute and try again.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (error: string) => ({ ok: false as const, error });

function revalidateVillaViews() {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/place");
  revalidatePath("/profile/properties");
}

/* ------------------------------ auth ------------------------------ */

export async function registerAction(formData: FormData): Promise<ActionResult> {
  if (!rateLimit(`register:${await clientIp()}`, 5, 60_000)) return fail(TOO_MANY);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phoneCode = String(formData.get("phoneCode") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const country = String(formData.get("country") ?? "");

  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (password.length < 8)
    return fail("Password must be at least 8 characters.");

  const db = getDb();
  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing) return fail("An account with this email already exists.");

  const userId = (
    await db
      .prepare(
        `INSERT INTO users (email, password_hash, phone_code, phone_number, country)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .run(email, hashPasswordSync(password), phoneCode, phoneNumber, country)
  ).lastInsertRowid as number;

  await createSession(userId);
  return { ok: true };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  if (!rateLimit(`login:${await clientIp()}`, 10, 60_000)) return fail(TOO_MANY);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = (await getDb()
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email)) as Pick<UserRow, "id" | "password_hash"> | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail("Incorrect email or password.");
  }

  await createSession(user.id);
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}

export async function recoverAction(formData: FormData): Promise<ActionResult> {
  if (!rateLimit(`recover:${await clientIp()}`, 5, 60_000)) return fail(TOO_MANY);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");

  const user = (await getDb()
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email)) as Pick<UserRow, "id"> | undefined;

  // Only send a link if the account exists, but ALWAYS return the same generic
  // success so this endpoint can't be used to enumerate registered emails.
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await getDb()
      .prepare(
        "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)",
      )
      .run(token, user.id, expires.toISOString());

    // The token is emailed to the ACCOUNT OWNER — never handed back to the
    // requester — so possession of an email address alone can't reset a
    // password. (Dev: the link is printed to the server console.)
    const link = `${await appBaseUrl()}/recover/reset?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your MyVilla password",
      text:
        `We received a request to reset your MyVilla password.\n\n` +
        `Reset it here (valid for 15 minutes):\n${link}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
    });
  }

  return { ok: true };
}

export async function resetPasswordAction(
  token: string,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return fail("Password must be at least 8 characters.");
  if (!token) return fail("Invalid or expired reset link. Start over.");

  const db = getDb();
  const reset = (await db
    .prepare(
      "SELECT user_id FROM password_resets WHERE token = ? AND expires_at > ?",
    )
    .get(token, new Date().toISOString())) as { user_id: number } | undefined;
  if (!reset) return fail("Invalid or expired reset link. Start over.");

  // Set the password, consume the token, and revoke every existing session for
  // the account (a reset should log out anyone already signed in) — atomically.
  try {
    await tx(async () => {
      await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        hashPasswordSync(password),
        reset.user_id,
      );
      await db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(
        reset.user_id,
      );
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
    });
  } catch {
    return fail("Something went wrong resetting your password. Please try again.");
  }
  return { ok: true };
}

/* ----------------------------- profile ---------------------------- */

export async function updateProfileAction(profile: {
  fullName: string;
  gender: string;
  dob: string;
  address: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (profile.dob.trim() && !isAtLeastAge(profile.dob))
    return fail("You must be at least 18 years old.");

  const db = getDb();
  // Email is fixed at signup and can't be edited from the app — it's never
  // updated here, so an account's login email always stays what they registered.
  await db.prepare(
    `UPDATE users
     SET full_name = ?, gender = ?, dob = ?, address = ?
     WHERE id = ?`,
  ).run(
    profile.fullName.trim(),
    profile.gender,
    profile.dob.trim(),
    profile.address.trim(),
    user.id,
  );
  revalidatePath("/profile", "layout");
  return { ok: true };
}

export async function setHostingModeAction(
  enabled: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (!enabled) {
    const owns = (await getDb()
      .prepare("SELECT COUNT(*) AS n FROM villas WHERE owner_id = ?")
      .get(user.id)) as { n: number };
    if (owns.n > 0) {
      return fail(
        "You still have listed villas. Remove them from My Property first.",
      );
    }
  }

  await getDb()
    .prepare("UPDATE users SET hosting_enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, user.id);
  revalidatePath("/profile", "layout");
  return { ok: true };
}

export async function completeGuestProfileAction(input: {
  fullName: string;
  gender: string;
  dob: string;
  address: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (!input.fullName.trim()) return fail("Full name is required.");
  const dob = parseDay(input.dob);
  if (!dob) return fail("Please enter a valid date of birth.");
  const age =
    (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 18) return fail("You must be at least 18 years old to book stays.");
  if (age > 120) return fail("Please enter a valid date of birth.");
  if (!input.address.trim()) return fail("Home address is required.");

  await getDb()
    .prepare(
      `UPDATE users SET full_name = ?, gender = ?, dob = ?, address = ?
       WHERE id = ?`,
    )
    .run(
      input.fullName.trim(),
      input.gender,
      input.dob,
      input.address.trim(),
      user.id,
    );
  revalidatePath("/profile", "layout");
  return { ok: true };
}

/* ----------------------------- villas ----------------------------- */

type VillaInput = {
  name: string;
  kind: string;
  description: string;
  area: string;
  address: string;
  city: string;
  rooms: number;
  bathrooms: number;
  maxGuests: number;
  /** Hotels/resorts: max occupancy of one room (0 for whole-villa kinds). */
  peoplePerRoom?: number;
  facilities: string[];
  /** Extra services with the per-stay price the owner charges (0 = free). */
  services: { name: string; price: number }[];
  price: number;
  /** Host-set % off the nightly price (0–90). */
  discount?: number;
  images?: string[];
};

/** The host's payout details as collected on the wizard's Payment step. */
type PaymentInput = {
  methods: string[];
  accountType: string;
  cardNumber: string;
};

/** Group a card/account number into 4-digit blocks for storage/display. */
const groupCard = (raw: string) =>
  String(raw ?? "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

/** Persist the host's payout details on their user row. No-op when no card was
 *  entered, so saving an unrelated section never wipes a stored card. */
async function saveHostPayment(
  db: ReturnType<typeof getDb>,
  userId: number,
  payment: PaymentInput | undefined,
): Promise<void> {
  if (!payment || !groupCard(payment.cardNumber)) return;
  await db
    .prepare(
      "UPDATE users SET pay_methods = ?, pay_account_type = ?, card_number = ? WHERE id = ?",
    )
    .run(
      JSON.stringify(payment.methods ?? []),
      payment.accountType ?? "",
      groupCard(payment.cardNumber),
      userId,
    );
}

/** Drop empty names, clamp prices to a sane non-negative amount (0 = free). */
function normalizeServices(
  services: VillaInput["services"] | undefined,
): { name: string; price: number }[] {
  return (services ?? [])
    .map((s) => ({
      name: String(s.name ?? "").trim(),
      price:
        Number.isFinite(Number(s.price)) && Number(s.price) > 0
          ? Math.round(Number(s.price) * 100) / 100
          : 0,
    }))
    .filter((s) => s.name !== "");
}

function validateVillaInput(input: VillaInput): string | null {
  if (!input.name.trim()) return "Villa name is required.";
  if (!input.city.trim()) return "City is required.";
  if (!(input.price > 0)) return "Price must be greater than zero.";
  if (!(Math.trunc(input.maxGuests) >= 1))
    return "Maximum number of guests must be at least 1.";
  const imageCount = input.images?.length ?? 0;
  if (imageCount < MIN_VILLA_IMAGES)
    return `Please add at least ${MIN_VILLA_IMAGES} images of your villa.`;
  if (imageCount > MAX_VILLA_IMAGES)
    return `You can upload at most ${MAX_VILLA_IMAGES} images of your villa.`;
  return null;
}

// Guests a villa can sleep — kept to a sane range so the guest picker and the
// booking-guests validation stay bounded.
function normalizeMaxGuests(value: number): number {
  return Math.min(30, Math.max(1, Math.trunc(value) || 1));
}

/** What to store for people_per_room + max_guests given the villa kind.
 *  Hotels/resorts sell by the room, so capacity = rooms × people-per-room and
 *  people_per_room is kept; other kinds keep 0 and the owner's guest cap. */
function roomFields(input: VillaInput): { peoplePerRoom: number; maxGuests: number } {
  if (isRoomBased(input.kind)) {
    const rooms = Math.max(1, Math.trunc(input.rooms) || 1);
    const perRoom = Math.max(1, Math.trunc(input.peoplePerRoom ?? 0) || 1);
    return { peoplePerRoom: perRoom, maxGuests: Math.max(1, rooms * perRoom) };
  }
  return { peoplePerRoom: 0, maxGuests: normalizeMaxGuests(input.maxGuests) };
}

/** Host discount as a whole percent, clamped to a sane 0–90 range. */
function clampDiscount(value: number | undefined): number {
  return Math.min(90, Math.max(0, Math.trunc(value ?? 0) || 0));
}

export async function createVillaAction(
  input: VillaInput & {
    hostProfile?: {
      fullName: string;
      gender: string;
      dob: string;
      address: string;
    };
    payment?: PaymentInput;
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in to host a villa.");
  const invalid = validateVillaInput(input);
  if (invalid) return fail(invalid);

  const images =
    input.images && input.images.length > 0
      ? input.images
      : ["/images/host/photo-1.jpg"];

  const db = getDb();
  // Villa insert + host-unlock + optional profile save commit together.
  try {
    await tx(async () => {
      const caps = roomFields(input);
      await db.prepare(
        `INSERT INTO villas
           (owner_id, name, kind, description, area, address, city, rooms, bathrooms,
            max_guests, people_per_room, facilities, services, price, discount, image, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        user.id,
        input.name.trim(),
        input.kind,
        input.description.trim(),
        input.area.trim(),
        input.address.trim(),
        input.city.trim(),
        Math.max(1, Math.trunc(input.rooms) || 1),
        Math.max(1, Math.trunc(input.bathrooms) || 1),
        caps.maxGuests,
        caps.peoplePerRoom,
        JSON.stringify(input.facilities ?? []),
        JSON.stringify(normalizeServices(input.services)),
        input.price,
        clampDiscount(input.discount),
        images[0],
        JSON.stringify(images),
      );

      // Listing a villa makes you a host — unlock the host tools permanently.
      await db.prepare("UPDATE users SET hosting_enabled = 1 WHERE id = ?").run(user.id);

      // The wizard's first step doubles as the host's profile — keep it saved.
      if (input.hostProfile) {
        await db.prepare(
          `UPDATE users SET full_name = ?, gender = ?, dob = ?, address = ?
           WHERE id = ?`,
        ).run(
          input.hostProfile.fullName.trim(),
          input.hostProfile.gender,
          input.hostProfile.dob.trim(),
          input.hostProfile.address.trim(),
          user.id,
        );
      }

      // The payout card the host entered on the Payment step.
      await saveHostPayment(db, user.id, input.payment);
    });
  } catch {
    return fail("Something went wrong saving your villa. Please try again.");
  }

  revalidateVillaViews();
  return { ok: true };
}

export async function updateVillaAction(
  villaId: number,
  input: VillaInput,
  payment?: PaymentInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const invalid = validateVillaInput(input);
  if (invalid) return fail(invalid);

  const images =
    input.images && input.images.length > 0
      ? input.images
      : ["/images/host/photo-1.jpg"];

  const caps = roomFields(input);
  const res = await getDb()
    .prepare(
      `UPDATE villas
       SET name = ?, kind = ?, description = ?, area = ?, address = ?, city = ?,
           rooms = ?, bathrooms = ?, max_guests = ?, people_per_room = ?,
           facilities = ?, services = ?, price = ?, discount = ?, image = ?, images = ?
       WHERE id = ? AND owner_id = ?`,
    )
    .run(
      input.name.trim(),
      input.kind,
      input.description.trim(),
      input.area.trim(),
      input.address.trim(),
      input.city.trim(),
      Math.max(1, Math.trunc(input.rooms) || 1),
      Math.max(1, Math.trunc(input.bathrooms) || 1),
      caps.maxGuests,
      caps.peoplePerRoom,
      JSON.stringify(input.facilities ?? []),
      JSON.stringify(normalizeServices(input.services)),
      input.price,
      clampDiscount(input.discount),
      images[0],
      JSON.stringify(images),
      villaId,
      user.id,
    );
  if (res.changes === 0) return fail("Property not found.");

  // Persist any payout-card change made on the Payment step. Guarded so saving
  // another section (which sends an empty card) never clears a stored card.
  await saveHostPayment(getDb(), user.id, payment);

  revalidateVillaViews();
  return { ok: true };
}

/** Toggle a villa's "featured" (paid promotion) flag. Owner-only. The paid
 *  warning is confirmed on the client before this is called. */
export async function setVillaFeaturedAction(
  villaId: number,
  featured: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const res = await getDb()
    .prepare("UPDATE villas SET featured = ? WHERE id = ? AND owner_id = ?")
    .run(featured ? 1 : 0, villaId, user.id);
  if (res.changes === 0) return fail("Property not found.");

  // The home page's Featured row and the owner's property list both change.
  revalidatePath("/");
  revalidatePath("/profile/properties");
  return { ok: true };
}

export async function deleteVillaAction(villaId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const db = getDb();
  const villa = await db
    .prepare("SELECT id FROM villas WHERE id = ? AND owner_id = ?")
    .get(villaId, user.id);
  if (!villa) return fail("Property not found.");

  // Deleting a villa cascades to its bookings — refuse while it still has any
  // active reservation (a confirmed upcoming stay or a pending request) so a
  // guest's booking is never silently erased. The owner must cancel/decline
  // them first (from Rent Requests), then the villa can be removed.
  const today = new Date().toISOString().slice(0, 10);
  const active = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE villa_id = ? AND check_out >= ?
         AND status IN ('pending', 'accepted')`,
    )
    .get(villaId, today)) as { n: number };
  if (active.n > 0)
    return fail(
      "This villa still has active bookings. Cancel all of them in Rent Requests before removing the villa.",
    );

  await db.prepare("DELETE FROM villas WHERE id = ?").run(villaId);
  revalidateVillaViews();
  return { ok: true };
}

/* ---------------------------- packages ---------------------------- */

type PackageInput = {
  villaId: number;
  name: string;
  description: string;
  type: string;
  nights: number;
  maxGuests: number;
  discount: number;
  price: number;
  inclusions: string[];
};

/** A preset type (weekend/weekly/monthly) fixes the nights server-side, so a
 *  tampered client can't claim a "Monthly Retreat" with 2 nights. */
function resolvedNights(input: PackageInput): number {
  return presetNights(parsePackageType(input.type)) ?? Math.max(1, Math.trunc(input.nights));
}

/** Presets fix the advertised discount too; curated is the owner's own 0–90%. */
function resolvedDiscount(input: PackageInput): number {
  const preset = presetDiscount(parsePackageType(input.type));
  if (preset !== null) return preset;
  return Math.min(90, Math.max(0, Math.trunc(Number(input.discount)) || 0));
}

/** Trim, drop blanks, cap the list so a package can't carry junk/huge input. */
function normalizeInclusions(list: string[] | undefined): string[] {
  return (list ?? [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s !== "")
    .slice(0, 20);
}

type OwnedVilla = {
  kind: string;
  rooms: number;
  people_per_room: number;
  max_guests: number;
};

async function getOwnedVilla(
  villaId: number,
  userId: number,
): Promise<OwnedVilla | null> {
  const row = (await getDb()
    .prepare(
      "SELECT kind, rooms, people_per_room, max_guests FROM villas WHERE id = ? AND owner_id = ?",
    )
    .get(villaId, userId)) as OwnedVilla | undefined;
  return row ?? null;
}

/** Most guests a package on this villa may declare — room-based villas cap at
 *  rooms × per-room occupancy, whole-villa kinds at the villa's max_guests. */
function villaGuestCapacity(v: OwnedVilla): number {
  return isRoomBased(v.kind)
    ? Math.max(1, v.rooms * v.people_per_room)
    : Math.max(1, v.max_guests);
}

function validatePackageInput(
  input: PackageInput,
  villa: OwnedVilla,
): string | null {
  if (!input.name.trim()) return "Package name is required.";
  if (!(resolvedNights(input) >= 1))
    return "A package must run for at least 1 night.";
  const guests = Math.trunc(input.maxGuests);
  if (!(guests >= 1)) return "A package must be for at least 1 guest.";
  const cap = villaGuestCapacity(villa);
  if (guests > cap)
    return `This villa fits up to ${cap} guest${cap === 1 ? "" : "s"}.`;
  if (!(Number(input.price) >= 0)) return "Price can't be negative.";
  if (normalizeInclusions(input.inclusions).length === 0)
    return "Add at least one inclusion to the package.";
  return null;
}

const cleanPrice = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

function revalidatePackageViews() {
  revalidatePath("/profile/packages");
  revalidatePath("/packages");
  revalidatePath("/place");
}

export async function createPackageAction(
  input: PackageInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const villa = await getOwnedVilla(input.villaId, user.id);
  if (!villa) return fail("You can only add packages to your own villa.");
  const invalid = validatePackageInput(input, villa);
  if (invalid) return fail(invalid);

  await getDb()
    .prepare(
      `INSERT INTO packages
         (owner_id, villa_id, name, description, type, nights, max_guests, discount, price, inclusions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      input.villaId,
      input.name.trim(),
      input.description.trim(),
      parsePackageType(input.type),
      resolvedNights(input),
      Math.max(1, Math.trunc(input.maxGuests)),
      resolvedDiscount(input),
      cleanPrice(input.price),
      JSON.stringify(normalizeInclusions(input.inclusions)),
    );
  revalidatePackageViews();
  return { ok: true };
}

export async function updatePackageAction(
  packageId: number,
  input: PackageInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const villa = await getOwnedVilla(input.villaId, user.id);
  if (!villa) return fail("You can only add packages to your own villa.");
  const invalid = validatePackageInput(input, villa);
  if (invalid) return fail(invalid);

  const res = await getDb()
    .prepare(
      `UPDATE packages
       SET villa_id = ?, name = ?, description = ?, type = ?, nights = ?, max_guests = ?,
           discount = ?, price = ?, inclusions = ?
       WHERE id = ? AND owner_id = ?`,
    )
    .run(
      input.villaId,
      input.name.trim(),
      input.description.trim(),
      parsePackageType(input.type),
      resolvedNights(input),
      Math.max(1, Math.trunc(input.maxGuests)),
      resolvedDiscount(input),
      cleanPrice(input.price),
      JSON.stringify(normalizeInclusions(input.inclusions)),
      packageId,
      user.id,
    );
  if (res.changes === 0) return fail("Package not found.");
  revalidatePackageViews();
  return { ok: true };
}

export async function deletePackageAction(
  packageId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const res = await getDb()
    .prepare("DELETE FROM packages WHERE id = ? AND owner_id = ?")
    .run(packageId, user.id);
  if (res.changes === 0) return fail("Package not found.");
  revalidatePackageViews();
  return { ok: true };
}

/* ---------------------------- bookings ---------------------------- */

export type BookingResult =
  | { ok: true; reference: string }
  | { ok: false; error: string };

export async function createBookingAction(input: {
  villaId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Rooms to reserve — hotels/resorts only; ignored (forced to 1) elsewhere. */
  rooms?: number;
  /** Chosen paid add-ons, as indices into the villa's service list. */
  services?: number[];
  /** Booking a fixed package instead of a nightly stay. */
  packageId?: number;
}): Promise<BookingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in to book.");

  const db = getDb();

  // A package is server-trusted: it fixes the duration, occupancy and price, so
  // load it first and derive the stay from it — never from the client's values.
  let pkg: Awaited<ReturnType<typeof getPackageById>> = null;
  if (input.packageId != null) {
    pkg = await getPackageById(input.packageId);
    if (!pkg) return fail("This package is no longer available.");
    if (pkg.villaId !== input.villaId)
      return fail("This package doesn't belong to that villa.");
  }

  const checkIn = input.checkIn;
  const checkOut = pkg ? addDays(checkIn, pkg.nights) : input.checkOut;

  if (!parseDay(checkIn) || !parseDay(checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(checkIn, checkOut) < 1)
    return fail("Check-out must be after check-in.");
  if (checkIn < new Date().toISOString().slice(0, 10))
    return fail("Check-in cannot be in the past.");

  const villa = (await db
    .prepare(
      "SELECT id, owner_id, kind, rooms, max_guests, people_per_room, services FROM villas WHERE id = ?",
    )
    .get(input.villaId)) as
    | {
        id: number;
        owner_id: number;
        kind: string;
        rooms: number;
        max_guests: number;
        people_per_room: number;
        services: string;
      }
    | undefined;
  if (!villa) return fail("This villa no longer exists.");
  if (villa.owner_id === user.id)
    return fail("You cannot book your own villa.");

  // Package occupancy is fixed at the package's max_guests; otherwise the guest
  // picked the headcount.
  const guests = pkg ? pkg.maxGuests : Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const roomBased = isRoomBased(villa.kind);
  let roomsNeeded = 1;
  let extras: { name: string; price: number }[] = [];

  if (pkg) {
    // Package books just the rooms it needs to seat its occupancy (1 for a
    // whole-villa kind); no à-la-carte extras — the inclusions are the bundle.
    roomsNeeded = roomsForGuests(villa.kind, guests, villa.people_per_room);
  } else {
    // Resolve the picked add-ons from the villa's own service list so prices
    // come from the DB, never the client. Only paid ones are stored.
    const villaServices = parseServiceList(villa.services);
    extras = [
      ...new Set(
        (input.services ?? []).filter(
          (i) => Number.isInteger(i) && i >= 0 && i < villaServices.length,
        ),
      ),
    ]
      .map((i) => villaServices[i])
      .filter((s) => s.price > 0);

    // Hotels/resorts reserve N rooms (each sleeping people_per_room); other
    // kinds book the whole place (1 unit, guests capped at max_guests).
    if (roomBased) {
      const capacity = roomCapacity(villa.kind, villa.rooms);
      const perRoom = Math.max(1, villa.people_per_room);
      roomsNeeded = Math.min(capacity, Math.max(1, Math.trunc(input.rooms ?? 1) || 1));
      const guestCap = roomsNeeded * perRoom;
      if (guests > guestCap)
        return fail(
          `${roomsNeeded} room${roomsNeeded === 1 ? "" : "s"} sleep${roomsNeeded === 1 ? "s" : ""} up to ${guestCap} guest${guestCap === 1 ? "" : "s"}.`,
        );
    } else if (guests > villa.max_guests) {
      return fail(
        `This villa sleeps up to ${villa.max_guests} guest${villa.max_guests === 1 ? "" : "s"}.`,
      );
    }
  }

  // Snapshot the package onto the booking so history survives edits/deletes.
  const packageSnapshot = pkg
    ? JSON.stringify({
        name: pkg.name,
        nights: pkg.nights,
        guests: pkg.maxGuests,
        price: pkg.price,
        inclusions: pkg.inclusions,
      })
    : "";

  // Availability check + insert must be atomic so two concurrent bookings
  // can't both pass the overlap check and double-book. IMMEDIATE takes the
  // write lock before the check; a re-check inside the tx is the guard.
  let bookingId: number | null = null;
  try {
    bookingId = await tx(async () => {
      if (
        !(await isVillaAvailable(villa.id, checkIn, checkOut, roomsNeeded))
      )
        return null;
      const inserted = await db
        .prepare(
          `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, rooms, extras, package_id, package, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted') RETURNING id`,
        )
        .run(
          villa.id,
          user.id,
          formatRange(checkIn, checkOut),
          checkIn,
          checkOut,
          guests,
          roomsNeeded,
          JSON.stringify(extras),
          pkg ? pkg.id : null,
          packageSnapshot,
        );
      // The wishlist tracks places still to book — a booked villa leaves it.
      await db.prepare(
        "DELETE FROM favorites WHERE user_id = ? AND villa_id = ?",
      ).run(user.id, villa.id);
      return inserted.lastInsertRowid as number;
    });
  } catch {
    return fail("Something went wrong creating your booking. Please try again.");
  }
  if (bookingId === null)
    return fail(
      roomBased
        ? "No rooms left for those dates. Try fewer rooms or different dates."
        : "This villa is already booked for those dates. Try different dates.",
    );

  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  revalidatePath("/profile/favorites");
  // Availability changed — bust the villa detail, search and home so they don't
  // show this stay's dates as free from a stale (client-router) cache.
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true, reference: bookingReference(bookingId) };
}

export async function cancelBookingAction(
  bookingId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  // A booking can't be cancelled once its start date has passed — cancellation
  // stays open only up to and including the check-in day.
  const today = new Date().toISOString().slice(0, 10);
  const res = await getDb()
    .prepare(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND guest_id = ? AND status = 'accepted' AND check_in >= ?`,
    )
    .run(bookingId, user.id, today);
  if (res.changes === 0)
    return fail("This booking can no longer be cancelled.");

  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  // Cancelling frees those dates — refresh availability everywhere it shows.
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/** Host-side cancel: the owner refunds the guest in full (policy shown in the
 *  confirm dialog), so the booking just flips to cancelled. */
export async function ownerCancelBookingAction(
  bookingId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const res = await getDb()
    .prepare(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND status = 'accepted'
         AND villa_id IN (SELECT id FROM villas WHERE owner_id = ?)`,
    )
    .run(bookingId, user.id);
  if (res.changes === 0) return fail("Booking not found.");

  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  // Cancelling frees those dates — refresh availability everywhere it shows.
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/** Change an existing booking's dates and/or guest count (the guest's own,
 *  still-active booking). Availability is re-checked EXCLUDING this booking so
 *  keeping or nudging its own dates is allowed, and the whole thing is atomic. */
export async function updateBookingAction(
  bookingId: number,
  input: { checkIn: string; checkOut: string; guests: number },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (!parseDay(input.checkIn) || !parseDay(input.checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(input.checkIn, input.checkOut) < 1)
    return fail("Check-out must be after check-in.");
  if (input.checkIn < new Date().toISOString().slice(0, 10))
    return fail("Check-in cannot be in the past.");

  const guests = Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT b.id, b.villa_id, b.status, b.rooms, b.package, b.check_in, b.check_out,
              v.kind, v.max_guests, v.people_per_room
       FROM bookings b JOIN villas v ON v.id = b.villa_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | {
        id: number;
        villa_id: number;
        status: string;
        rooms: number;
        package: string;
        check_in: string;
        check_out: string;
        kind: string;
        max_guests: number;
        people_per_room: number;
      }
    | undefined;
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "accepted")
    return fail("Only active bookings can be changed.");

  // The stay's length is fixed on an edit — a package's nights, or a nightly
  // booking's original span — so the guest may shift the start date but never
  // stretch or shrink it. Derive the checkout from the (possibly moved) check-in
  // and ignore any client-sent checkout, so the number of nights (and the price)
  // can't change. A package's occupancy is fixed too.
  const pkg = parsePackage(booking.package);
  const fixedNights = pkg
    ? pkg.nights
    : Math.max(1, nightsBetween(booking.check_in, booking.check_out));
  const checkOut = addDays(input.checkIn, fixedNights);
  const effGuests = pkg ? Math.max(1, pkg.guests) : guests;

  // Dates and guests can change here; the room count stays as booked. Cap guests
  // to what those rooms sleep (hotels/resorts) or the whole-villa capacity.
  const roomsHeld = Math.max(1, booking.rooms);
  if (isRoomBased(booking.kind)) {
    const guestCap = roomsHeld * Math.max(1, booking.people_per_room);
    if (effGuests > guestCap)
      return fail(
        `${roomsHeld} room${roomsHeld === 1 ? "" : "s"} sleep${roomsHeld === 1 ? "s" : ""} up to ${guestCap} guest${guestCap === 1 ? "" : "s"}.`,
      );
  } else if (effGuests > booking.max_guests) {
    return fail(
      `This villa sleeps up to ${booking.max_guests} guest${booking.max_guests === 1 ? "" : "s"}.`,
    );
  }

  let ok = false;
  try {
    ok = await tx(async () => {
      // Exclude THIS booking so its own current dates never count as a clash.
      if (
        !(await isVillaAvailable(
          booking.villa_id,
          input.checkIn,
          checkOut,
          roomsHeld,
          booking.id,
        ))
      )
        return false;
      await db.prepare(
        `UPDATE bookings SET check_in = ?, check_out = ?, dates = ?, guests = ?
         WHERE id = ? AND guest_id = ? AND status = 'accepted'`,
      ).run(
        input.checkIn,
        checkOut,
        formatRange(input.checkIn, checkOut),
        effGuests,
        bookingId,
        user.id,
      );
      return true;
    });
  } catch {
    return fail("Something went wrong updating your booking. Please try again.");
  }
  if (!ok)
    return fail("Those dates are already booked. Please choose different dates.");

  revalidatePath("/profile/bookings");
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Fully modify a nightly booking — new dates (any length), rooms, guests, and
 * paid add-ons — re-checking availability with this booking excluded so its own
 * dates never self-clash. The price difference is reconciled by the caller (the
 * guest pays a top-up on the payment page when it's higher, or is refunded when
 * it's lower); this action only rewrites the reservation once that's settled.
 * Packages are fixed length/occupancy/price and can't be modified here.
 */
export async function modifyBookingAction(
  bookingId: number,
  input: {
    checkIn: string;
    checkOut: string;
    guests: number;
    rooms: number;
    serviceIdx: number[];
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (!parseDay(input.checkIn) || !parseDay(input.checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(input.checkIn, input.checkOut) < 1)
    return fail("Check-out must be after check-in.");
  if (input.checkIn < new Date().toISOString().slice(0, 10))
    return fail("Check-in cannot be in the past.");

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT b.id, b.villa_id, b.status, b.package,
              v.kind, v.max_guests, v.people_per_room, v.rooms AS total_rooms, v.services
       FROM bookings b JOIN villas v ON v.id = b.villa_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | {
        id: number;
        villa_id: number;
        status: string;
        package: string;
        kind: string;
        max_guests: number;
        people_per_room: number;
        total_rooms: number;
        services: string;
      }
    | undefined;
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "accepted")
    return fail("Only active bookings can be changed.");
  // Packages fix their length, occupancy and price, so there's nothing to
  // reconcile — they use the start-date-only manage flow instead.
  if (parsePackage(booking.package))
    return fail("Package stays can't be modified here.");

  const roomBased = isRoomBased(booking.kind);
  const roomsHeld = roomBased ? Math.max(1, Math.trunc(input.rooms) || 1) : 1;
  if (roomBased && roomsHeld > Math.max(1, booking.total_rooms))
    return fail("That's more rooms than this property has.");

  const guests = Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");
  const guestCap = roomBased
    ? roomsHeld * Math.max(1, booking.people_per_room)
    : Math.max(1, booking.max_guests);
  if (guests > guestCap)
    return fail(
      `This selection sleeps up to ${guestCap} guest${guestCap === 1 ? "" : "s"}.`,
    );

  // Paid add-ons resolved server-side from the villa's services by index, with
  // prices read from the DB (never trusted from the client).
  const villaServices = parseServiceList(booking.services);
  const extras = [
    ...new Set(
      (input.serviceIdx ?? []).filter(
        (i) => Number.isInteger(i) && i >= 0 && i < villaServices.length,
      ),
    ),
  ]
    .map((i) => villaServices[i])
    .filter((s) => s.price > 0);

  let ok = false;
  try {
    ok = await tx(async () => {
      // Exclude THIS booking so its own current dates never count as a clash.
      if (
        !(await isVillaAvailable(
          booking.villa_id,
          input.checkIn,
          input.checkOut,
          roomsHeld,
          booking.id,
        ))
      )
        return false;
      await db.prepare(
        `UPDATE bookings SET check_in = ?, check_out = ?, dates = ?, guests = ?, rooms = ?, extras = ?
         WHERE id = ? AND guest_id = ? AND status = 'accepted'`,
      ).run(
        input.checkIn,
        input.checkOut,
        formatRange(input.checkIn, input.checkOut),
        guests,
        roomsHeld,
        JSON.stringify(extras),
        bookingId,
        user.id,
      );
      return true;
    });
  } catch {
    return fail("Something went wrong updating your booking. Please try again.");
  }
  if (!ok)
    return fail("Those dates are already booked. Please choose different dates.");

  revalidatePath("/profile/bookings");
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

export async function rateStayAction(
  bookingId: number,
  stars: number,
  comment: string = "",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const value = Math.trunc(stars);
  if (!(value >= 1 && value <= 5))
    return fail("Rating must be between 1 and 5 stars.");
  const text = comment.trim().slice(0, 1000);

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT id, villa_id, status, check_out FROM bookings
       WHERE id = ? AND guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | { id: number; villa_id: number; status: string; check_out: string }
    | undefined;
  if (!booking) return fail("Booking not found.");

  // Only finished stays can be rated: explicitly completed, or confirmed
  // with a checkout date in the past (how the UI derives "Completed").
  const today = new Date().toISOString().slice(0, 10);
  const completed =
    booking.status === "completed" ||
    (booking.status === "accepted" &&
      booking.check_out !== "" &&
      booking.check_out < today);
  if (!completed)
    return fail("You can rate this stay after your checkout date.");

  const already = await db
    .prepare("SELECT id FROM reviews WHERE booking_id = ?")
    .get(bookingId);
  if (already) return fail("You have already rated this stay.");

  // Insert the review and fold it into the villa's running average atomically.
  try {
    await tx(async () => {
      await db.prepare(
        "INSERT INTO reviews (booking_id, villa_id, user_id, stars, comment) VALUES (?, ?, ?, ?, ?)",
      ).run(bookingId, booking.villa_id, user.id, value, text);
      await db.prepare(
        `UPDATE villas
         SET rating = ROUND(((rating * reviews + ?) / (reviews + 1.0))::numeric, 2),
             reviews = reviews + 1
         WHERE id = ?`,
      ).run(value, booking.villa_id);
    });
  } catch {
    return fail("Something went wrong saving your rating. Please try again.");
  }

  revalidateVillaViews();
  revalidatePath("/profile/bookings");
  return { ok: true };
}

/* ---------------------------- favorites --------------------------- */

export type FavoriteResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: string };

export async function toggleFavoriteAction(
  villaId: number,
): Promise<FavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  const db = getDb();
  const removed = await db
    .prepare("DELETE FROM favorites WHERE user_id = ? AND villa_id = ?")
    .run(user.id, villaId);
  if (removed.changes > 0) {
    revalidatePath("/profile/favorites");
    return { ok: true, liked: false };
  }

  const villa = await db.prepare("SELECT id FROM villas WHERE id = ?").get(villaId);
  if (!villa) return { ok: false, error: "This villa no longer exists." };

  await db.prepare("INSERT INTO favorites (user_id, villa_id) VALUES (?, ?)").run(
    user.id,
    villaId,
  );
  revalidatePath("/profile/favorites");
  return { ok: true, liked: true };
}

/* ----------------------------- uploads ---------------------------- */

// Allowed image extensions mapped to the Content-Type served back from the DB.
const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_FILES = 8;

/** Verify the bytes actually are a known raster image, not just a valid ext. */
function sniffImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true;
  // GIF (GIF87a / GIF89a)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WEBP: "RIFF"…"WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return true;
  // AVIF / HEIF: bytes 4–7 == "ftyp"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70)
    return true;
  return false;
}

/**
 * Persist an uploaded image as bytes in the database and return the URL that
 * serves it (`/api/images/<id>`). Storing blobs in Postgres — instead of on the
 * local disk — keeps uploads alive across redeploys on hosts with an ephemeral
 * filesystem (Railway, containers). Returns null if the file isn't a valid,
 * within-limits image. `ownerId` records who uploaded it (nulled if they're
 * later deleted).
 */
async function saveUpload(file: File, ownerId: number): Promise<string | null> {
  const ext = path.extname(file.name || "").toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime || file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return null;
  }
  const buf = Buffer.from(await file.arrayBuffer());
  // Reject files whose contents don't match a real image signature, even if
  // the extension looks fine (a valid ext + arbitrary bytes was accepted before).
  if (!sniffImage(buf)) return null;

  // The id carries the extension so the served URL looks like a normal image
  // path (helps the image optimizer and browser); lookup is still a single PK.
  const id = `${randomBytes(16).toString("hex")}${ext}`;
  await getDb()
    .prepare("INSERT INTO images (id, mime, bytes, owner_id) VALUES (?, ?, ?, ?)")
    .run(id, mime, buf, ownerId);
  return `/api/images/${id}`;
}

export type UploadResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

export async function uploadImagesAction(
  formData: FormData,
): Promise<UploadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, MAX_UPLOAD_FILES);
  if (files.length === 0) return { ok: false, error: "No images received." };

  const paths: string[] = [];
  for (const file of files) {
    const saved = await saveUpload(file, user.id);
    // Any non-image (or oversized) file fails the whole batch — we never
    // silently drop a file the host thought they uploaded.
    if (!saved) {
      return {
        ok: false,
        error: `"${file.name || "This file"}" isn't a valid image. Only JPG, PNG, WEBP, GIF or AVIF images up to 8 MB are allowed.`,
      };
    }
    paths.push(saved);
  }
  return { ok: true, paths };
}

export async function updateAvatarAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const file = formData.get("avatar");
  if (!(file instanceof File)) return fail("No image received.");

  const saved = await saveUpload(file, user.id);
  if (!saved) {
    return fail("Only JPG, PNG, WEBP, GIF or AVIF images up to 8 MB are allowed.");
  }

  await getDb().prepare("UPDATE users SET avatar = ? WHERE id = ?").run(saved, user.id);
  revalidatePath("/profile", "layout");
  revalidatePath("/account");
  return { ok: true };
}
