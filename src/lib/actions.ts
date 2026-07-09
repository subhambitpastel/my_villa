"use server";

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getDb, tx, type UserRow } from "./db";
import { formatRange, nightsBetween, parseDay } from "./dates";
import { bookingReference } from "./pricing";
import { isVillaAvailable } from "./queries";
import { hashPasswordSync, verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";
import { appBaseUrl, sendEmail } from "./email";
import { clientIp, rateLimit } from "./rateLimit";

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
  email: string;
  dob: string;
  address: string;
  emergency: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");

  const email = profile.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");

  const db = getDb();
  const clash = await db
    .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
    .get(email, user.id);
  if (clash) return fail("That email is already in use.");

  await db.prepare(
    `UPDATE users
     SET full_name = ?, gender = ?, email = ?, dob = ?, address = ?, emergency = ?
     WHERE id = ?`,
  ).run(
    profile.fullName.trim(),
    profile.gender,
    email,
    profile.dob.trim(),
    profile.address.trim(),
    profile.emergency.trim(),
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
  emergency: string;
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
      `UPDATE users SET full_name = ?, gender = ?, dob = ?, address = ?, emergency = ?
       WHERE id = ?`,
    )
    .run(
      input.fullName.trim(),
      input.gender,
      input.dob,
      input.address.trim(),
      input.emergency.trim(),
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
  facilities: string[];
  /** Extra services with the per-stay price the owner charges (0 = free). */
  services: { name: string; price: number }[];
  price: number;
  images?: string[];
};

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
  return null;
}

// Guests a villa can sleep — kept to a sane range so the guest picker and the
// booking-guests validation stay bounded.
function normalizeMaxGuests(value: number): number {
  return Math.min(30, Math.max(1, Math.trunc(value) || 1));
}

