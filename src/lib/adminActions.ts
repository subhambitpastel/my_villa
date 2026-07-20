"use server";

// Server actions for the /admin back office. Every mutating action begins with
// requireAdmin() — the layout redirect is only navigation, THIS is the write
// boundary a forged request has to get past.

import { revalidatePath } from "next/cache";
import { getDb, type UserRow } from "./db";
import { verifyPassword } from "./password";
import { nowIso } from "./clock";
import { createSession, getCurrentUser, type SessionUser } from "./session";
import { clientIp, rateLimit } from "./rateLimit";
import { isCouponInUse } from "./queries";
import { notify, displayName } from "./notify";
import { recomputeVillaRating } from "./reviews";
import type { ActionResult } from "./actions";

const fail = (error: string) => ({ ok: false as const, error });

/** The signed-in user when they're a live super-admin, else null. Sessions of
 *  disabled accounts already don't resolve (session.ts), so this reduces to
 *  the is_admin flag. */
async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && user.is_admin === 1 ? user : null;
}

/** The /admin/login door. One combined check — unknown email, wrong password,
 *  not an admin, disabled — all return the identical generic error, so the
 *  form can't be used to probe which accounts are admins. */
export async function adminLoginAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!rateLimit(`adminlogin:${await clientIp()}`, 10, 60_000))
    return fail("Too many attempts. Please wait a minute and try again.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Incorrect email or password.");

  const user = (await getDb()
    .prepare(
      "SELECT id, password_hash, is_admin, disabled_at FROM users WHERE email = ?",
    )
    .get(email)) as
    | Pick<UserRow, "id" | "password_hash" | "is_admin" | "disabled_at">
    | undefined;

  if (
    !user ||
    !verifyPassword(password, user.password_hash) ||
    user.is_admin !== 1 ||
    user.disabled_at
  ) {
    return fail("Incorrect email or password.");
  }

  await createSession(user.id);
  return { ok: true };
}

/* --------------------------- moderation --------------------------- */

/**
 * Cancel any stay, on any listing.
 *
 * Deliberately without the guest rule's `check_in >= today` clause: support
 * steps in precisely when something has gone wrong, which is often mid-stay.
 * Both sides are told, because neither of them did this.
 */
