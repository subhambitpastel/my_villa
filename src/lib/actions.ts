"use server";

import { randomBytes } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getDb, tx, type UserRow } from "./db";
import {
  addDays,
  formatDay,
  formatRange,
  isAtLeastAge,
  nightsBetween,
  parseDay,
  MAX_STAY_NIGHTS,
} from "./dates";
import { bookingReference, quote } from "./pricing";
import { allocateCustomerId, customerIdPrefix } from "./customerId";
import { MAX_CALL_MESSAGE, MAX_CHAT_MESSAGE } from "./callRequest";
// Plain JS, shared by value with the custom server through globalThis — see
// realtime/bus.mjs for why it can't just be another module under lib/.
import { issueTicket, publishChat } from "../../realtime/bus.mjs";
import { parsePackageType, presetNights, presetDiscount } from "./packageTypes";
import {
  findCoupon,
  getCouponCodesLike,
  hasRedeemedCoupon,
  isCouponInUse,
  getGuestRoomBookings,
  getPackageBookingLock,
  getPackageById,
  getRoomPlan,
  getVillaBookingLock,
  isPlanAvailable,
  isVillaAvailable,
  parsePackage,
  parseServiceList,
  searchGuests,
  type BookingLock,
} from "./queries";
import {
  dayBudget,
  hasDayLimit,
  isGraduated,
  isRoomBased,
  neededSpan,
  parseRoomPlan,
  planMaxRooms,
  roomCapacity,
  roomsForGuests,
  serializeRoomPlan,
  type RoomSegment,
} from "./rooms";
import type { GuestOption } from "./guests";
import { hashPasswordSync, verifyPassword } from "./password";
import { nowIso, nowMs, nowStamp, todayKey } from "./clock";
import { createSession, destroySession, getCurrentUser } from "./session";
import { notify, displayName } from "./notify";
import {
  canEditReview,
  recomputeVillaRating,
  REVIEW_EDIT_HOURS,
} from "./reviews";
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

  // Public customer ID, minted once here and never changed. Checked against the
  // IDs already sharing this prefix; the column's unique index is the backstop.
  const samePrefix = (await db
    .prepare("SELECT customer_id FROM users WHERE customer_id LIKE ?")
    .all(`${customerIdPrefix(email)}@%`)) as { customer_id: string }[];
  const customerId = allocateCustomerId(
    email,
    new Set(samePrefix.map((r) => r.customer_id)),
  );

  const userId = (
    await db
      .prepare(
        `INSERT INTO users (email, password_hash, customer_id, phone_code, phone_number, country)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .run(
        email,
        hashPasswordSync(password),
        customerId,
        phoneCode,
        phoneNumber,
        country,
      )
  ).lastInsertRowid as number;

  await createSession(userId);
  return { ok: true };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  if (!rateLimit(`login:${await clientIp()}`, 10, 60_000)) return fail(TOO_MANY);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = (await getDb()
    .prepare("SELECT id, password_hash, disabled_at FROM users WHERE email = ?")
    .get(email)) as
    | Pick<UserRow, "id" | "password_hash" | "disabled_at">
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return fail("Incorrect email or password.");
  }
  // Only after the password checks out — a wrong-password probe never learns
  // whether an account exists or is disabled.
  if (user.disabled_at)
    return fail("This account has been disabled. Contact support.");

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
    .get(token, nowIso())) as { user_id: number } | undefined;
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
    (nowMs() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
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
  maxGuests: number;
  /** Hotels/resorts: max occupancy of one room (0 for whole-villa kinds). */
  peoplePerRoom?: number;
  /** Hotels/resorts: most distinct nights one guest may book across all their
   *  stays here (0 = no limit). Ignored for whole-villa kinds. */
  maxBookingDays?: number;
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

/** Owner's per-guest night budget, clamped to a sane 1–80 range (0 = no limit).
 *  A cumulative budget across a guest's stays, so it may exceed a single stay's
 *  MAX_STAY_NIGHTS; 80 still rules out nonsense while allowing long budgets. */
function clampBookingDays(value: number | undefined): number {
  const n = Math.trunc(value ?? 0) || 0;
  // 0/blank = no limit; a set cap is bounded to 1–80 nights (the wizard
  // refuses out-of-range input with a message; this is the backstop).
  return n <= 0 ? 0 : Math.min(80, n);
}

/** What to store for people_per_room + max_guests + max_booking_days given the
 *  villa kind. Hotels/resorts sell by the room, so capacity = rooms ×
 *  people-per-room; other kinds keep 0 per-room and the owner's guest cap. The
 *  per-guest day budget applies to EVERY kind — a whole-villa listing can cap a
 *  guest's total nights just as a hotel can. */
function roomFields(input: VillaInput): {
  peoplePerRoom: number;
  maxGuests: number;
  maxBookingDays: number;
} {
  if (isRoomBased(input.kind)) {
    const rooms = Math.max(1, Math.trunc(input.rooms) || 1);
    const perRoom = Math.max(1, Math.trunc(input.peoplePerRoom ?? 0) || 1);
    return {
      peoplePerRoom: perRoom,
      maxGuests: Math.max(1, rooms * perRoom),
      maxBookingDays: clampBookingDays(input.maxBookingDays),
    };
  }
  return {
    peoplePerRoom: 0,
    maxGuests: normalizeMaxGuests(input.maxGuests),
    maxBookingDays: clampBookingDays(input.maxBookingDays),
  };
}

/** Host discount as a whole percent, clamped to a sane 0–90 range. */
function clampDiscount(value: number | undefined): number {
  return Math.min(90, Math.max(0, Math.trunc(value ?? 0) || 0));
}

/** A live booking is measured against the villa as it stands: its capacity gates
 *  availability, and its name/city are read straight off the villa row when the
 *  guest's booking is displayed. Editing any of it would rewrite what someone
 *  already paid for — so a villa with live bookings is frozen outright until
 *  every stay is completed (or the owner cancels them). */
function bookingLockedMessage(lock: BookingLock, what: string): string {
  const stays = `${lock.active} active booking${lock.active === 1 ? "" : "s"}`;
  const until = lock.lastCheckOut
    ? ` The last stay checks out on ${formatDay(lock.lastCheckOut)}.`
    : "";
  return (
    `This ${what} has ${stays}, so it can't be edited yet.${until}` +
    ` Wait for the stays to complete, or cancel them in Rent Requests to edit now.`
  );
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
           (owner_id, name, kind, description, area, address, city, rooms,
            max_guests, people_per_room, max_booking_days, facilities, services, price, discount, image, images)
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
        caps.maxGuests,
        caps.peoplePerRoom,
        caps.maxBookingDays,
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
  const rooms = Math.max(1, Math.trunc(input.rooms) || 1);

  // Check the lock and write inside one transaction, so a booking landing
  // between the two can't slip past the guard.
  const guard = await tx(async () => {
    const db = getDb();
    const villa = (await db
      .prepare("SELECT id FROM villas WHERE id = ? AND owner_id = ?")
      .get(villaId, user.id)) as { id: number } | undefined;
    if (!villa) return fail("Property not found.");

    // A live booking is measured against this villa as it stands — its capacity
    // gates availability, and its name/city are read off the villa row when the
    // guest's booking is shown. So nothing here may change until every stay is
    // completed (or cancelled). The UI blocks the entry point; this is the
    // authority behind it.
    const lock = await getVillaBookingLock(villaId);
    if (lock.active > 0) return fail(bookingLockedMessage(lock, "villa"));

    await db
      .prepare(
        `UPDATE villas
         SET name = ?, kind = ?, description = ?, area = ?, address = ?, city = ?,
             rooms = ?, max_guests = ?, people_per_room = ?, max_booking_days = ?,
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
        rooms,
        caps.maxGuests,
        caps.peoplePerRoom,
        caps.maxBookingDays,
        JSON.stringify(input.facilities ?? []),
        JSON.stringify(normalizeServices(input.services)),
        input.price,
        clampDiscount(input.discount),
        images[0],
        JSON.stringify(images),
        villaId,
        user.id,
      );
    return null;
  });
  if (guard) return guard;

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
  const lock = await getVillaBookingLock(villaId);
  if (lock.active > 0)
    return fail(
      "This villa still has active bookings. Cancel all of them in Rent Requests before removing the villa.",
    );

  await db.prepare("DELETE FROM villas WHERE id = ?").run(villaId);
  revalidateVillaViews();
  return { ok: true };
}

/** Lock (or restore) one of the owner's listings. Locking retires it
 *  gently: it stops taking new bookings and drops out of search and every other
 *  browse surface, while stays already booked go ahead untouched — which is what
 *  makes this the safe alternative to deleting a villa that guests have booked.
 *  Fully reversible; the flag is the only thing that changes. */
export async function setVillaLockedAction(
  villaId: number,
  locked: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const db = getDb();
  const villa = await db
    .prepare("SELECT id FROM villas WHERE id = ? AND owner_id = ?")
    .get(villaId, user.id);
  if (!villa) return fail("Property not found.");

  await db
    .prepare("UPDATE villas SET locked_at = ? WHERE id = ?")
    .run(locked ? nowIso() : null, villaId);

  revalidateVillaViews();
  // The listing leaves/rejoins the packages pages and guests' favourites too.
  revalidatePath("/packages");
  revalidatePath("/profile/packages");
  revalidatePath("/profile/favorites");
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

  // Guests already booked onto this package are measured against its capacity,
  // so the guest count is frozen while any of those stays are live. Unlike a
  // villa, the rest stays editable: a package booking snapshots {name, nights,
  // guests, price, inclusions} onto the booking, so those edits can't rewrite
  // what an existing guest booked — they only apply to future stays.
  const maxGuests = Math.max(1, Math.trunc(input.maxGuests));
  const pkgLock = await getPackageBookingLock(packageId);
  if (pkgLock.active > 0) {
    const current = (await getDb()
      .prepare("SELECT max_guests FROM packages WHERE id = ? AND owner_id = ?")
      .get(packageId, user.id)) as { max_guests: number } | undefined;
    if (current && maxGuests !== current.max_guests)
      return fail(
        `This package has ${pkgLock.active} active booking${
          pkgLock.active === 1 ? "" : "s"
        }, so its guest count can't be changed until those stays are completed.`,
      );
  }

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
      maxGuests,
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

/** Lock (or restore) a single package: it stops taking new bookings and drops
 *  off the packages pages, while stays already booked on it go ahead. Restoring
 *  a package on a locked villa won't make it bookable again — the villa's own
 *  lock still suppresses it until that is restored too. */
export async function setPackageLockedAction(
  packageId: number,
  locked: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const res = await getDb()
    .prepare("UPDATE packages SET locked_at = ? WHERE id = ? AND owner_id = ?")
    .run(locked ? nowIso() : null, packageId, user.id);
  if (res.changes === 0) return fail("Package not found.");
  revalidatePackageViews();
  return { ok: true };
}

/* -------------------------- notifications -------------------------- */

/** The villa's owner and name, for addressing a notification about it. */
async function villaOwnerFor(
  villaId: number,
): Promise<{ ownerId: number; name: string } | null> {
  const v = (await getDb()
    .prepare("SELECT owner_id, name FROM villas WHERE id = ?")
    .get(villaId)) as { owner_id: number; name: string } | undefined;
  return v ? { ownerId: v.owner_id, name: v.name } : null;
}

/**
 * Mark this user's notifications read. Read/unread is only an indication — it
 * gates nothing — so opening the bell is enough to clear it, and there's no
 * per-item read state to manage.
 */
export async function markNotificationsReadAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  await getDb()
    .prepare(
      `UPDATE notifications SET read_at = ?
       WHERE user_id = ? AND read_at IS NULL`,
    )
    .run(nowIso(), user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------------------- bookings ---------------------------- */

export type BookingResult =
  | { ok: true; reference: string }
  | { ok: false; error: string };

/** A guest asks the host to call them about a booking the self-serve flow won't
 *  take — a room block over the per-guest cap. Deliberately light: it records
 *  who wants what, and the host rings them from Rent Requests. Re-requesting the
 *  same villa+dates reuses the open request instead of spamming the host. */
export async function requestCallAction(input: {
  villaId: number;
  checkIn: string;
  checkOut: string;
  rooms: number;
  /** Party size the guest picked, so the host isn't guessing on the call. */
  guests?: number;
  /** The guest's own note — anything the picked dates/rooms don't convey. */
  message?: string;
  /** Paid add-ons they'd ticked, as indices into the villa's service list. They
   *  chose these before asking, so they shouldn't have to say them again. */
  services?: number[];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in to request a call.");
  if (!rateLimit(`callreq:${user.id}`, 5, 60_000)) return fail(TOO_MANY);

  const db = getDb();
  const villa = (await db
    .prepare("SELECT id, owner_id, services FROM villas WHERE id = ?")
    .get(input.villaId)) as
    | { id: number; owner_id: number; services: string }
    | undefined;
  if (!villa) return fail("This property no longer exists.");
  if (villa.owner_id === user.id)
    return fail("This is your own property.");

  // Dates are informational — keep them only when they're real, so a malformed
  // value can't reach the host as gibberish.
  const checkIn = parseDay(input.checkIn) ? input.checkIn : "";
  const checkOut = parseDay(input.checkOut) ? input.checkOut : "";
  const rooms = Math.max(0, Math.trunc(input.rooms) || 0);
  const guests = Math.max(0, Math.trunc(input.guests ?? 0) || 0);
  // Free text from the guest, bounded so one request can't be a wall of text.
  const message = (input.message ?? "").trim().slice(0, MAX_CALL_MESSAGE);
  // Add-ons resolved from the villa's own list, so names and prices come from
  // the DB rather than the client — same rule as a real booking. Stored as a
  // snapshot so it still reads right if the host edits their services later.
  const villaServices = parseServiceList(villa.services);
  const extras = [
    ...new Set(
      (input.services ?? []).filter(
        (i) => Number.isInteger(i) && i >= 0 && i < villaServices.length,
      ),
    ),
  ]
    .map((i) => villaServices[i])
    .filter((s) => s.price > 0);

  const existing = await db
    .prepare(
      `SELECT id FROM call_requests
       WHERE villa_id = ? AND guest_id = ? AND status = 'open'
         AND check_in = ? AND check_out = ?`,
    )
    .get(villa.id, user.id, checkIn, checkOut);
  if (existing) {
    // Already asked — say so plainly rather than quietly filing a duplicate.
    return fail("You've already requested a call for these dates. The host will be in touch.");
  }

  const created = await db
    .prepare(
      // RETURNING id: the thread's first message needs the new request's id,
      // and this facade only fills lastInsertRowid when asked to.
      `INSERT INTO call_requests (villa_id, guest_id, check_in, check_out, rooms, guests, message, services)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .run(
      villa.id,
      user.id,
      checkIn,
      checkOut,
      rooms,
      guests,
      message,
      JSON.stringify(extras),
    );

  // The note they wrote when asking IS the first message of the thread — copied
  // in so the chat is one uniform list, rather than a note pinned above the
  // messages that answer it. No note simply means the host opens the thread.
  if (message && created.lastInsertRowid)
    await db
      .prepare(
        `INSERT INTO call_messages (request_id, sender_id, body) VALUES (?, ?, ?)`,
      )
      .run(Number(created.lastInsertRowid), user.id, message);

  // Someone is now sitting waiting for a call — the one notification with a
  // person on the other end of it.
  const asked = await villaOwnerFor(villa.id);
  if (asked)
    await notify({
      userId: asked.ownerId,
      type: "call_request",
      title: `${displayName(user)} asked for a call about ${asked.name}`,
      body:
        checkIn && checkOut
          ? `${formatRange(checkIn, checkOut)}${rooms > 0 ? ` · ${rooms} room${rooms === 1 ? "" : "s"}` : ""}`
          : "No dates given",
      href: "/profile/calls",
    });

  revalidatePath("/profile/calls");
  return { ok: true };
}

/** Host marks a call request handled. */
export async function resolveCallRequestAction(
  requestId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const db = getDb();
  const res = await db
    .prepare(
      `UPDATE call_requests SET status = 'done'
       WHERE id = ? AND villa_id IN (SELECT id FROM villas WHERE owner_id = ?)`,
    )
    .run(requestId, user.id);
  if (res.changes === 0) return fail("Request not found.");

  // Closing the request ends the conversation, so the conversation goes with it.
  // Both ways a request can close — "Fulfil this request" (the owner's booking
  // form calls this once the stay exists) and "Mark as called" — come through
  // here, which is the only reason one delete covers both.
  //
  // After the UPDATE, so a failed close can't take the messages with it.
  await db
    .prepare(`DELETE FROM call_messages WHERE request_id = ?`)
    .run(requestId);

  // Call requests live on /profile/calls — that's the page whose list changes.
  revalidatePath("/profile/calls");
  revalidatePath("/profile/requests");
  // The guest's side of the same request disappears with it.
  revalidatePath("/profile/my-requests");
  return { ok: true };
}

/** The two people allowed in a request's thread, plus what the notification of a
 *  new message needs to say. Null when the request is gone or already closed —
 *  a closed request has no thread, so nothing may be written to it. */
async function chatPeers(requestId: number): Promise<{
  guestId: number;
  ownerId: number;
  villaName: string;
} | null> {
  const row = (await getDb()
    .prepare(
      `SELECT c.guest_id, v.owner_id, v.name
         FROM call_requests c
         JOIN villas v ON v.id = c.villa_id
        WHERE c.id = ? AND c.status = 'open'`,
    )
    .get(requestId)) as
    | { guest_id: number; owner_id: number; name: string }
    | undefined;
  return row
    ? { guestId: row.guest_id, ownerId: row.owner_id, villaName: row.name }
    : null;
}

/**
 * Post a message to a call request's thread. Either party may write; nobody
 * else may read or write, and a closed request takes no messages at all (its
 * thread has already been deleted — a write would resurrect a ghost).
 */
export async function sendCallMessageAction(input: {
  requestId: number;
  body: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in to send a message.");
  if (!rateLimit(`chat:${user.id}`, 20, 60_000)) return fail(TOO_MANY);

  const body = input.body.trim().slice(0, MAX_CHAT_MESSAGE);
  if (!body) return fail("Write a message first.");

  const peers = await chatPeers(input.requestId);
  // One message for "no such request" and "not yours": a stranger probing ids
  // learns nothing either way.
  if (!peers) return fail("This request is no longer open.");
  const isGuest = peers.guestId === user.id;
  const isOwner = peers.ownerId === user.id;
  if (!isGuest && !isOwner) return fail("This request is no longer open.");

  await getDb()
    .prepare(
      `INSERT INTO call_messages (request_id, sender_id, body) VALUES (?, ?, ?)`,
    )
    .run(input.requestId, user.id, body);

  // Push it to whoever has the thread open, right now. Only the two of them are
  // told, and only that thread N changed — the content itself never crosses the
  // socket, so reading it still goes through the query above with its own
  // permission check. If nobody's connected this is a no-op and the
  // notification below is how they find out.
  publishChat({ requestId: input.requestId, to: [peers.guestId, peers.ownerId] });

  // Neither side is sitting on the page waiting. Without this the reply just
  // sits there — the notification IS how the other person finds out.
  await notify({
    userId: isGuest ? peers.ownerId : peers.guestId,
    type: "chat_message",
    title: `${displayName(user)} sent you a message about ${peers.villaName}`,
    // The message itself, trimmed — enough to know whether it needs answering
    // now, without turning the bell into the chat.
    body: body.length > 90 ? `${body.slice(0, 90)}…` : body,
    href: isGuest ? "/profile/calls" : "/profile/my-requests",
  });

  revalidatePath("/profile/calls");
  revalidatePath("/profile/my-requests");
  return { ok: true };
}

/**
 * Mint a one-shot ticket for this user's chat WebSocket.
 *
 * The socket can't authenticate itself: a WebSocket upgrade can't run a server
 * action, and the custom server that accepts it can't read the session (that's
 * TypeScript over the database, and server.mjs doesn't go through the Next
 * compiler). So the browser proves who it is HERE, where the session already
 * exists, and carries the ticket to the socket.
 *
 * Returns "" when signed out, so a logged-out page simply never connects.
 */
export async function issueChatTicketAction(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "";
  // Cheap, but it mints credentials — don't let a loop spray the ticket store.
  if (!rateLimit(`chatticket:${user.id}`, 30, 60_000)) return "";
  return issueTicket(user.id);
}

/** Mark the other party's messages in one thread as seen. Called when the chat
 *  is opened — read state is what the unread badge counts, nothing more. */
export async function markCallChatReadAction(
  requestId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const peers = await chatPeers(requestId);
  if (!peers || (peers.guestId !== user.id && peers.ownerId !== user.id))
    return fail("This request is no longer open.");

  // Only the OTHER side's messages: reading your own back doesn't mark them
  // seen by the person they were sent to.
  await getDb()
    .prepare(
      `UPDATE call_messages SET read_at = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
        WHERE request_id = ? AND sender_id <> ? AND read_at IS NULL`,
    )
    .run(requestId, user.id);

  revalidatePath("/profile/calls");
  revalidatePath("/profile/my-requests");
  return { ok: true };
}

/** Why a booking busts the property's per-guest night budget, phrased for the
 *  guest. `limit` is the owner's cap; `b` is the budget picture from dayBudget.
 *  Both wordings point at the call request — that's how a bigger stay gets made. */
function dayBudgetError(
  limit: number,
  b: { used: number; remaining: number },
): string {
  const nights = (n: number) => `${n} night${n === 1 ? "" : "s"}`;
  const ask =
    " To book more nights at this property, request a call from the host and they'll arrange it for you.";
  if (b.remaining <= 0)
    return (
      `You've already booked ${nights(b.used)} here, which is the most one guest can book online for this property (${nights(limit)}).` +
      ask
    );
  return (
    `You already have ${nights(b.used)} booked here, so you can book at most ${nights(b.remaining)} more — ` +
    `this property allows ${nights(limit)} per guest online.` +
    ask
  );
}

export async function createBookingAction(input: {
  villaId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Rooms to reserve — hotels/resorts only; ignored (forced to 1) elsewhere. */
  rooms?: number;
  /** Opt-in to an adjusted stay: when `rooms` aren't free for the whole range,
   *  take as many as each night allows instead of being capped at the
   *  bottleneck (hotels/resorts, nightly stays only). The plan is recomputed
   *  server-side — the client only asks for the flexibility, never sets it. */
  flex?: boolean;
  /** The guest already holds rooms on these dates and `rooms` counts rooms to
   *  ADD on top — booked as a NEW, SEPARATE stay (never merged into the held
   *  one). Skips the covered-nights trim; each night adds at most what it has
   *  free, the guest's own rooms counting as taken. Hotels/resorts only. */
  add?: boolean;
  /** Chosen paid add-ons, as indices into the villa's service list. */
  services?: number[];
  /** Booking a fixed package instead of a nightly stay. */
  packageId?: number;
  /** Coupon code the guest applied at checkout. Validated here (it must exist
   *  and belong to THIS property) and snapshotted onto the booking — never
   *  trusted from the displayed price. */
  couponCode?: string;
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
    // Locked (directly, or because its villa was locked) — stays already
    // booked still stand, but no new ones are taken.
    if (pkg.locked)
      return fail("This package is no longer taking bookings.");
  }

  const checkIn = input.checkIn;
  const checkOut = pkg ? addDays(checkIn, pkg.nights) : input.checkOut;

  if (!parseDay(checkIn) || !parseDay(checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(checkIn, checkOut) < 1)
    return fail("Check-out must be after check-in.");
  // Free-form nightly stays are capped; a package's length is host-fixed above.
  if (!pkg && nightsBetween(checkIn, checkOut) > MAX_STAY_NIGHTS)
    return fail(`Stays can be at most ${MAX_STAY_NIGHTS} nights.`);
  if (checkIn < todayKey())
    return fail("Check-in cannot be in the past.");

  const villa = (await db
    .prepare(
      `SELECT id, owner_id, name, kind, rooms, max_guests, people_per_room, max_booking_days, services, locked_at
       FROM villas WHERE id = ?`,
    )
    .get(input.villaId)) as
    | {
        id: number;
        owner_id: number;
        name: string;
        kind: string;
        rooms: number;
        max_guests: number;
        people_per_room: number;
        max_booking_days: number;
        services: string;
        locked_at: string | null;
      }
    | undefined;
  if (!villa) return fail("This villa no longer exists.");
  if (villa.owner_id === user.id)
    return fail("You cannot book your own villa.");
  // The owner locked this listing: existing stays are honoured, new ones are
  // refused. This is the single gate every new booking passes through.
  if (villa.locked_at !== null)
    return fail("This property is no longer taking bookings.");

  // Package occupancy is fixed at the package's max_guests; otherwise the guest
  // picked the headcount.
  const guests = pkg ? pkg.maxGuests : Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const roomBased = isRoomBased(villa.kind);
  const perRoom = Math.max(1, villa.people_per_room);
  // An adjusted stay holds different room counts over consecutive legs, so its
  // guest cap depends on the live plan — validated inside the transaction below
  // rather than against a single flat room count here.
  const flex = roomBased && !pkg && input.flex === true;
  const addMode = roomBased && !pkg && input.add === true;
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
      // Capped only by the hotel's inventory now — a guest may take as many
      // rooms as the property has. What's rationed is NIGHTS, not rooms (the
      // per-guest day budget below), and a bigger stay goes through the host.
      roomsNeeded = Math.min(
        capacity,
        Math.max(1, Math.trunc(input.rooms ?? 1) || 1),
      );
      const guestCap = roomsNeeded * perRoom;
      if (!flex && guests > guestCap)
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

  const noRoomsMsg = roomBased
    ? "No rooms left for those dates. Try fewer rooms or different dates."
    : "This villa is already booked for those dates. Try different dates.";

  // Availability check + insert must be atomic so two concurrent bookings
  // can't both pass the overlap check and double-book. IMMEDIATE takes the
  // write lock before the check; a re-check inside the tx is the guard. An
  // adjusted stay's plan is derived here too, so it can't go stale between
  // being offered and being booked.
  let outcome: { id: number } | { error: string };
  try {
    outcome = await tx(async () => {
      // The nights this booking must actually cover: rooms the guest already
      // holds satisfy the ask on their nights, so a range that overlaps an
      // existing stay books only the missing part — the same trim the booking
      // card applied, re-derived here so a stale client can't book nights the
      // guest already has. Packages keep their fixed span. Add mode skips the
      // trim: the ask is rooms ON TOP of the held ones, wanted on every picked
      // night, and books as its own separate stay.
      let bookIn = checkIn;
      let bookOut = checkOut;
      // The guest's own stays here — the day budget counts nights across ALL of
      // them, so it's fetched for every kind (the room-trim logic below still
      // only uses it for room-based stays).
      const mine = await getGuestRoomBookings(villa.id, user.id);
      if (roomBased && !pkg && !addMode) {
        const span = neededSpan(bookIn, bookOut, roomsNeeded, mine);
        if (!span)
          return {
            error:
              "You already have rooms for all of these dates. To change or extend that stay, manage it from My Bookings.",
          };
        if (span.gap)
          return {
            error:
              "Your existing rooms cover the middle of these dates — book the nights before and after them separately.",
          };
        bookIn = span.checkIn;
        bookOut = span.checkOut;
      }

      let plan: RoomSegment[] = [];
      if (flex) {
        // Passing the guest makes this the SAME plan the booking card offered:
        // each night limited by free inventory, with rooms the guest already
        // holds here topping up toward the ask. In add mode the ask is rooms
        // to ADD, so the plan is inventory-only (guest 0): min(add, free) per
        // night, the guest's held rooms already counting as taken.
        plan = await getRoomPlan(
          villa.id,
          bookIn,
          bookOut,
          roomsNeeded,
          0,
          addMode ? 0 : user.id,
        );
        if (plan.length === 0) return { error: noRoomsMsg };
        if (!isGraduated(plan)) {
          // Every night bottoms out at the same count, so flexing buys nothing
          // — this is a plain flat stay and gets validated as one below. Never
          // store the ASK against a flat plan: with 4 free a night, a stale
          // flex submit for 9 must fail, not book 9.
          const flatCap = plan[0].rooms * perRoom;
          if (guests > flatCap)
            return {
              error: `${plan[0].rooms} room${plan[0].rooms === 1 ? "" : "s"} sleep${plan[0].rooms === 1 ? "s" : ""} up to ${flatCap} guest${flatCap === 1 ? "" : "s"}.`,
            };
          plan = [];
        } else {
          // Occupancy sums what EACH leg sleeps, matching the booking card — a
          // 1-room leg plus a 6-room leg offers 2 + 12 guests, not the peak
          // leg's 12. The guest sees the split before confirming.
          const guestCap = plan.reduce((s, leg) => s + leg.rooms * perRoom, 0);
          if (guests > guestCap)
            return {
              error: `Across its legs this stay sleeps up to ${guestCap} guest${guestCap === 1 ? "" : "s"}.`,
            };
          if (!(await isPlanAvailable(villa.id, plan))) return { error: noRoomsMsg };
        }
      }
      if (
        plan.length === 0 &&
        !(await isVillaAvailable(villa.id, bookIn, bookOut, roomsNeeded))
      ) {
        return { error: noRoomsMsg };
      }
      // A property may cap how many DISTINCT NIGHTS one guest can book across
      // all their stays here (villas.max_booking_days). It counts every night
      // they already hold, so it can't be side-stepped by splitting the stay
      // across several bookings. Inside the tx next to the availability
      // re-check, so two concurrent bookings can't each read a stale footprint
      // and land the guest over budget between them.
      // PACKAGES are exempt: the budget guards self-serve nightly asks, but a
      // package's length is the HOST's own design and refusing their own bundle
      // would be absurd. Inventory (checked above) still applies to both.
      // Applies to whole-villa listings too — the cap is on the guest's nights,
      // not on rooms, so the property kind doesn't matter.
      if (!pkg && hasDayLimit(villa.max_booking_days)) {
        const budget = dayBudget(villa.max_booking_days, mine, checkIn, checkOut);
        if (budget.overBudget)
          return { error: dayBudgetError(villa.max_booking_days, budget) };
      }
      // The coupon is resolved HERE, inside the transaction, never from the
      // displayed price: it must exist and belong to THIS property. Its
      // discount is snapshotted into disc_pct/disc_fixed with the code, so
      // every later receipt recomputes the same charge — and a non-empty code
      // floors that charge at $1 (bookingMoney's coupon clamp).
      let coupon: { code: string; pct: number; fixed: number } | null = null;
      if (input.couponCode && input.couponCode.trim()) {
        const found = await findCoupon(input.couponCode);
        if (!found || found.villaId !== villa.id)
          return { error: "That coupon isn't valid for this property." };
        // One coupon, one use per guest. Checked inside the tx (the real
        // authority; the payment page's check is only UX), and backstopped by a
        // partial unique index for the double-submit race READ COMMITTED leaves
        // open — see bookings_coupon_once in db.ts.
        if (await hasRedeemedCoupon(user.id, found.code))
          return { error: "You've already used this coupon code." };
        coupon = { code: found.code, pct: found.pct, fixed: found.fixed };
      }
      // A flat stay stores '' and its single room count; an adjusted one stores
      // the plan, with `rooms` carrying the peak for display.
      const inserted = await db
        .prepare(
          `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, rooms, room_plan, extras, package_id, package, disc_pct, disc_fixed, coupon_code, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted') RETURNING id`,
        )
        .run(
          villa.id,
          user.id,
          formatRange(bookIn, bookOut),
          bookIn,
          bookOut,
          guests,
          isGraduated(plan) ? planMaxRooms(plan) : roomsNeeded,
          serializeRoomPlan(plan),
          JSON.stringify(extras),
          pkg ? pkg.id : null,
          packageSnapshot,
          coupon ? coupon.pct : 0,
          coupon ? coupon.fixed : 0,
          coupon ? coupon.code : "",
        );
      // The wishlist tracks places still to book — a booked villa leaves it.
      await db.prepare(
        "DELETE FROM favorites WHERE user_id = ? AND villa_id = ?",
      ).run(user.id, villa.id);
      return { id: inserted.lastInsertRowid as number };
    });
  } catch {
    return fail("Something went wrong creating your booking. Please try again.");
  }
  if ("error" in outcome) return fail(outcome.error);
  const bookingId = outcome.id;

  // The owner's listing just got booked — that's news to them, and Rent
  // Requests is where the booking now lives.
  await notify({
    userId: villa.owner_id,
    type: "booking_made",
    title: `${displayName(user)} booked ${villa.name}`,
    body: `${formatRange(checkIn, checkOut)} · ${guests} guest${guests === 1 ? "" : "s"}${
      roomBased ? ` · ${roomsNeeded} room${roomsNeeded === 1 ? "" : "s"}` : ""
    }`,
    href: "/profile/requests",
  });

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
  // 'pending' is here too: that's an unpaid stay the host arranged, and the
  // guest declining it is the same action — they're walking away from something
  // they never asked for and never paid for.
  const today = todayKey();
  const res = await getDb()
    .prepare(
      `UPDATE bookings SET status = 'cancelled', payment_due = 0
       WHERE id = ? AND guest_id = ? AND status IN ('accepted', 'pending')
         AND check_in >= ?`,
    )
    .run(bookingId, user.id, today);
  if (res.changes === 0)
    return fail("This booking can no longer be cancelled.");

  // The host loses a stay — read after the update, so the news only goes out if
  // something actually changed.
  const cancelled = (await getDb()
    .prepare(
      `SELECT b.dates, v.owner_id, v.name
       FROM bookings b JOIN villas v ON v.id = b.villa_id WHERE b.id = ?`,
    )
    .get(bookingId)) as
    | { dates: string; owner_id: number; name: string }
    | undefined;
  if (cancelled)
    await notify({
      userId: cancelled.owner_id,
      type: "booking_cancelled",
      title: `${displayName(user)} cancelled their stay at ${cancelled.name}`,
      body: cancelled.dates,
      href: "/profile/requests",
    });

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

  // 'pending' included so an owner can withdraw a stay they arranged but the
  // guest never paid for — otherwise an unwanted payment request would sit on
  // the guest's account forever with nobody able to clear it.
  const res = await getDb()
    .prepare(
      `UPDATE bookings SET status = 'cancelled', payment_due = 0
       WHERE id = ? AND status IN ('accepted', 'pending')
         AND villa_id IN (SELECT id FROM villas WHERE owner_id = ?)`,
    )
    .run(bookingId, user.id);
  if (res.changes === 0) return fail("Booking not found.");

  // The guest's stay was called off by someone else — they need to know.
  const dropped = (await getDb()
    .prepare(
      `SELECT b.dates, b.guest_id, v.name
       FROM bookings b JOIN villas v ON v.id = b.villa_id WHERE b.id = ?`,
    )
    .get(bookingId)) as
    | { dates: string; guest_id: number; name: string }
    | undefined;
  if (dropped)
    await notify({
      userId: dropped.guest_id,
      type: "booking_cancelled",
      title: `Your stay at ${dropped.name} was cancelled by the host`,
      body: dropped.dates,
      href: "/profile/bookings",
    });

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
  if (input.checkIn < todayKey())
    return fail("Check-in cannot be in the past.");

  const guests = Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT b.id, b.villa_id, b.status, b.rooms, b.room_plan, b.package, b.check_in, b.check_out,
              v.kind, v.max_guests, v.people_per_room, v.locked_at,
              pk.locked_at AS package_locked_at
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       LEFT JOIN packages pk ON pk.id = b.package_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | {
        id: number;
        villa_id: number;
        status: string;
        rooms: number;
        room_plan: string;
        package: string;
        check_in: string;
        check_out: string;
        kind: string;
        max_guests: number;
        people_per_room: number;
        locked_at: string | null;
        package_locked_at: string | null;
      }
    | undefined;
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "accepted")
    return fail("Only active bookings can be changed.");
  // A locked listing (the villa, or the package this stay is on) is winding
  // down. The stay stands and everything else about it stays editable, but its
  // DATES are frozen: moving them would commit the place to fresh dates it has
  // stopped taking. This action only ever moves the start date, so on an
  // locked listing it's the one thing refused. Cancelling stays available.
  if (
    (booking.locked_at !== null || booking.package_locked_at !== null) &&
    input.checkIn !== booking.check_in
  )
    return fail(
      "This property is no longer taking bookings, so these dates can't be changed. You can still cancel this booking.",
    );
  // Shifting an adjusted stay would carry its per-leg room counts onto nights
  // they were never checked against, so its dates are fixed once booked.
  if (parseRoomPlan(booking.room_plan))
    return fail(
      "This stay has a different number of rooms on different nights, so its dates can't be changed. Please cancel it and book again.",
    );

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

  await notifyOwnerOfChange(bookingId, user);

  revalidatePath("/profile/bookings");
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/** A guest moved or reshaped a stay the host already had on their calendar.
 *  Read after the write, so the dates quoted are the NEW ones. */
async function notifyOwnerOfChange(
  bookingId: number,
  guest: { full_name: string; email: string },
): Promise<void> {
  const changed = (await getDb()
    .prepare(
      `SELECT b.dates, v.owner_id, v.name
       FROM bookings b JOIN villas v ON v.id = b.villa_id WHERE b.id = ?`,
    )
    .get(bookingId)) as
    | { dates: string; owner_id: number; name: string }
    | undefined;
  if (!changed) return;
  await notify({
    userId: changed.owner_id,
    type: "booking_changed",
    title: `${displayName(guest)} changed their stay at ${changed.name}`,
    body: `Now ${changed.dates}`,
    href: "/profile/requests",
  });
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
    /** Opt-in to an adjusted stay: when `rooms` aren't free for the whole new
     *  range, hold what each night allows instead of failing. The per-night
     *  plan is re-derived server-side with this booking's own rooms returned
     *  to the pool — the client only asks for the flexibility. */
    flex?: boolean;
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  if (!parseDay(input.checkIn) || !parseDay(input.checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(input.checkIn, input.checkOut) < 1)
    return fail("Check-out must be after check-in.");
  if (nightsBetween(input.checkIn, input.checkOut) > MAX_STAY_NIGHTS)
    return fail(`Stays can be at most ${MAX_STAY_NIGHTS} nights.`);
  if (input.checkIn < todayKey())
    return fail("Check-in cannot be in the past.");

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT b.id, b.villa_id, b.status, b.package, b.room_plan,
              b.check_in, b.check_out,
              v.kind, v.max_guests, v.people_per_room, v.max_booking_days,
              v.rooms AS total_rooms, v.services, v.locked_at
       FROM bookings b JOIN villas v ON v.id = b.villa_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | {
        id: number;
        villa_id: number;
        status: string;
        package: string;
        room_plan: string;
        check_in: string;
        check_out: string;
        kind: string;
        max_guests: number;
        people_per_room: number;
        max_booking_days: number;
        total_rooms: number;
        services: string;
        locked_at: string | null;
      }
    | undefined;
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "accepted")
    return fail("Only active bookings can be changed.");
  // Locked: the dates are frozen, but nothing else is. Rooms, guests and
  // add-ons can still move — those stay inside the nights the place is already
  // committed to, and they're re-checked against live availability below like
  // any other change. Only re-dating is refused. Cancelling stays available.
  if (
    booking.locked_at !== null &&
    (input.checkIn !== booking.check_in || input.checkOut !== booking.check_out)
  )
    return fail(
      "This property is no longer taking bookings, so these dates can't be changed. You can still adjust rooms and guests, or cancel this booking.",
    );
  // Packages fix their length, occupancy and price, so there's nothing to
  // reconcile — they use the start-date-only manage flow instead.
  if (parsePackage(booking.package))
    return fail("Package stays can't be modified here.");

  const roomBased = isRoomBased(booking.kind);
  const perRoom = Math.max(1, booking.people_per_room);
  const flex = roomBased && input.flex === true;
  const roomsHeld = roomBased ? Math.max(1, Math.trunc(input.rooms) || 1) : 1;
  if (roomBased && roomsHeld > Math.max(1, booking.total_rooms))
    return fail("That's more rooms than this property has.");

  const guests = Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");
  // Room-based guest caps depend on the room plan the new stay derives —
  // graduated legs can sleep more than the flat ask — so they're validated
  // inside the transaction below, against the live plan.
  if (!roomBased && guests > Math.max(1, booking.max_guests))
    return fail(
      `This villa sleeps up to ${booking.max_guests} guest${booking.max_guests === 1 ? "" : "s"}.`,
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

  // Returns the reason it couldn't be applied, or null on success — the same
  // shape createBookingAction uses, so the cap can explain itself rather than
  // being flattened into "those dates are already booked".
  let txError: string | null = null;
  try {
    txError = await tx(async () => {
      // What the new stay holds each night, with THIS booking's own rooms
      // returned to the pool (excluded), so re-saving the same shape never
      // clashes with itself. A night-by-night booking is re-derived the same
      // way it was created: min(ask, free) per night. Flat if it fits flat;
      // graduated only when the guest opted in (flex).
      let newPlan: RoomSegment[] = [];
      if (roomBased) {
        const derived = await getRoomPlan(
          booking.villa_id,
          input.checkIn,
          input.checkOut,
          roomsHeld,
          booking.id,
          0,
        );
        if (derived.length === 0)
          return "Those dates are already booked. Please choose different dates.";
        if (isGraduated(derived)) {
          if (!flex)
            return `${roomsHeld} rooms aren't free on every one of those nights. Ask for fewer rooms, or accept the per-night adjustment.`;
          newPlan = derived;
        } else if (derived[0].rooms < roomsHeld) {
          // Every night bottoms out below the ask — flexing buys nothing, and
          // silently holding fewer rooms than asked is never done.
          return "Those dates are already booked. Please choose different dates.";
        }
        // The stay sleeps what its shape sleeps: graduated legs summed (same
        // rule the booking flow enforces), a flat stay rooms × per-room.
        const guestCap = Math.max(
          1,
          newPlan.length > 0
            ? newPlan.reduce((s, leg) => s + leg.rooms * perRoom, 0)
            : roomsHeld * perRoom,
        );
        if (guests > guestCap)
          return `This selection sleeps up to ${guestCap} guest${guestCap === 1 ? "" : "s"}.`;
      } else if (
        !(await isVillaAvailable(
          booking.villa_id,
          input.checkIn,
          input.checkOut,
          roomsHeld,
          booking.id,
        ))
      ) {
        return "Those dates are already booked. Please choose different dates.";
      }
      // Per-guest day budget, counting the guest's OTHER stays here — this
      // booking is excluded, so the nights it already holds don't count against
      // its own new dates (otherwise re-saving the same dates would fail against
      // itself). Every kind, including whole-villa stays.
      if (hasDayLimit(booking.max_booking_days)) {
        const mine = await getGuestRoomBookings(
          booking.villa_id,
          user.id,
          booking.id,
        );
        const budget = dayBudget(
          booking.max_booking_days,
          mine,
          input.checkIn,
          input.checkOut,
        );
        if (budget.overBudget)
          return dayBudgetError(booking.max_booking_days, budget);
      }
      // A graduated stay stores its legs with `rooms` carrying the peak for
      // display; a flat one stores '' — including a plan booking edited down
      // to a shape that now fits flat.
      await db.prepare(
        `UPDATE bookings SET check_in = ?, check_out = ?, dates = ?, guests = ?, rooms = ?, room_plan = ?, extras = ?
         WHERE id = ? AND guest_id = ? AND status = 'accepted'`,
      ).run(
        input.checkIn,
        input.checkOut,
        formatRange(input.checkIn, input.checkOut),
        guests,
        newPlan.length > 0 ? planMaxRooms(newPlan) : roomsHeld,
        serializeRoomPlan(newPlan),
        JSON.stringify(extras),
        bookingId,
        user.id,
      );
      return null;
    });
  } catch {
    return fail("Something went wrong updating your booking. Please try again.");
  }
  if (txError) return fail(txError);

  await notifyOwnerOfChange(bookingId, user);

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
  const today = todayKey();
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

  // Stored as PENDING: it counts for nothing publicly, and the villa's rating
  // is untouched, until an admin approves it at /admin/reviews.
  try {
    // created_at is stamped from the APP clock, not the database's: the
    // 24-hour edit window is measured against it, and a test running on a
    // shifted clock must be able to write a review that is genuinely "now".
    await db.prepare(
      "INSERT INTO reviews (booking_id, villa_id, user_id, stars, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(bookingId, booking.villa_id, user.id, value, text, nowStamp());
  } catch {
    return fail("Something went wrong saving your rating. Please try again.");
  }

  // The host is NOT told yet: a pending review isn't public, and news of a
  // rating they can't see (and that may never appear) is just noise.
  // adminSetReviewStatusAction tells them if and when it goes live.
  revalidatePath("/profile/bookings");
  revalidatePath("/admin/reviews");
  return { ok: true };
}

/**
 * Rewrite a review you already left.
 *
 * Open for REVIEW_EDIT_HOURS from when it was written — a day to reconsider,
 * then the words stand. Editing always sends it back to PENDING: an approved
 * review that could be silently rewritten afterwards would make moderation
 * meaningless, so a changed review is re-read before it goes back up.
 */
export async function updateReviewAction(
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
  const review = (await db
    .prepare(
      "SELECT id, villa_id, created_at FROM reviews WHERE booking_id = ? AND user_id = ?",
    )
    .get(bookingId, user.id)) as
    | { id: number; villa_id: number; created_at: string }
    | undefined;
  if (!review) return fail("You haven't reviewed this stay.");
  if (!canEditReview(review.created_at))
    return fail(
      `A review can only be changed within ${REVIEW_EDIT_HOURS} hours of writing it.`,
    );

  await db
    .prepare(
      "UPDATE reviews SET stars = ?, comment = ?, status = 'pending' WHERE id = ?",
    )
    .run(value, text, review.id);
  // It may have been approved and counting until now — take it back out of the
  // average while it waits to be re-read.
  await recomputeVillaRating(review.villa_id);

  revalidateVillaViews();
  revalidatePath("/profile/bookings");
  revalidatePath("/admin/reviews");
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

/* ---------------------- owner-made bookings ----------------------- */

/** Search users to book on behalf of. Restricted to owners (you must have a
 *  listing to book someone into) and to real queries, so this can't be used as
 *  a way to enumerate the user base. */
export async function searchGuestsAction(query: string): Promise<GuestOption[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const owns = (await getDb()
    .prepare("SELECT COUNT(*) AS n FROM villas WHERE owner_id = ?")
    .get(user.id)) as { n: number };
  if (Number(owns.n) === 0) return [];
  return searchGuests(query, user.id);
}

/**
 * Book a stay on a guest's behalf, from the owner's own listing. This is the
 * counter booking: the owner is arranging the stay directly, so the guest-facing
 * *policy* limits don't apply — no maximum nights, no per-room occupancy cap, no
 * per-guest room allowance.
 *
 * What still applies is anything that isn't policy: you must own the villa, the
 * guest must be a real other user, dates must be sane and not in the past, and
 * the rooms must actually exist and be free. Availability is physics, not a
 * rule to waive — waiving it would double-book a real guest.
 *
 * There's no checkout: the booking is confirmed the moment it's created, with
 * payment settled between owner and guest off-platform.
 */
export async function createOwnerBookingAction(input: {
  villaId: number;
  guestId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  services?: number[];
  /** Owner-granted discount: % off the total, and/or a fixed amount off. Shown
   *  to the guest at payment exactly as entered here. */
  discPct?: number;
  discFixed?: number;
  /** The ask isn't free every night, and the owner chose to fulfil it with what
   *  each night has — the same adjusted-stay shape guests can book themselves,
   *  only bounded by inventory alone (no per-guest allowance for a host). */
  flex?: boolean;
}): Promise<BookingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const db = getDb();
  const villa = (await db
    .prepare(
      "SELECT id, owner_id, name, kind, rooms, max_guests, people_per_room, services, price, discount FROM villas WHERE id = ?",
    )
    .get(input.villaId)) as
    | {
        id: number;
        owner_id: number;
        name: string;
        kind: string;
        rooms: number;
        max_guests: number;
        people_per_room: number;
        services: string;
        price: number;
        discount: number;
      }
    | undefined;
  if (!villa) return fail("This villa no longer exists.");
  if (villa.owner_id !== user.id)
    return fail("You can only create bookings on your own listing.");

  // The stay is FOR someone else — never the owner, who can't be their own guest.
  const guestId = Math.trunc(Number(input.guestId));
  if (!(guestId >= 1)) return fail("Choose the guest this booking is for.");
  if (guestId === user.id) return fail("You cannot book your own villa.");
  const guest = (await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(guestId)) as { id: number } | undefined;
  if (!guest) return fail("That guest account no longer exists.");

  const { checkIn, checkOut } = input;
  if (!parseDay(checkIn) || !parseDay(checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(checkIn, checkOut) < 1)
    return fail("Check-out must be after check-in.");
  // Deliberately no MAX_STAY_NIGHTS check: length is one of the limits an owner
  // is trusted to set for a booking they're arranging themselves.
  if (checkIn < todayKey())
    return fail("Check-in cannot be in the past.");

  // Occupancy IS capped — an owner can offer more rooms, not more beds. The
  // exact ceiling depends on the rooms (or plan) resolved inside the tx below.
  const guests = Math.trunc(Number(input.guests));
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const roomBased = isRoomBased(villa.kind);
  // Rooms are clamped to the inventory, not to a per-guest allowance: the owner
  // may take the whole property, but not rooms the building doesn't have.
  const roomsNeeded = roomBased
    ? Math.min(
        roomCapacity(villa.kind, villa.rooms),
        Math.max(1, Math.trunc(Number(input.rooms ?? 1)) || 1),
      )
    : 1;

  // Add-ons resolved from the villa's own list so prices come from the DB.
  const villaServices = parseServiceList(villa.services);
  const extras = [
    ...new Set(
      (input.services ?? []).filter(
        (i) => Number.isInteger(i) && i >= 0 && i < villaServices.length,
      ),
    ),
  ]
    .map((i) => villaServices[i])
    .filter((s) => s.price > 0);

  // Owner-granted discount, clamped to sane bounds and stored on the booking so
  // the guest's payment page shows exactly what was promised on the phone.
  const discPct = Math.min(90, Math.max(0, Math.trunc(Number(input.discPct ?? 0)) || 0));
  const discFixed = Math.max(
    0,
    Math.round((Number(input.discFixed ?? 0) || 0) * 100) / 100,
  );

  let outcome: { id: number } | { error: string };
  try {
    outcome = await tx(async () => {
      /* MERGE: if this guest already holds a stay here that overlaps the new
         dates, this booking is an UPGRADE of that stay, not a second one — a
         guest who paid for 5 rooms 24–26 and asked the host for 7 rooms 24–29
         should end up with ONE booking of 7 rooms 24–29, not 5+7 overlapping.
         The old row is grown in place (same id, still 'accepted' so the rooms
         it already paid for stay held) and what was paid for it is stored as a
         credit against the new total. */
      const overlapping = (await db
        .prepare(
          `SELECT id, check_in, check_out, rooms, room_plan, extras,
                  disc_pct, disc_fixed, coupon_code
           FROM bookings
           WHERE villa_id = ? AND guest_id = ? AND status = 'accepted'
             AND package_id IS NULL AND check_in < ? AND check_out > ?`,
        )
        .all(villa.id, guestId, checkOut, checkIn)) as {
        id: number;
        check_in: string;
        check_out: string;
        rooms: number;
        room_plan: string;
        extras: string;
        disc_pct: number;
        disc_fixed: number;
        coupon_code: string;
      }[];

      if (overlapping.length > 1)
        return {
          error:
            "This guest has several overlapping stays here — cancel or adjust them from Rent Requests first, then book the combined stay.",
        };
      if (overlapping.length === 1 && parseRoomPlan(overlapping[0].room_plan))
        return {
          error:
            "This guest's overlapping stay holds different rooms on different nights, so it can't be folded in automatically. Cancel it from Rent Requests first, then book the combined stay.",
        };

      // What the stay actually SLEEPS — the guests ceiling for both branches.
      // Room-based: rooms × per-room occupancy (an adjusted plan sums its
      // legs below); whole-villa kinds: the listing's own capacity. Enforced
      // here like everywhere else — an owner can offer more rooms, not more
      // beds, and a stale client mustn't oversell them.
      const perRoom = Math.max(1, villa.people_per_room);
      const flatCap = roomBased
        ? roomsNeeded * perRoom
        : Math.max(1, villa.max_guests);
      const capError = (cap: number) => ({
        error: `${roomBased ? `${roomsNeeded} room${roomsNeeded === 1 ? "" : "s"} sleep${roomsNeeded === 1 ? "s" : ""}` : "This villa sleeps"} up to ${cap} guest${cap === 1 ? "" : "s"}.`,
      });

      if (overlapping.length === 1) {
        const old = overlapping[0];
        // The upgraded stay covers everything either booking did.
        const unionIn = old.check_in < checkIn ? old.check_in : checkIn;
        const unionOut = old.check_out > checkOut ? old.check_out : checkOut;
        // The old row's own rooms are being replaced, so they don't count
        // against the upgrade's availability.
        if (!(await isVillaAvailable(villa.id, unionIn, unionOut, roomsNeeded, old.id)))
          return { error: "Those rooms aren't free across the combined dates." };
        if (guests > flatCap) return capError(flatCap);

        // What the guest already paid for the old stay, at the same quote its
        // checkout used — credited against the upgraded total.
        // Any discount the old stay carried (a coupon, or an earlier owner
        // discount) came OFF what they paid, so it comes off the credit too —
        // with a coupon's $1 floor honoured, exactly as their checkout charged.
        const oldExtras = parseServiceList(old.extras);
        const oldNights = Math.max(1, nightsBetween(old.check_in, old.check_out));
        const oldBase =
          quote(
            villa.price * (roomBased ? Math.max(1, old.rooms) : 1),
            oldNights,
            villa.discount,
          ).total + oldExtras.reduce((s, e) => s + e.price, 0);
        const oldDiscount = Math.min(
          old.coupon_code ? Math.max(0, oldBase - 1) : oldBase,
          (oldBase * Math.max(0, old.disc_pct)) / 100 + Math.max(0, old.disc_fixed),
        );
        const credit = Math.round((oldBase - oldDiscount) * 100) / 100;

        // Add-ons the old stay already paid for come along; new picks add to
        // them (deduped by name — an add-on isn't bought twice).
        const mergedExtras = [
          ...oldExtras,
          ...extras.filter((e) => !oldExtras.some((o) => o.name === e.name)),
        ];

        await db
          .prepare(
            `UPDATE bookings
             SET dates = ?, check_in = ?, check_out = ?, guests = ?, rooms = ?,
                 room_plan = '', extras = ?, payment_due = 1,
                 disc_pct = ?, disc_fixed = ?, paid_credit = ?,
                 coupon_code = ''
             WHERE id = ?`,
          )
          .run(
            formatRange(unionIn, unionOut),
            unionIn,
            unionOut,
            guests,
            roomsNeeded,
            JSON.stringify(mergedExtras),
            discPct,
            discFixed,
            credit,
            old.id,
          );
        return { id: old.id };
      }

      /* The ask can't be held every night, but the owner chose to give each
         night what it has — the same room_plan shape guests book themselves,
         re-derived HERE (inventory-only: a host has no per-guest allowance) so
         a stale client can't submit legs the calendar has since outgrown. A
         plan that comes back flat means flexing buys nothing — fall through to
         the plain flat check below so a too-big ask still fails honestly. */
      let plan: RoomSegment[] = [];
      if (roomBased && input.flex) {
        const offered = await getRoomPlan(villa.id, checkIn, checkOut, roomsNeeded, 0, 0);
        if (isGraduated(offered) && (await isPlanAvailable(villa.id, offered)))
          plan = offered;
      }
      if (plan.length === 0 && !(await isVillaAvailable(villa.id, checkIn, checkOut, roomsNeeded)))
        return {
          error: roomBased
            ? "Those rooms aren't free for these dates. Try fewer rooms or different dates."
            : "This villa is already booked for those dates. Try different dates.",
        };
      // An adjusted stay sleeps what its legs sleep, summed — same rule the
      // guest flow enforces.
      const cap =
        plan.length > 0
          ? plan.reduce((s, leg) => s + leg.rooms * perRoom, 0)
          : flatCap;
      if (guests > cap) return capError(cap);
      // 'pending' + payment_due = 1: nobody has paid, so this holds NOTHING —
      // only 'accepted' rows count towards availability. The rooms are reserved
      // at the moment the guest pays (payBookingAction), not now, so an unpaid
      // booking can never sit on inventory a paying guest could have had.
      const inserted = await db
        .prepare(
          `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, rooms, room_plan, extras, package_id, package, payment_due, disc_pct, disc_fixed, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '', 1, ?, ?, 'pending') RETURNING id`,
        )
        .run(
          villa.id,
          guestId,
          formatRange(checkIn, checkOut),
          checkIn,
          checkOut,
          guests,
          plan.length > 0 ? planMaxRooms(plan) : roomsNeeded,
          serializeRoomPlan(plan),
          JSON.stringify(extras),
          discPct,
          discFixed,
        );
      return { id: inserted.lastInsertRowid as number };
    });
  } catch {
    return fail("Something went wrong creating the booking. Please try again.");
  }
  if ("error" in outcome) return fail(outcome.error);
  const bookingId = outcome.id;

  // The guest never asked for this stay — the host arranged it — so the only
  // way they learn it's waiting on them is if we tell them. Straight to the
  // page that can settle it.
  await notify({
    userId: guestId,
    type: "payment_request",
    title: `${displayName(user)} booked ${villa.name} for you`,
    body: `${formatRange(checkIn, checkOut)} — waiting to be paid. Your room${
      roomsNeeded === 1 ? " isn't" : "s aren't"
    } held until it is.`,
    href: "/profile/payments",
  });

  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  revalidatePath("/profile/properties");
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true, reference: bookingReference(bookingId) };
}

/**
 * Pay for an owner-made booking — which is what actually reserves it.
 *
 * An unpaid booking is 'pending' and holds no rooms, so paying is not a
 * bookkeeping update: it's the reservation itself. That means availability must
 * be checked HERE, at payment time, exactly as it is for a normal checkout —
 * between the owner arranging the stay and the guest paying for it, someone else
 * may have taken the rooms. Check and flip run in one transaction so two guests
 * can't both pay their way into the same room.
 *
 * The WHERE clause carries the rest of the guard: only this guest's own,
 * still-pending, still-unpaid booking matches, so paying twice (or paying
 * someone else's stay) changes nothing.
 */
export async function payBookingAction(
  bookingId: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const db = getDb();
  const booking = (await db
    .prepare(
      `SELECT id, villa_id, check_in, check_out, rooms, room_plan, status, payment_due
       FROM bookings WHERE id = ? AND guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | {
        id: number;
        villa_id: number;
        check_in: string;
        check_out: string;
        rooms: number;
        room_plan: string;
        status: string;
        payment_due: number;
      }
    | undefined;
  // Two payable shapes: a fresh owner-made booking ('pending', holds nothing
  // until paid) and a merged UPGRADE of an already-paid stay ('accepted' with a
  // balance due — its rooms are held; paying settles the difference).
  if (
    !booking ||
    booking.payment_due !== 1 ||
    (booking.status !== "pending" && booking.status !== "accepted")
  )
    return fail("This booking isn't awaiting payment any more.");
  if (booking.check_in < todayKey())
    return fail("This stay has already started and can no longer be paid for.");

  let ok = false;
  try {
    ok = await tx(async () => {
      // Excluding this booking is a no-op today (a pending row is invisible to
      // the availability engine) but is the honest thing to ask: "is there room
      // for this stay, ignoring itself?" A stay that holds different rooms on
      // different nights is checked leg by leg — its peak count would wrongly
      // fail on nights it only takes a few.
      const payPlan = parseRoomPlan(booking.room_plan);
      const free = payPlan
        ? await isPlanAvailable(booking.villa_id, payPlan, booking.id)
        : await isVillaAvailable(
            booking.villa_id,
            booking.check_in,
            booking.check_out,
            Math.max(1, booking.rooms),
            booking.id,
          );
      if (!free) return false;
      const res = await db
        .prepare(
          `UPDATE bookings SET payment_due = 0, status = 'accepted'
           WHERE id = ? AND guest_id = ? AND payment_due = 1
             AND status IN ('pending', 'accepted')`,
        )
        .run(bookingId, user.id);
      return res.changes > 0;
    });
  } catch {
    return fail("Something went wrong taking your payment. Please try again.");
  }
  if (!ok)
    return fail(
      "Those rooms were taken before this booking was paid for. Ask your host to arrange new dates.",
    );

  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  // The stay only now holds its rooms, so availability changed everywhere.
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/* -------------------------------- coupons -------------------------------- */

/** Codes read like codes: 3–20 chars of A–Z, digits and hyphens. Normalised to
 *  uppercase so SAVE10 and save10 are the same coupon everywhere. */
const COUPON_CODE_RE = /^[A-Z0-9-]{3,20}$/;

export type CouponResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** On a duplicate code: free variations of the attempted name the owner
       *  can pick instead of inventing one from scratch. */
      suggestions?: string[];
    };

/**
 * Create a coupon for one of the owner's own properties.
 *
 * The discount is one thing or the other, never both, and never degenerate:
 * a percentage is 1–99 (0 is no coupon, 100 is a free stay), a fixed amount is
 * strictly positive. Redemption separately guarantees a fixed discount can't
 * take a stay's price below $1. Codes are globally unique — a duplicate is
 * refused with a few free variations suggested.
 */
export async function createCouponAction(input: {
  villaId: number;
  code: string;
  pct?: number;
  fixed?: number;
}): Promise<CouponResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const db = getDb();
  const villa = (await db
    .prepare("SELECT id, owner_id FROM villas WHERE id = ?")
    .get(Math.trunc(Number(input.villaId)))) as
    | { id: number; owner_id: number }
    | undefined;
  if (!villa || villa.owner_id !== user.id)
    return { ok: false, error: "Pick one of your own properties." };

  const code = input.code.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(code))
    return {
      ok: false,
      error: "Codes are 3–20 letters, numbers or hyphens (e.g. SUMMER-10).",
    };

  const pct = Math.trunc(Number(input.pct ?? 0)) || 0;
  const fixed = Math.round((Number(input.fixed ?? 0) || 0) * 100) / 100;
  if ((pct > 0) === (fixed > 0))
    return {
      ok: false,
      error: "Give the coupon ONE discount: a percentage or a fixed amount.",
    };
  // Never 0 and never 100: 0% is not a coupon and 100% is a free stay.
  if (pct !== 0 && (pct < 1 || pct > 99))
    return { ok: false, error: "A percentage discount must be between 1 and 99." };
  // A fixed discount must be a real amount. (At redemption it still can't take
  // the price below $1, however large it is.)
  if (fixed < 0 || (pct === 0 && fixed <= 0))
    return { ok: false, error: "A fixed discount must be more than $0." };

  // Codes are globally unique. On a clash, offer variations of the SAME name
  // that are actually free, so the owner keeps the code they had in mind.
  const taken = await getCouponCodesLike(code);
  if (taken.has(code)) {
    const candidates: string[] = [];
    for (let n = 2; n <= 99 && candidates.length < 3; n++) {
      const c = `${code}-${n}`.slice(0, 20);
      if (!taken.has(c) && !candidates.includes(c)) candidates.push(c);
    }
    for (const suffix of ["-NEW", "-PLUS", "-VIP"]) {
      if (candidates.length >= 3) break;
      const c = `${code.slice(0, 20 - suffix.length)}${suffix}`;
      if (!taken.has(c) && !candidates.includes(c)) candidates.push(c);
    }
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try one of these instead:`,
      suggestions: candidates,
    };
  }

  try {
    await db
      .prepare(
        "INSERT INTO coupons (villa_id, code, pct, fixed) VALUES (?, ?, ?, ?)",
      )
      .run(villa.id, code, pct, fixed);
  } catch {
    // The unique index is the real referee — two owners saving the same code
    // at once both passed the check above; one of them lands here.
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try a variation.`,
    };
  }

  revalidatePath("/profile/coupons");
  return { ok: true };
}

/**
 * Edit one of the owner's coupons — code, discount and even which property it
 * belongs to. Same rules as creating one (1–99% or > $0, one or the other,
 * globally unique code — this coupon's own current code excepted). Stays that
 * already redeemed it keep their snapshotted discount; edits only change what
 * FUTURE redemptions get.
 */
export async function updateCouponAction(input: {
  couponId: number;
  villaId: number;
  code: string;
  pct?: number;
  fixed?: number;
}): Promise<CouponResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const db = getDb();
  // Both ends must be the owner's: the coupon being edited AND the property
  // it's being (re)attached to.
  const coupon = (await db
    .prepare(
      `SELECT c.id, c.code FROM coupons c JOIN villas v ON v.id = c.villa_id
       WHERE c.id = ? AND v.owner_id = ?`,
    )
    .get(Math.trunc(Number(input.couponId)), user.id)) as
    | { id: number; code: string }
    | undefined;
  if (!coupon) return { ok: false, error: "Coupon not found." };

  // A coupon that an in-flight booking is riding on is frozen: the owner can't
  // change its code, discount or property while a stay that redeemed it is still
  // pending or yet to complete. The lock lifts on its own once every such stay
  // completes. Checked against the coupon's CURRENT code — that's what bookings
  // snapshotted — so a rename can't slip the lock. (Existing bookings keep their
  // own snapshot regardless; this is about not moving the goalposts mid-stay.)
  if (await isCouponInUse(coupon.code))
    return {
      ok: false,
      error:
        "This coupon is being used by a booking. You can edit it once that stay is completed.",
    };

  const villa = (await db
    .prepare("SELECT id, owner_id FROM villas WHERE id = ?")
    .get(Math.trunc(Number(input.villaId)))) as
    | { id: number; owner_id: number }
    | undefined;
  if (!villa || villa.owner_id !== user.id)
    return { ok: false, error: "Pick one of your own properties." };

  const code = input.code.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(code))
    return {
      ok: false,
      error: "Codes are 3–20 letters, numbers or hyphens (e.g. SUMMER-10).",
    };

  const pct = Math.trunc(Number(input.pct ?? 0)) || 0;
  const fixed = Math.round((Number(input.fixed ?? 0) || 0) * 100) / 100;
  if ((pct > 0) === (fixed > 0))
    return {
      ok: false,
      error: "Give the coupon ONE discount: a percentage or a fixed amount.",
    };
  if (pct !== 0 && (pct < 1 || pct > 99))
    return { ok: false, error: "A percentage discount must be between 1 and 99." };
  if (fixed < 0 || (pct === 0 && fixed <= 0))
    return { ok: false, error: "A fixed discount must be more than $0." };

  // Unique across the site — except against ITSELF, so saving without
  // renaming never trips the check.
  const existing = await findCoupon(code);
  if (existing && existing.id !== coupon.id) {
    const taken = await getCouponCodesLike(code);
    const candidates: string[] = [];
    for (let n = 2; n <= 99 && candidates.length < 3; n++) {
      const c = `${code}-${n}`.slice(0, 20);
      if (!taken.has(c) && !candidates.includes(c)) candidates.push(c);
    }
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try one of these instead:`,
      suggestions: candidates,
    };
  }

  try {
    await db
      .prepare(
        "UPDATE coupons SET villa_id = ?, code = ?, pct = ?, fixed = ? WHERE id = ?",
      )
      .run(villa.id, code, pct, fixed, coupon.id);
  } catch {
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try a variation.`,
    };
  }

  revalidatePath("/profile/coupons");
  return { ok: true };
}

/**
 * Delete one of the owner's coupons.
 *
 * Refused while the coupon is in use — a still-standing booking (pending, or
 * accepted and not yet completed) redeemed it — mirroring the edit lock, so an
 * owner can't yank a code out from under an in-flight stay. The block lifts on
 * its own once every such stay completes. Bookings that already redeemed it keep
 * their snapshotted discount regardless, so deleting only stops NEW redemptions.
 */
export async function deleteCouponAction(couponId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const db = getDb();
  // Scope to the owner AND read the code, so the in-use check runs against the
  // exact code bookings snapshotted — the same authority the edit lock uses.
  const coupon = (await db
    .prepare(
      `SELECT c.id, c.code FROM coupons c JOIN villas v ON v.id = c.villa_id
       WHERE c.id = ? AND v.owner_id = ?`,
    )
    .get(Math.trunc(Number(couponId)), user.id)) as
    | { id: number; code: string }
    | undefined;
  if (!coupon) return fail("Coupon not found.");

  if (await isCouponInUse(coupon.code))
    return fail(
      "This coupon is being used by a booking. You can delete it once that stay is completed.",
    );

  await db.prepare("DELETE FROM coupons WHERE id = ?").run(coupon.id);
  revalidatePath("/profile/coupons");
  return { ok: true };
}