export async function createVillaAction(
  input: VillaInput & {
    hostProfile?: {
      fullName: string;
      gender: string;
      dob: string;
      address: string;
      emergency: string;
    };
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
      await db.prepare(
        `INSERT INTO villas
           (owner_id, name, kind, description, area, address, city, rooms, bathrooms,
            max_guests, facilities, services, price, image, images)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        normalizeMaxGuests(input.maxGuests),
        JSON.stringify(input.facilities ?? []),
        JSON.stringify(normalizeServices(input.services)),
        input.price,
        images[0],
        JSON.stringify(images),
      );

      // Listing a villa makes you a host — unlock the host tools permanently.
      await db.prepare("UPDATE users SET hosting_enabled = 1 WHERE id = ?").run(user.id);

      // The wizard's first step doubles as the host's profile — keep it saved.
      if (input.hostProfile) {
        await db.prepare(
          `UPDATE users SET full_name = ?, gender = ?, dob = ?, address = ?, emergency = ?
           WHERE id = ?`,
        ).run(
          input.hostProfile.fullName.trim(),
          input.hostProfile.gender,
          input.hostProfile.dob.trim(),
          input.hostProfile.address.trim(),
          input.hostProfile.emergency.trim(),
          user.id,
        );
      }
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
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in.");
  const invalid = validateVillaInput(input);
  if (invalid) return fail(invalid);

  const images =
    input.images && input.images.length > 0
      ? input.images
      : ["/images/host/photo-1.jpg"];

  const res = await getDb()
    .prepare(
      `UPDATE villas
       SET name = ?, kind = ?, description = ?, area = ?, address = ?, city = ?,
           rooms = ?, bathrooms = ?, max_guests = ?, facilities = ?, services = ?, price = ?,
           image = ?, images = ?
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
      normalizeMaxGuests(input.maxGuests),
      JSON.stringify(input.facilities ?? []),
      JSON.stringify(normalizeServices(input.services)),
      input.price,
      images[0],
      JSON.stringify(images),
      villaId,
      user.id,
    );
  if (res.changes === 0) return fail("Property not found.");

  revalidateVillaViews();
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

  // Deleting a villa cascades to its bookings — refuse while guests have
  // upcoming confirmed stays so their reservations aren't silently erased.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE villa_id = ? AND status = 'accepted' AND check_out >= ?`,
    )
    .get(villaId, today)) as { n: number };
  if (upcoming.n > 0)
    return fail(
      "This villa has upcoming guest bookings. You can remove it once those stays are completed or cancelled.",
    );

  await db.prepare("DELETE FROM villas WHERE id = ?").run(villaId);
  revalidateVillaViews();
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
}): Promise<BookingResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You must be signed in to book.");

  if (!parseDay(input.checkIn) || !parseDay(input.checkOut))
    return fail("Please pick valid check-in and check-out dates.");
  if (nightsBetween(input.checkIn, input.checkOut) < 1)
    return fail("Check-out must be after check-in.");
  if (input.checkIn < new Date().toISOString().slice(0, 10))
    return fail("Check-in cannot be in the past.");

  const guests = Math.trunc(input.guests);
  if (!(guests >= 1)) return fail("Guests must be at least 1.");

  const db = getDb();
  const villa = (await db
    .prepare("SELECT id, owner_id, max_guests FROM villas WHERE id = ?")
    .get(input.villaId)) as
    | { id: number; owner_id: number; max_guests: number }
    | undefined;
  if (!villa) return fail("This villa no longer exists.");
  if (villa.owner_id === user.id)
    return fail("You cannot book your own villa.");
  if (guests > villa.max_guests)
    return fail(
      `This villa sleeps up to ${villa.max_guests} guest${villa.max_guests === 1 ? "" : "s"}.`,
    );

  // Availability check + insert must be atomic so two concurrent bookings
  // can't both pass the overlap check and double-book. IMMEDIATE takes the
  // write lock before the check; a re-check inside the tx is the guard.
  let bookingId: number | null = null;
  try {
    bookingId = await tx(async () => {
      if (!(await isVillaAvailable(villa.id, input.checkIn, input.checkOut)))
        return null;
      const inserted = await db
        .prepare(
          `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, status)
           VALUES (?, ?, ?, ?, ?, ?, 'accepted') RETURNING id`,
        )
        .run(
          villa.id,
          user.id,
          formatRange(input.checkIn, input.checkOut),
          input.checkIn,
          input.checkOut,
          guests,
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
    return fail("This villa is already booked for those dates. Try different dates.");

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

  const res = await getDb()
    .prepare(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND guest_id = ? AND status = 'accepted'`,
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
      `SELECT b.id, b.villa_id, b.status, v.max_guests
       FROM bookings b JOIN villas v ON v.id = b.villa_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, user.id)) as
    | { id: number; villa_id: number; status: string; max_guests: number }
    | undefined;
  if (!booking) return fail("Booking not found.");
  if (booking.status !== "accepted")
    return fail("Only active bookings can be changed.");
  if (guests > booking.max_guests)
    return fail(
      `This villa sleeps up to ${booking.max_guests} guest${booking.max_guests === 1 ? "" : "s"}.`,
    );

  let ok = false;
  try {
    ok = await tx(async () => {
      // Exclude THIS booking so its own current dates never count as a clash.
      if (
        !(await isVillaAvailable(
          booking.villa_id,
          input.checkIn,
          input.checkOut,
          booking.id,
        ))
      )
        return false;
      await db.prepare(
        `UPDATE bookings SET check_in = ?, check_out = ?, dates = ?, guests = ?
         WHERE id = ? AND guest_id = ? AND status = 'accepted'`,
      ).run(
        input.checkIn,
        input.checkOut,
        formatRange(input.checkIn, input.checkOut),
        guests,
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

const UPLOAD_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
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

async function saveUpload(file: File, subdir: string): Promise<string | null> {
  const ext = path.extname(file.name || "").toLowerCase();
  if (!UPLOAD_EXTS.has(ext) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return null;
  }
  const buf = Buffer.from(await file.arrayBuffer());
  // Reject files whose contents don't match a real image signature, even if
  // the extension looks fine (a valid ext + arbitrary bytes was accepted before).
  if (!sniffImage(buf)) return null;

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomBytes(8).toString("hex")}${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${subdir}/${name}`;
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
    const saved = await saveUpload(file, "villas");
    if (saved) paths.push(saved);
  }
  if (paths.length === 0) {
    return {
      ok: false,
      error: "Only JPG, PNG, WEBP, GIF or AVIF images up to 8 MB are allowed.",
    };
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

  const saved = await saveUpload(file, "avatars");
  if (!saved) {
    return fail("Only JPG, PNG, WEBP, GIF or AVIF images up to 8 MB are allowed.");
  }

  await getDb().prepare("UPDATE users SET avatar = ? WHERE id = ?").run(saved, user.id);
  revalidatePath("/profile", "layout");
  revalidatePath("/account");
  return { ok: true };
}
