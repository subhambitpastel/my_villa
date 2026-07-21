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
import {
  findCoupon,
  getCouponCodesLike,
  getPackageBookingLock,
  getVillaBookingLock,
  isCouponInUse,
} from "./queries";
import {
  cleanPackagePrice,
  normalizeInclusions,
  parsePackageType,
  resolvedDiscount,
  resolvedNights,
  validatePackageInput,
  type PackageInput,
  type PackageVilla,
} from "./packageTypes";
import { couponSuggestions, validateCoupon } from "./coupons";
import { notify, displayName } from "./notify";
import {
  MAX_REVIEW_NOTE,
  recomputeVillaRating,
  recordReviewEvent,
} from "./reviews";
import type { ActionResult, CouponResult } from "./actions";

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

/** The property a coupon is being attached to, as support picked it. Any
 *  listing on the platform qualifies — that's the whole point of the super
 *  user — so the only check is that it exists. */
async function couponVilla(
  villaId: number,
): Promise<{ id: number; owner_id: number; name: string } | undefined> {
  return (await getDb()
    .prepare("SELECT id, owner_id, name FROM villas WHERE id = ?")
    .get(Math.trunc(Number(villaId)))) as
    | { id: number; owner_id: number; name: string }
    | undefined;
}

/** A coupon's discount in words, for the owner's notification. */
const discountWords = (pct: number, fixed: number) =>
  pct > 0 ? `${pct}% off` : `$${fixed.toFixed(2)} off`;

/**
 * Create a coupon on ANY listing — hotel, resort or villa, whoever owns it.
 *
 * Identical rules to the owner's own desk (shared in coupons.ts so the two
 * can't drift): 1–99% or a fixed amount over $0, one or the other, and a
 * globally unique code with free variations suggested on a clash. The only
 * difference is reach: support isn't limited to their own properties.
 */
export async function adminCreateCouponAction(input: {
  villaId: number;
  code: string;
  pct?: number;
  fixed?: number;
}): Promise<CouponResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const villa = await couponVilla(input.villaId);
  if (!villa) return fail("Pick a property for this coupon.");

  const checked = validateCoupon(input);
  if (!checked.ok) return fail(checked.error);
  const { code, pct, fixed } = checked.values;

  const taken = await getCouponCodesLike(code);
  if (taken.has(code))
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try one of these instead:`,
      suggestions: couponSuggestions(code, taken),
    };

  try {
    await getDb()
      .prepare("INSERT INTO coupons (villa_id, code, pct, fixed) VALUES (?, ?, ?, ?)")
      .run(villa.id, code, pct, fixed);
  } catch {
    // The unique index is the real referee for a concurrent save.
    return fail(
      `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try a variation.`,
    );
  }

  await notify({
    userId: villa.owner_id,
    type: "moderation",
    title: `MyVilla support added a coupon to ${villa.name}`,
    body: `${code} — ${discountWords(pct, fixed)}. Guests can use it at checkout now.`,
    href: "/profile/coupons",
  });

  revalidatePath("/admin/coupons");
  revalidatePath("/profile/coupons");
  return { ok: true };
}

/**
 * Edit any owner's coupon — its property, its code and its discount.
 *
 * Same rules the owner's own editor follows (shared with it in coupons.ts, so
 * the two can't drift): 1–99% or a fixed amount over $0, one or the other, and
 * a globally unique code (this coupon's own excepted). Keeps the in-use refusal
 * too — a code a standing booking is riding on isn't moved under it. Unlike the
 * owner, support can re-home it to ANY listing on the platform.
 *
 * Stays that already redeemed it keep their snapshotted discount; edits only
 * change what FUTURE redemptions get.
 */
export async function adminUpdateCouponAction(input: {
  couponId: number;
  villaId: number;
  code: string;
  pct?: number;
  fixed?: number;
}): Promise<CouponResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const db = getDb();
  const coupon = (await db
    .prepare(
      `SELECT c.id, c.code, c.villa_id, v.owner_id, v.name AS villa_name
       FROM coupons c JOIN villas v ON v.id = c.villa_id WHERE c.id = ?`,
    )
    .get(Math.trunc(Number(input.couponId)))) as
    | {
        id: number;
        code: string;
        villa_id: number;
        owner_id: number;
        villa_name: string;
      }
    | undefined;
  if (!coupon) return fail("Coupon not found.");

  if (await isCouponInUse(coupon.code))
    return fail(
      "A standing booking is using this coupon, so it can't be edited yet. It unlocks once that stay completes.",
    );

  const villa = await couponVilla(input.villaId);
  if (!villa) return fail("Pick a property for this coupon.");

  const checked = validateCoupon(input);
  if (!checked.ok) return fail(checked.error);
  const { code, pct, fixed } = checked.values;

  const existing = await findCoupon(code);
  if (existing && existing.id !== coupon.id) {
    const taken = await getCouponCodesLike(code);
    return {
      ok: false,
      error: `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try one of these instead:`,
      suggestions: couponSuggestions(code, taken),
    };
  }

  try {
    await db
      .prepare(
        "UPDATE coupons SET villa_id = ?, code = ?, pct = ?, fixed = ? WHERE id = ?",
      )
      .run(villa.id, code, pct, fixed, coupon.id);
  } catch {
    // The unique index is the real referee for a concurrent save.
    return fail(
      `A ${code} coupon already exists. Coupon codes are unique across MyVilla — try a variation.`,
    );
  }

  await notify({
    userId: villa.owner_id,
    type: "moderation",
    title: `Your coupon ${coupon.code} was changed by MyVilla support`,
    body: `${villa.name} — it's now ${code}, ${discountWords(pct, fixed)}. Stays that already used it keep their original discount.`,
    href: "/profile/coupons",
  });
  // Re-homed to someone else's listing: the previous owner would otherwise just
  // see the code disappear, so tell them where it went.
  if (villa.owner_id !== coupon.owner_id)
    await notify({
      userId: coupon.owner_id,
      type: "moderation",
      title: `Your coupon ${coupon.code} was moved off ${coupon.villa_name} by MyVilla support`,
      body: "It no longer applies to your listing. Stays that already used it keep their discount.",
      href: "/profile/coupons",
    });

  revalidatePath("/admin/coupons");
  revalidatePath("/profile/coupons");
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