export async function adminCancelBookingAction(
  bookingId: number,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const db = getDb();
  const res = await db
    .prepare(
      `UPDATE bookings SET status = 'cancelled', payment_due = 0
       WHERE id = ? AND status IN ('accepted', 'pending')`,
    )
    .run(Math.trunc(Number(bookingId)));
  if (res.changes === 0)
    return fail("That booking is not one that can be cancelled.");

  // Read AFTER the update, so the news only goes out if something changed.
  const row = (await db
    .prepare(
      `SELECT b.dates, b.guest_id, v.owner_id, v.name
       FROM bookings b JOIN villas v ON v.id = b.villa_id WHERE b.id = ?`,
    )
    .get(bookingId)) as
    | { dates: string; guest_id: number; owner_id: number; name: string }
    | undefined;
  if (row) {
    await notify({
      userId: row.guest_id,
      type: "booking_cancelled",
      title: `Your stay at ${row.name} was cancelled by MyVilla support`,
      body: row.dates,
      href: "/profile/bookings",
    });
    await notify({
      userId: row.owner_id,
      type: "booking_cancelled",
      title: `A stay at ${row.name} was cancelled by MyVilla support`,
      body: row.dates,
      href: "/profile/requests",
    });
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/profile/bookings");
  revalidatePath("/profile/requests");
  // Cancelling frees those dates — refresh availability everywhere it shows.
  revalidatePath("/place");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Remove any owner's coupon.
 *
 * Keeps the in-use refusal the owner flow enforces: a code carried by a
 * standing booking stays put until that stay completes. An override would buy
 * nothing — bookings snapshot their discount at redemption, so deleting the
 * code never changes what anyone pays.
 */
export async function adminDeleteCouponAction(
  couponId: number,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const db = getDb();
  const coupon = (await db
    .prepare(
      `SELECT c.id, c.code, v.owner_id, v.name AS villa_name
       FROM coupons c JOIN villas v ON v.id = c.villa_id WHERE c.id = ?`,
    )
    .get(Math.trunc(Number(couponId)))) as
    | { id: number; code: string; owner_id: number; villa_name: string }
    | undefined;
  if (!coupon) return fail("Coupon not found.");

  if (await isCouponInUse(coupon.code))
    return fail(
      "A standing booking is using this coupon, so it can't be deleted yet. It unlocks once that stay completes.",
    );

  await db.prepare("DELETE FROM coupons WHERE id = ?").run(coupon.id);
  await notify({
    userId: coupon.owner_id,
    type: "moderation",
    title: `Your coupon ${coupon.code} was removed by MyVilla support`,
    body: coupon.villa_name,
    href: "/profile/coupons",
  });

  revalidatePath("/admin/coupons");
  revalidatePath("/profile/coupons");
  return { ok: true };
}

/** Lock or unlock any listing — locked stops NEW bookings; existing stays are
 *  honoured (the same rule the owner's own toggle follows). */
export async function adminSetVillaLockedAction(
  villaId: number,
  locked: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const db = getDb();
  const villa = (await db
    .prepare("SELECT id, owner_id, name FROM villas WHERE id = ?")
    .get(Math.trunc(Number(villaId)))) as
    | { id: number; owner_id: number; name: string }
    | undefined;
  if (!villa) return fail("Property not found.");

  await db
    .prepare("UPDATE villas SET locked_at = ? WHERE id = ?")
    .run(locked ? nowIso() : null, villa.id);
  await notify({
    userId: villa.owner_id,
    type: "moderation",
    title: `Your listing ${villa.name} was ${locked ? "locked" : "unlocked"} by MyVilla support`,
    body: locked
      ? "It won't take new bookings until it's unlocked. Existing stays go ahead."
      : "It's taking bookings again.",
    href: "/profile/properties",
  });

  revalidatePath("/admin/properties");
  revalidatePath("/profile/properties");
  // The listing leaves/rejoins search, packages and guests' favourites.
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/place");
  revalidatePath("/packages");
  revalidatePath("/profile/packages");
  revalidatePath("/profile/favorites");
  return { ok: true };
}

/**
 * Disable (or restore) an account.
 *
 * Disabling deletes their sessions so they're signed out instantly;
 * getCurrentUser's `disabled_at IS NULL` predicate is the backstop for a
 * request already in flight. No notification — they can't sign in to read
 * one; the login error is the notice.
 */
export async function adminSetUserDisabledAction(
  userId: number,
  disabled: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const id = Math.trunc(Number(userId));
  if (id === admin.id) return fail("You can't disable your own account.");

  const db = getDb();
  const target = (await db
    .prepare("SELECT id, is_admin FROM users WHERE id = ?")
    .get(id)) as { id: number; is_admin: number } | undefined;
  if (!target) return fail("User not found.");
  // Admins don't police each other — that's a database-level decision.
  if (target.is_admin === 1)
    return fail("Administrator accounts can't be disabled here.");

  await db
    .prepare("UPDATE users SET disabled_at = ? WHERE id = ?")
    .run(disabled ? nowIso() : null, id);
  if (disabled)
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Approve or reject a guest's review.
 *
 * Approving is what makes it public — until then it counts for nothing, so the
 * villa's rating is recomputed on every decision. The host hears about the
 * rating HERE rather than when it was written: news of a review nobody can see
 * (and that may never appear) is just noise.
 */
export async function adminSetReviewStatusAction(
  reviewId: number,
  status: "approved" | "rejected",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const db = getDb();
  const review = (await db
    .prepare(
      `SELECT r.id, r.villa_id, r.user_id, r.stars, r.comment, r.status,
              v.owner_id, v.name AS villa_name
       FROM reviews r JOIN villas v ON v.id = r.villa_id WHERE r.id = ?`,
    )
    .get(Math.trunc(Number(reviewId)))) as
    | {
        id: number;
        villa_id: number;
        user_id: number;
        stars: number;
        comment: string;
        status: string;
        owner_id: number;
        villa_name: string;
      }
    | undefined;
  if (!review) return fail("Review not found.");
  if (review.status === status) return { ok: true };

  await db
    .prepare("UPDATE reviews SET status = ? WHERE id = ?")
    .run(status, review.id);
  await recomputeVillaRating(review.villa_id);

  const author = (await db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(review.user_id)) as
    | { full_name: string; email: string }
    | undefined;

  if (status === "approved") {
    // A rating is the host's reputation moving — worth telling them, good or bad.
    await notify({
      userId: review.owner_id,
      type: "review",
      title: `${author ? displayName(author) : "A guest"} rated ${review.villa_name} ${review.stars} star${review.stars === 1 ? "" : "s"}`,
      body: review.comment || "No comment left.",
      href: "/account",
    });
    await notify({
      userId: review.user_id,
      type: "moderation",
      title: `Your review of ${review.villa_name} is now published`,
      body: "Thanks for sharing it.",
      href: "/profile/bookings",
    });
  } else {
    await notify({
      userId: review.user_id,
      type: "moderation",
      title: `Your review of ${review.villa_name} wasn't published`,
      body: "It didn't meet our review guidelines.",
      href: "/profile/bookings",
    });
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/profile/bookings");
  // The villa's rating just moved — refresh everywhere it shows.
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/place");
  revalidatePath("/account");
  return { ok: true };
}