/** Lock or unlock any listing by flipping the OWNER'S own switch on their
 *  behalf — locked stops NEW bookings; existing stays are honoured. The owner
 *  can undo this from My Properties; use the admin lock below when they
 *  shouldn't be able to. */
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
 * Support's own lock on a listing — the enforcement lever.
 *
 * Identical market effect to the owner's lock (out of search and browse, no new
 * bookings, existing stays honoured), but it lives in its own column so the
 * owner's switch can't clear it: while this is set, `setVillaLockedAction`
 * refuses and the owner's booking-for-a-guest flow is closed too. Only an admin
 * can lift it, which is what makes it a moderation decision rather than a
 * suggestion. The two locks are independent — clearing this one leaves the
 * owner's own lock exactly as they left it.
 */
export async function adminSetVillaAdminLockedAction(
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
    .prepare("UPDATE villas SET admin_locked_at = ? WHERE id = ?")
    .run(locked ? nowIso() : null, villa.id);
  await notify({
    userId: villa.owner_id,
    type: "moderation",
    title: `Your listing ${villa.name} was ${locked ? "locked" : "unlocked"} by MyVilla support`,
    body: locked
      ? "It won't take new bookings, and you can't unlock it yourself — please contact support. Existing stays go ahead."
      : "Support has lifted the lock. Your own lock setting is unchanged.",
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
 * Delete any listing outright.
 *
 * Keeps the same refusal the owner's own delete enforces, and for the same
 * reason: the row CASCADES — its bookings, reviews, coupons, packages,
 * favourites and call requests all go with it — so a guest's confirmed stay
 * must never be erased underneath them. Those stays have to be cancelled first;
 * admin-locking the listing is the non-destructive way to take it off the
 * market while they play out.
 */
export async function adminDeleteVillaAction(
  villaId: number,
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

  const lock = await getVillaBookingLock(villa.id);
  if (lock.active > 0)
    return fail(
      `${villa.name} still has ${lock.active} active booking${
        lock.active === 1 ? "" : "s"
      }. Cancel them first, or admin-lock the listing to retire it while those stays finish.`,
    );

  await db.prepare("DELETE FROM villas WHERE id = ?").run(villa.id);
  // The owner keeps a record of why their listing vanished. Safe after the
  // delete: notifications key off the user, not the villa.
  await notify({
    userId: villa.owner_id,
    type: "moderation",
    title: `Your listing ${villa.name} was removed by MyVilla support`,
    body: "It's no longer listed on MyVilla, along with its packages and coupons. Please contact support if you think this is a mistake.",
    href: "/profile/properties",
  });

  revalidatePath("/admin/properties");
  revalidatePath("/profile/properties");
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
  note = "",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  /* Turning a review down without saying why leaves the guest with nothing to
     act on — they wrote something in good faith and it vanished. The reason is
     required, and it is what they are shown. */
  const reason = note.trim().slice(0, MAX_REVIEW_NOTE);
  if (status === "rejected" && reason.length < 3)
    return fail("Say why you're turning this review down.");

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
  await recordReviewEvent({
    reviewId: review.id,
    kind: status,
    actorId: admin.id,
    byAdmin: true,
    note: reason,
    stars: review.stars,
    comment: review.comment,
  });

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
      body: reason,
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

/* ---------------------------- packages ---------------------------- */

/** The package and the villa it sits on, whoever owns them. */
async function packageForAdmin(packageId: number) {
  return (await getDb()
    .prepare(
      `SELECT p.id, p.name, p.villa_id, p.owner_id, p.max_guests,
              v.kind, v.rooms, v.people_per_room, v.max_guests AS villa_max_guests,
              v.name AS villa_name
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.id = ?`,
    )
    .get(Math.trunc(Number(packageId)))) as
    | {
        id: number;
        name: string;
        villa_id: number;
        owner_id: number;
        max_guests: number;
        kind: string;
        rooms: number;
        people_per_room: number;
        villa_max_guests: number;
        villa_name: string;
      }
    | undefined;
}

/**
 * Edit any owner's package.
 *
 * Held to exactly the rules the owner is held to — the shared
 * validatePackageInput, the preset nights/discount, and the frozen guest count
 * while stays are riding on it. Support correcting a listing is not a licence
 * to put it in a state its owner could never have created, or to shrink a
 * package below what someone has already booked.
 *
 * The villa is NOT movable: a package belongs to the property it describes,
 * and re-homing one would silently change what a booked guest is owed.
 */
export async function adminUpdatePackageAction(
  packageId: number,
  input: PackageInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const pkg = await packageForAdmin(packageId);
  if (!pkg) return fail("Package not found.");

  const villa: PackageVilla = {
    kind: pkg.kind,
    rooms: pkg.rooms,
    people_per_room: pkg.people_per_room,
    max_guests: pkg.villa_max_guests,
  };
  // Whatever the form sent, this package stays on its own villa.
  const scoped: PackageInput = { ...input, villaId: pkg.villa_id };
  const invalid = validatePackageInput(scoped, villa);
  if (invalid) return fail(invalid);

  const maxGuests = Math.max(1, Math.trunc(scoped.maxGuests));
  if (maxGuests !== pkg.max_guests) {
    const lock = await getPackageBookingLock(pkg.id);
    if (lock.active > 0)
      return fail(
        `This package has ${lock.active} active booking${
          lock.active === 1 ? "" : "s"
        }, so its guest count can't be changed until those stays are completed.`,
      );
  }

  await getDb()
    .prepare(
      `UPDATE packages
       SET name = ?, description = ?, type = ?, nights = ?, max_guests = ?,
           discount = ?, price = ?, inclusions = ?
       WHERE id = ?`,
    )
    .run(
      scoped.name.trim(),
      scoped.description.trim(),
      parsePackageType(scoped.type),
      resolvedNights(scoped),
      maxGuests,
      resolvedDiscount(scoped),
      cleanPackagePrice(scoped.price),
      JSON.stringify(normalizeInclusions(scoped.inclusions)),
      pkg.id,
    );

  await notify({
    userId: pkg.owner_id,
    type: "moderation",
    title: `Your package "${scoped.name.trim()}" was edited by MyVilla support`,
    body: `On ${pkg.villa_name}. Stays already booked on it keep the terms they were sold.`,
    href: "/profile/packages",
  });

  revalidatePath("/admin/packages");
  revalidatePath("/profile/packages");
  revalidatePath("/packages");
  revalidatePath("/place");
  return { ok: true };
}

/**
 * Remove any owner's package.
 *
 * Allowed even with stays riding on it, and deliberately so: a booking
 * snapshots {name, nights, guests, price, inclusions} onto itself at checkout
 * and holds package_id only as a soft reference, so deleting the package
 * cannot change what a booked guest is owed. The confirm dialog says how many
 * stays are attached, because "nothing breaks" is not the same as "nobody is
 * affected" — those guests keep arriving, and their host should know the
 * bundle is gone.
 */
export async function adminDeletePackageAction(
  packageId: number,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Not authorized.");

  const pkg = await packageForAdmin(packageId);
  if (!pkg) return fail("Package not found.");

  await getDb().prepare("DELETE FROM packages WHERE id = ?").run(pkg.id);

  await notify({
    userId: pkg.owner_id,
    type: "moderation",
    title: `Your package "${pkg.name}" was removed by MyVilla support`,
    body: `On ${pkg.villa_name}. Stays already booked on it go ahead exactly as sold.`,
    href: "/profile/packages",
  });

  revalidatePath("/admin/packages");
  revalidatePath("/profile/packages");
  revalidatePath("/packages");
  revalidatePath("/place");
  return { ok: true };
}
