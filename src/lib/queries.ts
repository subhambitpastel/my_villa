// Read-side queries mapping DB rows to the display shapes the UI renders.
import { cache } from "react";
import { getDb, timeAgo, type BookingStatus, type VillaRow } from "./db";
import { NO_ACCOUNT_COUNTS, type AccountCounts } from "./accountNav";
import type { ChatMessage } from "./callRequest";
import { FACILITY_CHIPS, type VillaService } from "@/components/host/draft";
import {
  isRoomBased,
  parseRoomPlan,
  planRoomNights,
  roomCapacity,
  roomPlanFor,
  roomsFreeForRange,
  type RoomBooking,
  type RoomSegment,
} from "./rooms";
import { GUEST_SEARCH_MIN, type GuestOption } from "./guests";
import { todayKey } from "./clock";
import {
  canEditReview,
  editHoursLeft,
  type ReviewStatus,
} from "./reviews";
import {
  NOTIFICATION_LIMIT,
  type NotificationItem,
  type NotificationType,
} from "./notifications";
import { parsePackageType, type PackageType } from "./packageTypes";
import type { PricingVilla } from "./packageForm";
import { quote } from "./pricing";
import { nightsBetween } from "./dates";

export type PropertyItem = {
  id: number;
  name: string;
  kind: string;
  city: string;
  price: number;
  rating: number;
  reviews: number;
  posted: string;
  image: string;
  /** Capacity, so package tooling can derive rooms/occupancy per villa kind. */
  maxGuests: number;
  rooms: number;
  peoplePerRoom: number;
  /** Free amenities/services for card chips (facilities + price-0 services). */
  freeServices: string[];
  /** Whether this villa is a paid "featured" promotion on the home page. */
  featured: boolean;
  /** Host-set % off the nightly price (0 = none). */
  discount: number;
  /** Owner locked this listing: no new bookings and hidden from guests, while
   *  bookings already made still stand. */
  locked: boolean;
  /** MyVilla support locked this listing. Same market effect as `locked`, but
   *  the owner can't lift it — only an admin can. */
  adminLocked: boolean;
};

export type CatalogVilla = {
  id: number;
  name: string;
  kind: string;
  city: string;
  price: number;
  /** Host-set % off the nightly price (0 = none). */
  discount: number;
  rating: number;
  reviews: number;
  image: string;
  /** The villa's free offerings for card chips — its facilities plus any
   *  free (price 0) extra services. Empty only when the villa has neither. */
  freeServices: string[];
};

export type BookingItem = {
  id: number;
  villa: string;
  /** The property kind — "Hotel", "Resort" or a villa-rental kind — shown as a
   *  label on each booking. */
  kind: string;
  posted: string;
  /** Absolute date + time the booking was made (paid), e.g. "30 Jul 2026, 14:15". */
  bookedAt: string;
  dates: string;
  /** Nights in the stay (0 on legacy rows without stored dates). */
  nights: number;
  /** Rooms this reservation holds (1 for whole-villa stays). */
  rooms: number;
  guests: string;
  status: BookingStatus;
  /** True while the whole stay is still ahead (check-in strictly after today).
   *  A booking can only be cancelled before its start date. */
  upcoming: boolean;
  createdAt: string;
  /** Total charged at checkout — the stay (nightly quote or package price) plus
   *  any paid add-ons; recomputed the same way the payment page did. */
  amountPaid: number;
  /** The owner made this booking for the guest and nobody has paid yet — the
   *  guest owes `amountPaid` and is shown a payment request. */
  paymentDue: boolean;
  /** Coupon redeemed at checkout ('' = none) — labels the receipt's discount row and floors the charge at $1. */
  couponCode: string;
  /** The receipt behind a DUE `amountPaid`: full stay, the host's discount, and
   *  what the guest's earlier absorbed stay already paid — the same three rows
   *  the owner saw when arranging it. Null once nothing is owed. */
  pay: { fullStay: number; hostDiscount: number; alreadyPaid: number } | null;
  /** Set when the stay holds different rooms on different nights — `rooms`
   *  carries only the peak, so displays list these legs instead. */
  plan: RoomSegment[] | null;
  /** Stars the guest gave this stay, or null while unrated. */
  myRating: number | null;
  /** The guest's own review of this stay, whatever its moderation state —
   *  they always see what they wrote and where it stands. Null while unrated. */
  myReview: {
    /** The review row itself — what its history hangs off. */
    id: number;
    stars: number;
    comment: string;
    status: ReviewStatus;
    /** Why MyVilla turned it down, when it stands rejected. "" otherwise. */
    rejectedNote: string;
    /** Everything that has happened to it, oldest first. */
    history: ReviewEvent[];
    /** Still inside the 24h window in which the author may rewrite it. */
    canEdit: boolean;
    /** Whole hours of that window left (0 once closed). */
    hoursLeft: number;
  } | null;
  /** Paid add-ons the guest chose at checkout (free ones aren't stored). */
  extras: VillaService[];
  /** Set when this booking is a package (all-inclusive), else null. */
  package: PackageSnapshot | null;
};

export type RequestItem = {
  id: number;
  tenant: string;
  avatar: string;
  villa: string;
  dates: string;
  guests: string;
  /** The stay's raw bounds, YYYY-MM-DD ("" on legacy rows without stored
   *  dates). `dates` is for reading; THESE are for comparing — the admin's
   *  stay-range filter needs to sort and overlap-test them. Half-open, as
   *  everywhere else: check-out is the morning they leave. */
  checkIn: string;
  checkOut: string;
  /** Rooms this reservation holds (1 for whole-villa stays). */
  rooms: number;
  status: BookingStatus;
  /** The guest still owes money on this one — pending means unpaid-and-unheld,
   *  accepted+due means an upgraded stay whose balance isn't settled yet. */
  paymentDue: boolean;
  createdAt: string;
  /** Set when this booking is a package (all-inclusive), else null. */
  package: PackageSnapshot | null;

  /* --- the rest is for the expanded row: everything about the booking the
     collapsed line has no space for. --- */

  /** The property kind — "Hotel", "Resort" or a villa-rental kind. */
  kind: string;
  /** Nights in the stay (0 on legacy rows without stored dates). */
  nights: number;
  /** Head count as a number — `guests` is the "3 guests" label for display. */
  guestCount: number;
  /** The guest's user id, so a filter can group by person rather than by a
   *  name two accounts might share. */
  guestId: number;
  /** Absolute date + time the guest booked, e.g. "30 Jul 2026, 14:15". */
  bookedAt: string;
  /** What the stay is worth: paid already, or owed if `paymentDue`. */
  amount: number;
  /** Coupon redeemed at checkout ('' = none) — labels the receipt's discount row and floors the charge at $1. */
  couponCode: string;
  /** The receipt behind `amount` — full stay, the discount the owner gave, and
   *  any credit from a stay this one absorbed. */
  money: BookingMoney;
  /** How to reach the guest — the host may need to, and hunting for it in
   *  another tab is the whole reason this panel exists. */
  guestEmail: string;
  guestCustomerId: string;
  guestPhone: string;
  /** Paid add-ons the guest chose (free ones aren't stored). */
  extras: VillaService[];
  /** Per-leg room counts when the stay's rooms change mid-way; [] otherwise. */
  roomPlan: RoomSegment[];
  villaId: number;
  /** The property's owner — the admin's Bookings list shows both sides. */
  ownerId: number;
  ownerName: string;
};

export type PackageItem = {
  id: number;
  villaId: number;
  villaName: string;
  villaCity: string;
  villaKind: string;
  villaImage: string;
  name: string;
  description: string;
  type: PackageType;
  nights: number;
  maxGuests: number;
  /** Advertised % off the nightly rate (0 = none). */
  discount: number;
  price: number; // all-inclusive total for the N-night stay
  /** Included experiences — all mandatory, guests can't unbundle them. */
  inclusions: string[];
  /** Owner locked this package: no new bookings, hidden from guests. Always
   *  false on guest-facing listings, which filter locked rows out entirely. */
  locked: boolean;
  /** The villa itself is locked, which suppresses this package regardless of
   *  `locked`. Only meaningful on the owner's own listing. */
  villaLocked: boolean;
};

/** Snapshot of a booked package, stored on the booking so history survives the
 *  package being edited or deleted. */
export type PackageSnapshot = {
  name: string;
  nights: number;
  guests: number;
  price: number;
  inclusions: string[];
};

/** A package plus the villa-capacity fields needed to book it server-side. */
export type PackageForBooking = {
  id: number;
  villaId: number;
  ownerId: number;
  villaKind: string;
  villaRooms: number;
  peoplePerRoom: number;
  villaMaxGuests: number;
  name: string;
  nights: number;
  maxGuests: number;
  price: number;
  inclusions: string[];
  /** True when this package OR its villa is locked — either way it takes no
   *  new bookings. Collapsed to one flag because callers only need the verdict. */
  locked: boolean;
};

export type VillaDetail = VillaRow & {
  hostName: string;
  hostAvatar: string;
  hostJoined: string;
  facilityList: string[];
  serviceList: VillaService[];
  gallery: string[];
};

export type SearchFilterInput = {
  q?: string;
  min?: number;
  max?: number;
  rating?: number;
  amenities?: string[];
  /** Minimum guest capacity the place must sleep (villa max_guests >= this). */
  guests?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  /** Hero tab: resorts and hotels are their own kinds; rent = private stays. */
  type?: PropertyType;
  /** Hide this owner's villas — hosts don't browse/book their own listings. */
  excludeOwnerId?: number;
};

export type PropertyType = "resort" | "hotel" | "rent";

export function parsePropertyType(
  value: string | undefined,
): PropertyType | undefined {
  return value === "resort" || value === "hotel" || value === "rent"
    ? value
    : undefined;
}

// Rating and review count derived from the reviews table — the single source
// of truth. The villas.rating/reviews columns are a denormalized cache kept in
// sync by rateStayAction, but selecting these subqueries means a stale column
// value (e.g. old seed data) can never surface a fake number on screen. The
// villas table must be aliased `v` in the surrounding query.
const RVW_COUNT =
  "(SELECT COUNT(*) FROM reviews rv WHERE rv.villa_id = v.id AND rv.status = 'approved')";
const RVW_RATING =
  "COALESCE((SELECT ROUND(AVG(rv.stars)::numeric, 2) FROM reviews rv WHERE rv.villa_id = v.id AND rv.status = 'approved'), 0)";

/** A villas row plus the real, review-derived rating/count from RVW_* selects. */
type VillaWithReviews = VillaRow & { rvw_count: number; rvw_rating: number };

/** Free offerings shown as card chips: a villa's facilities plus any $0 services. */
function freeServicesOf(v: Pick<VillaRow, "facilities" | "services">): string[] {
  return [
    ...new Set([
      ...parseJsonList(v.facilities),
      ...parseServiceList(v.services)
        .filter((s) => s.price === 0)
        .map((s) => s.name),
    ]),
  ];
}

function toProperty(v: VillaRow): PropertyItem {
  return {
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    rating: v.rating,
    reviews: v.reviews,
    posted: timeAgo(v.created_at, "Posted"),
    image: v.image,
    maxGuests: v.max_guests,
    rooms: v.rooms,
    peoplePerRoom: v.people_per_room,
    freeServices: freeServicesOf(v),
    featured: v.featured === 1,
    discount: v.discount,
    locked: v.locked_at !== null,
    adminLocked: v.admin_locked_at !== null,
  };
}

function toCatalogVilla(v: VillaWithReviews): CatalogVilla {
  return {
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    discount: v.discount,
    rating: Number(v.rvw_rating),
    reviews: Number(v.rvw_count),
    image: v.image,
    freeServices: freeServicesOf(v),
  };
}

export async function getVillasByOwner(ownerId: number): Promise<PropertyItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM villas v WHERE v.owner_id = ? ORDER BY v.created_at DESC, v.id DESC`,
    )
    .all(ownerId)) as VillaWithReviews[];
  return rows.map((v) => ({
    ...toProperty(v),
    rating: Number(v.rvw_rating),
    reviews: Number(v.rvw_count),
  }));
}

export type AdminVillaItem = PropertyItem & {
  ownerId: number;
  ownerName: string;
};

/** Every property on the platform, locked ones included — the admin's view.
 *  Same shape the owner sees plus who owns it. */
export async function getAllVillasAdmin(): Promise<AdminVillaItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating,
              o.full_name AS owner_name, o.email AS owner_email
       FROM villas v JOIN users o ON o.id = v.owner_id
       ORDER BY v.created_at DESC, v.id DESC`,
    )
    .all()) as (VillaWithReviews & { owner_name: string; owner_email: string })[];
  return rows.map((v) => ({
    ...toProperty(v),
    rating: Number(v.rvw_rating),
    reviews: Number(v.rvw_count),
    ownerId: v.owner_id,
    ownerName: v.owner_name || v.owner_email,
  }));
}

/** One listing as a pick-list row for the admin's property pickers. */
export type AdminVillaOption = {
  id: number;
  name: string;
  kind: string;
  city: string;
  ownerName: string;
};

/** Every listing on the platform as a dropdown option — locked ones included,
 *  since support may well be setting a discount up on one. Deliberately light
 *  (no ratings, gallery or facilities): a picker row shows four fields. */
export async function getVillaOptionsAdmin(): Promise<AdminVillaOption[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.id, v.name, v.kind, v.city,
              o.full_name AS owner_name, o.email AS owner_email
       FROM villas v JOIN users o ON o.id = v.owner_id
       ORDER BY v.name ASC, v.id ASC`,
    )
    .all()) as {
    id: number;
    name: string;
    kind: string;
    city: string;
    owner_name: string;
    owner_email: string;
  }[];
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    ownerName: v.owner_name || v.owner_email,
  }));
}

/**
 * A villa is on the market only while NEITHER lock is set: the owner's own
 * (`locked_at`) or support's (`admin_locked_at`, which the owner can't lift).
 * Every guest-facing query filters on this, so the two locks are impossible to
 * tell apart from the outside — only who may lift one differs.
 *
 * `alias` is the villas table's alias in the surrounding query ("" when the
 * query selects from `villas` unaliased).
 */
export const villaLive = (alias = "v"): string => {
  const p = alias ? `${alias}.` : "";
  return `${p}locked_at IS NULL AND ${p}admin_locked_at IS NULL`;
};

// Shared column list + row mapper for the three package-listing queries.
const PKG_COLS = `p.id, p.villa_id, p.name, p.description, p.type, p.nights, p.max_guests,
  p.discount, p.price, p.inclusions, p.locked_at, v.name AS villa_name, v.city AS villa_city,
  v.kind AS villa_kind, v.image AS villa_image, v.locked_at AS villa_locked_at,
  v.admin_locked_at AS villa_admin_locked_at`;

/** A package is bookable only when neither it nor its villa is locked —
 *  locking a villa takes its packages down with it. Guest-facing package
 *  listings all filter on this; the owner's own listing deliberately doesn't,
 *  so they can still see and unlock them. */
const LIVE_PACKAGE = `p.locked_at IS NULL AND ${villaLive()}`;

type PackageJoinRow = {
  id: number;
  villa_id: number;
  name: string;
  description: string;
  type: string;
  nights: number;
  max_guests: number;
  discount: number;
  price: number;
  inclusions: string;
  locked_at: string | null;
  villa_name: string;
  villa_city: string;
  villa_kind: string;
  villa_image: string;
  villa_locked_at: string | null;
  villa_admin_locked_at: string | null;
};

function toPackageItem(r: PackageJoinRow): PackageItem {
  return {
    id: r.id,
    villaId: r.villa_id,
    villaName: r.villa_name,
    villaCity: r.villa_city,
    villaKind: r.villa_kind,
    villaImage: r.villa_image,
    name: r.name,
    description: r.description,
    type: parsePackageType(r.type),
    nights: Number(r.nights),
    maxGuests: Number(r.max_guests),
    discount: Number(r.discount),
    price: Number(r.price),
    inclusions: parseJsonList(r.inclusions),
    locked: r.locked_at !== null,
    // Either lock on the villa suppresses its packages — the owner's own or
    // support's. The owner can only clear the first.
    villaLocked:
      r.villa_locked_at !== null || r.villa_admin_locked_at !== null,
  };
}

/** Every package an owner has created, with the villa each belongs to. */
export async function getPackagesForOwner(
  ownerId: number,
): Promise<PackageItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT ${PKG_COLS}
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.owner_id = ?
       ORDER BY v.name ASC, p.created_at DESC, p.id DESC`,
    )
    .all(ownerId)) as PackageJoinRow[];
  return rows.map(toPackageItem);
}

/** Every package on the platform, locked ones included, with its owner —
 *  the admin's view. */
export async function getAllPackagesAdmin(): Promise<
  (PackageItem & {
    ownerName: string;
    activeBookings: number;
    /** The villa's own rate and capacity — the admin's edit form re-prices a
     *  package exactly as its owner's form does, and can't do that without
     *  the numbers the price is derived from. */
    villa: PricingVilla;
  })[]
> {
  // activeBookings mirrors getPackageBookingLock: a stay still to come, or one
  // waiting to be paid for. Editing the guest count is blocked while any
  // exist, and deleting says how many there are rather than leaving the admin
  // to guess who is affected.
  const today = todayKey();
  const rows = (await getDb()
    .prepare(
      `SELECT ${PKG_COLS}, o.full_name AS owner_name, o.email AS owner_email,
              v.price AS villa_price, v.discount AS villa_discount,
              v.rooms AS villa_rooms, v.people_per_room AS villa_people_per_room,
              v.max_guests AS villa_max_guests,
              (SELECT COUNT(*) FROM bookings b
                WHERE b.package_id = p.id
                  AND b.check_out >= ?
                  AND b.status IN ('pending', 'accepted')) AS active_bookings
       FROM packages p
       JOIN villas v ON v.id = p.villa_id
       JOIN users o ON o.id = p.owner_id
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all(today)) as (PackageJoinRow & {
    owner_name: string;
    owner_email: string;
    active_bookings: number;
    villa_price: number;
    villa_discount: number;
    villa_rooms: number;
    villa_people_per_room: number;
    villa_max_guests: number;
  })[];
  return rows.map((r) => ({
    ...toPackageItem(r),
    ownerName: r.owner_name || r.owner_email,
    activeBookings: Number(r.active_bookings),
    villa: {
      kind: r.villa_kind,
      price: Number(r.villa_price),
      discount: Number(r.villa_discount),
      rooms: Number(r.villa_rooms),
      peoplePerRoom: Number(r.villa_people_per_room),
      maxGuests: Number(r.villa_max_guests),
    },
  }));
}

/** Which of an owner's villas have live bookings riding on them, keyed by villa
 *  id (absent = none, i.e. freely editable). Drives the disabled Edit link in
 *  My Properties; updateVillaAction is what actually enforces the lock. */
export async function getVillaLocksForOwner(
  ownerId: number,
): Promise<Record<number, BookingLock>> {
  const today = todayKey();
  const rows = (await getDb()
    .prepare(
      `SELECT v.id AS villa_id,
              COUNT(b.id) AS n,
              COALESCE(MAX(b.check_out), '') AS last_out
         FROM villas v
         JOIN bookings b ON b.villa_id = v.id
          AND b.check_out >= ? AND b.status IN ('pending', 'accepted')
        WHERE v.owner_id = ?
        GROUP BY v.id`,
    )
    .all(today, ownerId)) as { villa_id: number; n: number; last_out: string }[];
  return Object.fromEntries(
    rows.map((r) => [
      r.villa_id,
      { active: Number(r.n), lastCheckOut: r.last_out },
    ]),
  );
}

/** The same live-booking counts across EVERY listing, keyed by villa id
 *  (absent = none). Lets the admin's property list say up front why a delete
 *  will be refused, instead of only after it's attempted. */
export async function getVillaLocksAdmin(): Promise<
  Record<number, BookingLock>
> {
  const today = todayKey();
  const rows = (await getDb()
    .prepare(
      `SELECT b.villa_id,
              COUNT(b.id) AS n,
              COALESCE(MAX(b.check_out), '') AS last_out
         FROM bookings b
        WHERE b.check_out >= ? AND b.status IN ('pending', 'accepted')
        GROUP BY b.villa_id`,
    )
    .all(today)) as { villa_id: number; n: number; last_out: string }[];
  return Object.fromEntries(
    rows.map((r) => [
      r.villa_id,
      { active: Number(r.n), lastCheckOut: r.last_out },
    ]),
  );
}

/** Which of an owner's packages have live bookings riding on them, keyed by
 *  package id (absent = none). Drives the frozen guest-count field in the
 *  package editor. Kept out of the shared package columns so the guest-facing
 *  listings don't pay for a join only the owner's own page needs. */
export async function getPackageLocksForOwner(
  ownerId: number,
): Promise<Record<number, BookingLock>> {
  const today = todayKey();
  const rows = (await getDb()
    .prepare(
      `SELECT p.id AS package_id,
              COUNT(b.id) AS n,
              COALESCE(MAX(b.check_out), '') AS last_out
         FROM packages p
         JOIN bookings b ON b.package_id = p.id
          AND b.check_out >= ? AND b.status IN ('pending', 'accepted')
        WHERE p.owner_id = ?
        GROUP BY p.id`,
    )
    .all(today, ownerId)) as {
    package_id: number;
    n: number;
    last_out: string;
  }[];
  return Object.fromEntries(
    rows.map((r) => [
      r.package_id,
      { active: Number(r.n), lastCheckOut: r.last_out },
    ]),
  );
}

/** Packages offered on one villa (guest-facing villa page). */
export async function getPackagesForVilla(
  villaId: number,
): Promise<PackageItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT ${PKG_COLS}
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.villa_id = ? AND ${LIVE_PACKAGE}
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all(villaId)) as PackageJoinRow[];
  return rows.map(toPackageItem);
}

/** All packages for the public /packages page, optionally hiding the viewer's
 *  own villas (owners don't book their own listings). */
export async function getPublicPackages(
  excludeOwnerId?: number,
): Promise<PackageItem[]> {
  const where =
    excludeOwnerId != null
      ? `WHERE ${LIVE_PACKAGE} AND p.owner_id != ?`
      : `WHERE ${LIVE_PACKAGE}`;
  const params = excludeOwnerId != null ? [excludeOwnerId] : [];
  const rows = (await getDb()
    .prepare(
      `SELECT ${PKG_COLS}
       FROM packages p JOIN villas v ON v.id = p.villa_id
       ${where}
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all(...params)) as PackageJoinRow[];
  return rows.map(toPackageItem);
}

/** A single package plus the villa-capacity fields needed to price/validate a
 *  booking server-side (never trusting the client for nights/price/occupancy). */
export async function getPackageById(
  packageId: number,
): Promise<PackageForBooking | null> {
  const row = (await getDb()
    .prepare(
      `SELECT p.id, p.villa_id, p.owner_id, p.name, p.nights, p.max_guests,
              p.price, p.inclusions, p.locked_at, v.kind AS villa_kind,
              v.rooms AS villa_rooms, v.people_per_room AS people_per_room,
              v.max_guests AS villa_max_guests, v.locked_at AS villa_locked_at,
              v.admin_locked_at AS villa_admin_locked_at
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.id = ?`,
    )
    .get(packageId)) as
    | {
        id: number;
        villa_id: number;
        owner_id: number;
        name: string;
        nights: number;
        max_guests: number;
        price: number;
        inclusions: string;
        locked_at: string | null;
        villa_kind: string;
        villa_rooms: number;
        people_per_room: number;
        villa_max_guests: number;
        villa_locked_at: string | null;
        villa_admin_locked_at: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    villaId: row.villa_id,
    ownerId: row.owner_id,
    villaKind: row.villa_kind,
    villaRooms: row.villa_rooms,
    peoplePerRoom: row.people_per_room,
    villaMaxGuests: row.villa_max_guests,
    name: row.name,
    nights: Number(row.nights),
    maxGuests: Number(row.max_guests),
    price: Number(row.price),
    inclusions: parseJsonList(row.inclusions),
    // Any of the three makes the package unbookable — the booking action
    // refuses it: the package's own lock, the owner's villa lock, or support's.
    locked:
      row.locked_at !== null ||
      row.villa_locked_at !== null ||
      row.villa_admin_locked_at !== null,
  };
}

/** Full package + villa detail for the standalone package page. */
export type PackageDetail = {
  id: number;
  name: string;
  description: string;
  nights: number;
  maxGuests: number;
  discount: number;
  price: number;
  inclusions: string[];
  villaId: number;
  villaName: string;
  villaCity: string;
  villaKind: string;
  villaImage: string;
  /** The villa's photo gallery (cover first), so the package page can show the
   *  same multi-image gallery as the villa detail page. */
  gallery: string[];
  villaDescription: string;
  villaRooms: number;
  peoplePerRoom: number;
  ownerId: number;
  rating: number;
  reviews: number;
  /** True when this package OR its villa is locked — the page still renders
   *  (guests with a booking may follow a link here) but can't be booked. */
  locked: boolean;
};

export async function getPackageDetail(
  id: number,
): Promise<PackageDetail | null> {
  const row = (await getDb()
    .prepare(
      `SELECT p.id, p.name, p.description, p.nights, p.max_guests, p.discount, p.price, p.inclusions,
              p.locked_at,
              v.id AS villa_id, v.name AS villa_name, v.city AS villa_city,
              v.kind AS villa_kind, v.image AS villa_image, v.images AS villa_images,
              v.description AS villa_description, v.locked_at AS villa_locked_at,
              v.admin_locked_at AS villa_admin_locked_at,
              v.rooms AS villa_rooms, v.people_per_room AS people_per_room, v.owner_id AS owner_id,
              ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.id = ?`,
    )
    .get(id)) as
    | {
        id: number;
        name: string;
        description: string;
        nights: number;
        max_guests: number;
        discount: number;
        price: number;
        inclusions: string;
        locked_at: string | null;
        villa_id: number;
        villa_name: string;
        villa_city: string;
        villa_kind: string;
        villa_image: string;
        villa_images: string;
        villa_description: string;
        villa_locked_at: string | null;
        villa_admin_locked_at: string | null;
        villa_rooms: number;
        people_per_room: number;
        owner_id: number;
        rvw_count: number;
        rvw_rating: number;
      }
    | undefined;
  if (!row) return null;
  const gallery = parseJsonList(row.villa_images);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nights: Number(row.nights),
    maxGuests: Number(row.max_guests),
    discount: Number(row.discount),
    price: Number(row.price),
    inclusions: parseJsonList(row.inclusions),
    villaId: row.villa_id,
    villaName: row.villa_name,
    villaCity: row.villa_city,
    villaKind: row.villa_kind,
    villaImage: row.villa_image,
    gallery: gallery.length > 0 ? gallery : [row.villa_image],
    villaDescription: row.villa_description,
    villaRooms: row.villa_rooms,
    peoplePerRoom: row.people_per_room,
    ownerId: row.owner_id,
    rating: Number(row.rvw_rating),
    reviews: Number(row.rvw_count),
    locked:
      row.locked_at !== null ||
      row.villa_locked_at !== null ||
      row.villa_admin_locked_at !== null,
  };
}

export async function getCatalogVillas(
  limit = 24,
  excludeOwnerId?: number,
): Promise<CatalogVilla[]> {
  const rows = (
    excludeOwnerId != null
      ? await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v
             WHERE ${villaLive()} AND v.owner_id != ?
             ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(excludeOwnerId, limit)
      : await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v
             WHERE ${villaLive()}
             ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(limit)
  ) as VillaWithReviews[];
  return rows.map(toCatalogVilla);
}

/** Paid "featured" listings for the home page's Featured villas row.
 *  Owners don't see their own villas anywhere they browse — the featured row
 *  included — so `excludeOwnerId` drops the viewer's own listings too. */
export async function getFeaturedVillas(
  limit = 8,
  excludeOwnerId?: number,
): Promise<CatalogVilla[]> {
  const rows = (
    excludeOwnerId != null
      ? await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v
             WHERE v.featured = 1 AND ${villaLive()} AND v.owner_id != ?
             ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(excludeOwnerId, limit)
      : await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v
             WHERE v.featured = 1 AND ${villaLive()}
             ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(limit)
  ) as VillaWithReviews[];
  return rows.map(toCatalogVilla);
}

export async function getVillaById(id: number): Promise<VillaRow | null> {
  const row = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM villas v WHERE v.id = ?`,
    )
    .get(id)) as VillaWithReviews | undefined;
  if (!row) return null;
  // Real review aggregates override the denormalized columns for display.
  return { ...row, rating: Number(row.rvw_rating), reviews: Number(row.rvw_count) };
}

function parseJsonList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Villa services with prices. Accepts the current `{name, price}` shape and
 *  legacy plain-string arrays (treated as free services). */
export function parseServiceList(raw: string): VillaService[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .map((x): VillaService | null => {
        if (typeof x === "string") return { name: x, price: 0 };
        if (x && typeof x === "object" && typeof x.name === "string") {
          const price = Number(x.price);
          return {
            name: x.name,
            price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
          };
        }
        return null;
      })
      .filter((s): s is VillaService => s !== null && s.name.trim() !== "");
  } catch {
    return [];
  }
}

/** A booking's package snapshot, or null for a normal nightly stay. */
export function parsePackage(raw: string): PackageSnapshot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || typeof v.name !== "string") return null;
    return {
      name: v.name,
      nights: Number(v.nights) || 0,
      guests: Number(v.guests) || 0,
      price: Number(v.price) || 0,
      inclusions: Array.isArray(v.inclusions)
        ? v.inclusions.filter((x: unknown): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export async function getVillaDetail(id: number): Promise<VillaDetail | null> {
  const row = (await getDb()
    .prepare(
      `SELECT v.*, u.full_name AS host_name, u.avatar AS host_avatar,
              u.created_at AS host_joined,
              ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM villas v JOIN users u ON u.id = v.owner_id
       WHERE v.id = ?`,
    )
    .get(id)) as
    | (VillaRow & {
        host_name: string;
        host_avatar: string;
        host_joined: string;
        rvw_count: number;
        rvw_rating: number;
      })
    | undefined;
  if (!row) return null;

  const gallery = parseJsonList(row.images);
  return {
    ...row,
    rating: Number(row.rvw_rating),
    reviews: Number(row.rvw_count),
    hostName: row.host_name || "MyVilla Host",
    hostAvatar: row.host_avatar,
    hostJoined: row.host_joined,
    facilityList: parseJsonList(row.facilities),
    serviceList: parseServiceList(row.services),
    gallery: gallery.length > 0 ? gallery : [row.image],
  };
}

/**
 * Build the WHERE clause shared by the search results and the amenity facet.
 * `opts.amenities: false` omits the amenity conditions, so the facet can be
 * derived from villas matching every OTHER active filter. The surrounding query
 * must alias the villas table `v` (RVW_COUNT/RVW_RATING reference v.id).
 */
function villaSearchWhere(
  filters: SearchFilterInput,
  opts: { amenities: boolean } = { amenities: true },
): { where: string[]; params: (string | number)[] } {
  // A locked listing is never a search result — it takes no new bookings, so
  // surfacing it would only lead to a dead end. Unlocking brings it straight
  // back. This sits here so /search and the amenity chips agree automatically.
  // Either lock counts: the owner's own, or support's.
  const where: string[] = [villaLive("")];
  const params: (string | number)[] = [];

  if (filters.q) {
    const q = filters.q.trim();
    const comma = q.indexOf(",");
    const placePart = comma >= 0 ? q.slice(comma + 1).trim() : "";
    if (comma > 0 && placePart) {
      // "Name, Place" (e.g. "The Bund, Shanghai") — match the property name AND
      // the place, so the two parts narrow to one listing instead of matching
      // the whole string against a single column (which nothing contains).
      where.push("(name ILIKE ?) AND (city ILIKE ? OR address ILIKE ?)");
      const namePart = `%${q.slice(0, comma).trim()}%`;
      const place = `%${placePart}%`;
      params.push(namePart, place, place);
    } else {
      // Plain query — match anywhere across name, city or address.
      where.push("(name ILIKE ? OR city ILIKE ? OR address ILIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
  }
  if (filters.min != null) {
    where.push("price >= ?");
    params.push(filters.min);
  }
  if (filters.max != null) {
    where.push("price <= ?");
    params.push(filters.max);
  }
  if (filters.rating != null) {
    // A rating floor is an explicit quality filter, so unrated (0-review) new
    // listings are excluded — they have no rating to meet the threshold.
    where.push(`(${RVW_COUNT} > 0 AND ${RVW_RATING} >= ?)`);
    params.push(filters.rating);
  }
  if (filters.guests != null) {
    where.push("max_guests >= ?");
    params.push(filters.guests);
  }
  if (opts.amenities) {
    for (const amenity of filters.amenities ?? []) {
      // An amenity chip can be a facility or a service (free or paid), so match
      // either column. JSON.stringify quotes the name on both sides, so the
      // match is on the exact token (e.g. "BBQ Corner" won't hit "BBQ Corners").
      const token = `%${JSON.stringify(amenity)}%`;
      where.push("(facilities ILIKE ? OR services ILIKE ?)");
      params.push(token, token);
    }
  }
  if (filters.type === "resort") {
    where.push("kind = 'Resort'");
  } else if (filters.type === "hotel") {
    where.push("kind = 'Hotel'");
  } else if (filters.type === "rent") {
    where.push("kind NOT IN ('Resort', 'Hotel')");
  }
  if (filters.excludeOwnerId != null) {
    where.push("owner_id != ?");
    params.push(filters.excludeOwnerId);
  }
  return { where, params };
}

export async function searchVillas(
  filters: SearchFilterInput,
): Promise<CatalogVilla[]> {
  const { where, params } = villaSearchWhere(filters);

  const orderBy = {
    newest: "created_at DESC, id DESC",
    price_asc: "price ASC, id DESC",
    price_desc: "price DESC, id DESC",
    // rvw_rating / rvw_count are the review-derived SELECT aliases below.
    rating: "rvw_rating DESC, rvw_count DESC, id DESC",
  }[filters.sort ?? "newest"];

  const rows = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM villas v
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY ${orderBy} LIMIT 50`,
    )
    .all(...params)) as VillaWithReviews[];

  return rows.map(toCatalogVilla);
}

export type BookedRange = { checkIn: string; checkOut: string };

/** The columns the availability engine needs off a booking row. */
type RoomBookingRow = {
  check_in: string;
  check_out: string;
  rooms: number;
  room_plan: string;
};

/** A booking row as the availability engine sees it. A stay whose room count
 *  changes mid-way (a room plan) contributes one entry per segment, so
 *  per-night occupancy stays a plain sum; a flat stay contributes one entry,
 *  exactly as before. */
const expandRoomBooking = (r: RoomBookingRow): RoomBooking[] =>
  parseRoomPlan(r.room_plan) ?? [
    { checkIn: r.check_in, checkOut: r.check_out, rooms: Math.max(1, r.rooms) },
  ];

/** Confirmed stays overlapping [checkIn, checkOut), expanded to room segments. */
async function overlappingRoomBookings(
  villaId: number,
  checkIn: string,
  checkOut: string,
  excludeBookingId: number,
): Promise<RoomBooking[]> {
  // A room plan never extends past its booking's own check_in/check_out, so
  // the row-level overlap filter is still safe with plans in play.
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out, rooms, room_plan FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != ''
         AND check_in < ? AND check_out > ? AND id != ?`,
    )
    .all(villaId, checkOut, checkIn, excludeBookingId)) as RoomBookingRow[];
  return rows.flatMap(expandRoomBooking);
}

/** How many bookings still have a claim on a villa (or one package), and when
 *  the last of them checks out. `active` is 0 once every stay is completed. */
export type BookingLock = { active: number; lastCheckOut: string };

/** A booking still has a claim while it's a confirmed upcoming stay or a pending
 *  request — a checked-out stay is done, and a cancelled one never held anything.
 *  This is THE definition of "active booking"; every guard reuses it so the villa
 *  delete guard and the capacity-edit guard can never drift apart. */
async function bookingLockWhere(
  column: "villa_id" | "package_id",
  id: number,
): Promise<BookingLock> {
  const today = todayKey();
  const row = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(MAX(check_out), '') AS last_out
         FROM bookings
        WHERE ${column} = ? AND check_out >= ?
          AND status IN ('pending', 'accepted')`,
    )
    .get(id, today)) as { n: number; last_out: string };
  return { active: Number(row?.n ?? 0), lastCheckOut: row?.last_out ?? "" };
}

/** Bookings still riding on a villa — blocks deleting it or changing its capacity. */
export const getVillaBookingLock = (villaId: number): Promise<BookingLock> =>
  bookingLockWhere("villa_id", villaId);

/** Bookings still riding on one package — blocks changing its guest count. */
export const getPackageBookingLock = (packageId: number): Promise<BookingLock> =>
  bookingLockWhere("package_id", packageId);

/** Concurrent stays a villa allows per night: its rooms, or 1 whole-villa unit. */
async function villaCapacity(villaId: number): Promise<number | null> {
  const villa = (await getDb()
    .prepare("SELECT kind, rooms FROM villas WHERE id = ?")
    .get(villaId)) as { kind: string; rooms: number } | undefined;
  if (!villa) return null;
  // Whole-villa kinds have capacity 1, so any overlap blocks (as before);
  // hotels/resorts allow concurrent stays up to their room count.
  return roomCapacity(villa.kind, villa.rooms);
}

/** True when no confirmed stay overlaps the given range. `excludeBookingId`
 *  ignores one booking (used when editing it, so its own dates don't clash). */
export async function isVillaAvailable(
  villaId: number,
  checkIn: string,
  checkOut: string,
  roomsNeeded = 1,
  excludeBookingId = 0,
): Promise<boolean> {
  const capacity = await villaCapacity(villaId);
  if (capacity === null) return false;
  const bookings = await overlappingRoomBookings(
    villaId,
    checkIn,
    checkOut,
    excludeBookingId,
  );
  const need = Math.max(1, Math.trunc(roomsNeeded) || 1);
  return roomsFreeForRange(checkIn, checkOut, bookings, capacity) >= need;
}

/** True when every leg of a room plan still has its rooms free — the
 *  availability guard for an adjusted stay, where a single bottleneck figure
 *  would wrongly reject the legs that ask for more. */
export async function isPlanAvailable(
  villaId: number,
  plan: RoomSegment[],
  excludeBookingId = 0,
): Promise<boolean> {
  if (plan.length === 0) return false;
  const capacity = await villaCapacity(villaId);
  if (capacity === null) return false;
  const span = { checkIn: plan[0].checkIn, checkOut: plan[plan.length - 1].checkOut };
  const bookings = await overlappingRoomBookings(
    villaId,
    span.checkIn,
    span.checkOut,
    excludeBookingId,
  );
  return plan.every(
    (s) => roomsFreeForRange(s.checkIn, s.checkOut, bookings, capacity) >= s.rooms,
  );
}

/** The rooms a guest can hold on each leg of [checkIn, checkOut) when they want
 *  `wanted` rooms — the offer behind the "adjusted stay" flow. [] when the range
 *  can't be covered at all. */
export async function getRoomPlan(
  villaId: number,
  checkIn: string,
  checkOut: string,
  wanted: number,
  excludeBookingId = 0,
  /** When given, rooms the guest already holds here top up toward the ask
   *  (nights they're already on only book the difference) — the same plan the
   *  booking card showed them. Omit for an inventory-only plan. */
  guestId = 0,
): Promise<RoomSegment[]> {
  const capacity = await villaCapacity(villaId);
  if (capacity === null) return [];
  const bookings = await overlappingRoomBookings(
    villaId,
    checkIn,
    checkOut,
    excludeBookingId,
  );
  const held = guestId
    ? await getGuestRoomBookings(villaId, guestId, excludeBookingId)
    : [];
  return roomPlanFor(checkIn, checkOut, bookings, capacity, wanted, held);
}

/** Date ranges that block new bookings for a villa (confirmed stays).
 *  `excludeBookingId` omits one booking — used on the manage page so a guest's
 *  own current dates aren't greyed out while they adjust them. */
export async function getBookedRanges(
  villaId: number,
  excludeBookingId = 0,
): Promise<BookedRange[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != '' AND id != ?`,
    )
    .all(villaId, excludeBookingId)) as { check_in: string; check_out: string }[];
  return rows.map((r) => ({ checkIn: r.check_in, checkOut: r.check_out }));
}

/** Accepted reservations with their room counts — hotels/resorts feed these to
 *  the booking calendar to work out sold-out days and rooms still free. */
export async function getRoomBookings(
  villaId: number,
  excludeBookingId = 0,
  /** Leave out one guest's own stays entirely — used when the owner is booking
   *  FOR that guest, whose overlapping rooms get folded into the new booking
   *  rather than blocking it. */
  excludeGuestId = 0,
): Promise<RoomBooking[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out, rooms, room_plan FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != '' AND id != ? AND guest_id != ?`,
    )
    .all(villaId, excludeBookingId, excludeGuestId)) as RoomBookingRow[];
  return rows.flatMap(expandRoomBooking);
}

/** A guest waiting on a call from the host about a booking the self-serve flow
 *  wouldn't take (a room block over the per-guest cap). */
export type CallRequestItem = {
  id: number;
  /** The listing and the person asking — what "fulfil this" needs to open the
   *  owner's booking form already filled in. */
  villaId: number;
  guestId: number;
  villaName: string;
  /** Support has locked the listing, so no booking can be made on it — the
   *  "fulfil this" shortcut leads nowhere and says so instead. */
  villaAdminLocked: boolean;
  guestName: string;
  guestEmail: string;
  /** The guest's public customer ID — what they'd quote on the phone. */
  guestCustomerId: string;
  /** Dialable number ("+44 7700 900123"), or "" if the guest never added one. */
  guestPhone: string;
  guestAvatar: string;
  /** The stay they wanted; "" when they hadn't picked dates. */
  checkIn: string;
  checkOut: string;
  rooms: number;
  /** Party size they'd picked (0 = never stated). */
  guests: number;
  /** The guest's own note to the host ("" = they didn't leave one). It is also
   *  the thread's first message — this is the summary, `chat` is the record. */
  message: string;
  /** The conversation with this guest, oldest first. */
  chat: ChatMessage[];
  /** Messages from the guest the host hasn't opened yet. */
  unread: number;
  /** Paid add-ons they'd ticked when they asked, as stored. Shown to the host so
   *  the call (or the booking) already knows what they wanted. */
  services: VillaService[];
  /** The same add-ons as indices into the villa's CURRENT service list — what
   *  the booking form needs to re-tick them. Anything the host has since
   *  removed or renamed simply drops out, rather than prefilling a stale index
   *  that now points at a different service. */
  serviceIdx: number[];
  requested: string;
};

/** Open call requests across all of an owner's properties, newest first. */
export async function getCallRequestsForOwner(
  ownerId: number,
): Promise<CallRequestItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT c.id, c.villa_id, c.guest_id, c.check_in, c.check_out, c.rooms,
              c.guests, c.message, c.services, c.created_at,
              v.name AS villa_name, v.services AS villa_services,
              v.admin_locked_at AS villa_admin_locked_at,
              u.full_name, u.email, u.customer_id, u.phone_code, u.phone_number,
              u.avatar
       FROM call_requests c
       JOIN villas v ON v.id = c.villa_id
       JOIN users u ON u.id = c.guest_id
       WHERE v.owner_id = ? AND c.status = 'open'
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(ownerId)) as {
    id: number;
    villa_id: number;
    guest_id: number;
    check_in: string;
    check_out: string;
    rooms: number;
    guests: number;
    message: string;
    services: string;
    created_at: string;
    villa_name: string;
    villa_services: string;
    villa_admin_locked_at: string | null;
    full_name: string;
    email: string;
    customer_id: string | null;
    phone_code: string;
    phone_number: string;
    avatar: string;
  }[];

  const [chats, unread] = await Promise.all([
    chatsFor(
      rows.map((r) => r.id),
      ownerId,
    ),
    unreadMessageIds(ownerId),
  ]);

  return rows.map((r) => {
    // Map the snapshotted add-ons back onto the villa's current list by name:
    // an index stored months ago could now point at a different service, but a
    // name either still exists or the guest can't have it any more.
    const asked = parseServiceList(r.services);
    const chat = chats[r.id] ?? [];
    const current = parseServiceList(r.villa_services);
    const serviceIdx = asked
      .map((s) => current.findIndex((cur) => cur.name === s.name))
      .filter((i) => i >= 0);
    return {
    id: r.id,
    villaId: r.villa_id,
    guestId: r.guest_id,
    services: asked,
    serviceIdx,
    villaName: r.villa_name,
    villaAdminLocked: r.villa_admin_locked_at !== null,
    guestName: r.full_name || r.email,
    guestEmail: r.email,
    guestCustomerId: r.customer_id ?? "",
    guestPhone: r.phone_number ? `${r.phone_code} ${r.phone_number}`.trim() : "",
    guestAvatar: r.avatar,
    checkIn: r.check_in,
    checkOut: r.check_out,
    rooms: Number(r.rooms),
    guests: Number(r.guests ?? 0),
    message: r.message ?? "",
    chat,
    unread: unreadIn(chat, unread),
    requested: timeAgo(r.created_at, "Requested"),
    };
  });
}

/* --------------------------- call-request chat ---------------------------- */

/**
 * Every thread for the given requests at once, keyed by request id.
 *
 * One query rather than one per request: these lists render a whole page of
 * requests, and a per-request fetch would be an N+1 on the account's hottest
 * page. Threads are short (they exist to arrange one booking), so loading them
 * with the list costs little and lets the chat open with no round trip.
 *
 * `viewerId` decides `mine` here, server-side — the client is never handed the
 * sender ids to compare, so it can't get the sides wrong.
 */
async function chatsFor(
  requestIds: number[],
  viewerId: number,
): Promise<Record<number, ChatMessage[]>> {
  const byRequest: Record<number, ChatMessage[]> = {};
  if (requestIds.length === 0) return byRequest;

  const rows = (await getDb()
    .prepare(
      `SELECT m.id, m.request_id, m.sender_id, m.body, m.created_at,
              u.full_name, u.email, u.avatar
         FROM call_messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.request_id = ANY(?)
        ORDER BY m.created_at ASC, m.id ASC`,
    )
    .all(requestIds)) as {
    id: number;
    request_id: number;
    sender_id: number;
    body: string;
    created_at: string;
    full_name: string;
    email: string;
    avatar: string;
  }[];

  for (const r of rows) {
    (byRequest[r.request_id] ??= []).push({
      id: r.id,
      mine: r.sender_id === viewerId,
      senderName: r.full_name || r.email,
      senderAvatar: r.avatar,
      body: r.body,
      when: timeAgo(r.created_at),
    });
  }
  return byRequest;
}

/** Messages waiting on `viewerId` in one thread — written by the other party and
 *  not yet seen. Counted from the rows already loaded rather than re-queried. */
const unreadIn = (chat: ChatMessage[], unreadIds: Set<number>): number =>
  chat.filter((m) => !m.mine && unreadIds.has(m.id)).length;

/** Ids of messages this viewer hasn't read, across every request they're in.
 *  Read state lives per message (read_at), so this is the one query that says
 *  which of the loaded messages are still new to them. */
async function unreadMessageIds(viewerId: number): Promise<Set<number>> {
  const rows = (await getDb()
    .prepare(
      `SELECT m.id FROM call_messages m
         WHERE m.sender_id <> ? AND m.read_at IS NULL
           AND m.request_id IN (
             SELECT c.id FROM call_requests c
              LEFT JOIN villas v ON v.id = c.villa_id
              WHERE c.status = 'open' AND (c.guest_id = ? OR v.owner_id = ?)
           )`,
    )
    .all(viewerId, viewerId, viewerId)) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

/** How many replies are sitting unread for this user, either side of the table.
 *  Drives the My Requests badge — the guest has no other cue that the host
 *  wrote back. */
export async function getUnreadChatCount(userId: number): Promise<number> {
  return (await unreadMessageIds(userId)).size;
}

/** Open requests this user has MADE (as a guest). Drives whether the My Requests
 *  section exists at all — with none, there's nothing to show them. */
export async function getMyCallRequestCount(guestId: number): Promise<number> {
  const r = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM call_requests
        WHERE guest_id = ? AND status = 'open'`,
    )
    .get(guestId)) as { n: number };
  return Number(r?.n) || 0;
}

/** A request from the guest's own side: who they asked, and the thread with
 *  them. The mirror image of CallRequestItem — same request, other end. */
export type GuestRequestItem = {
  id: number;
  villaId: number;
  villaName: string;
  villaCity: string;
  villaImage: string;
  /** The person who'll answer — a name, so the thread isn't with a listing. */
  hostName: string;
  hostAvatar: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  services: VillaService[];
  requested: string;
  chat: ChatMessage[];
  unread: number;
};

/** The guest's own open call requests, newest first.
 *
 *  Open only, deliberately: the host closing a request wipes its chat, so a
 *  closed one here would be a dead card with a dead button. Fulfilled requests
 *  turn into a stay, which My Bookings already shows.
 */
export async function getCallRequestsForGuest(
  guestId: number,
): Promise<GuestRequestItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT c.id, c.villa_id, c.check_in, c.check_out, c.rooms, c.guests,
              c.services, c.created_at,
              v.name AS villa_name, v.city AS villa_city, v.image AS villa_image,
              u.full_name AS host_name, u.email AS host_email, u.avatar AS host_avatar
         FROM call_requests c
         JOIN villas v ON v.id = c.villa_id
         JOIN users u ON u.id = v.owner_id
        WHERE c.guest_id = ? AND c.status = 'open'
        ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(guestId)) as {
    id: number;
    villa_id: number;
    check_in: string;
    check_out: string;
    rooms: number;
    guests: number;
    services: string;
    created_at: string;
    villa_name: string;
    villa_city: string;
    villa_image: string;
    host_name: string;
    host_email: string;
    host_avatar: string;
  }[];

  const [chats, unread] = await Promise.all([
    chatsFor(
      rows.map((r) => r.id),
      guestId,
    ),
    unreadMessageIds(guestId),
  ]);

  return rows.map((r) => {
    const chat = chats[r.id] ?? [];
    return {
      id: r.id,
      villaId: r.villa_id,
      villaName: r.villa_name,
      villaCity: r.villa_city,
      villaImage: r.villa_image,
      hostName: r.host_name || r.host_email,
      hostAvatar: r.host_avatar,
      checkIn: r.check_in,
      checkOut: r.check_out,
      rooms: Number(r.rooms),
      guests: Number(r.guests ?? 0),
      services: parseServiceList(r.services),
      requested: timeAgo(r.created_at, "Requested"),
      chat,
      unread: unreadIn(chat, unread),
    };
  });
}

/** How many guests are waiting on a call from this owner. Mirrors the WHERE of
 *  getCallRequestsForOwner, so the badge and the list can't disagree. */
export async function getCallRequestCount(ownerId: number): Promise<number> {
  const r = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM call_requests c
       JOIN villas v ON v.id = c.villa_id
       WHERE v.owner_id = ? AND c.status = 'open'`,
    )
    .get(ownerId)) as { n: number };
  return Number(r?.n) || 0;
}

/** Everything the account nav badges, for one signed-in user.
 *
 *  `cache`d because a profile page renders the header's avatar menu AND the
 *  sidebar — both need these numbers, and neither can pass them to the other.
 *  Per-request memoization keeps that one pair of COUNTs, not two.
 */
export const getAccountCounts = cache(
  async (userId: number, isHost: boolean): Promise<AccountCounts> => {
    const [pendingPayments, callRequests, myRequests, unreadChat] =
      await Promise.all([
        getPendingPaymentCount(userId),
        // Guests own no villas, so the query could only ever return 0 — skip it
        // rather than pay for it on every page they load.
        isHost ? getCallRequestCount(userId) : NO_ACCOUNT_COUNTS.callRequests,
        // Not gated on isHost: a host can ask for a call on someone else's
        // listing, so both roles can have requests of their own out.
        getMyCallRequestCount(userId),
        getUnreadChatCount(userId),
      ]);
    return { pendingPayments, callRequests, myRequests, unreadChat };
  },
);

/* --------------------------- notifications --------------------------- */

/** This user's newest notifications — what the bell drops down. Capped: it's a
 *  glance at what just happened, and the pages behind each one are the record. */
export const getNotifications = cache(
  async (userId: number): Promise<NotificationItem[]> => {
    const rows = (await getDb()
      .prepare(
        `SELECT id, type, title, body, href, read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(userId, NOTIFICATION_LIMIT)) as {
      id: number;
      type: string;
      title: string;
      body: string;
      href: string;
      read_at: string | null;
      created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type as NotificationType,
      title: r.title,
      body: r.body,
      href: r.href,
      read: r.read_at !== null,
      when: timeAgo(r.created_at),
    }));
  },
);

/** The number on the bell. Counts ALL unread, not just the ones the dropdown
 *  can hold — "3" that lists 12 would be a lie the other way round. */
export const getUnreadNotificationCount = cache(
  async (userId: number): Promise<number> => {
    const r = (await getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
      )
      .get(userId)) as { n: number };
    return Number(r?.n) || 0;
  },
);

/** The rooms ONE guest already holds at a villa (their own confirmed stays,
 *  room-plan expanded like getRoomBookings). This is what the per-guest room cap
 *  counts against, so booking a big block in several goes still hits the limit.
 *  `excludeBookingId` drops the booking being edited, so re-saving it doesn't
 *  count its own rooms twice. */
export async function getGuestRoomBookings(
  villaId: number,
  guestId: number,
  excludeBookingId = 0,
): Promise<RoomBooking[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out, rooms, room_plan FROM bookings
       WHERE villa_id = ? AND guest_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != '' AND id != ?`,
    )
    .all(villaId, guestId, excludeBookingId)) as RoomBookingRow[];
  return rows.flatMap(expandRoomBooking);
}

/** The signed-in guest's own confirmed booking overlapping a range, if any.
 *  Lets the UI tell "you already booked this" apart from "someone else did",
 *  so a guest revisiting checkout after paying sees their booking — not a
 *  scary "taken, pick different dates". */
export async function getOwnBookingForRange(
  userId: number,
  villaId: number,
  checkIn: string,
  checkOut: string,
): Promise<{ id: number; checkIn: string; checkOut: string } | null> {
  const row = (await getDb()
    .prepare(
      `SELECT id, check_in, check_out FROM bookings
       WHERE villa_id = ? AND guest_id = ? AND status = 'accepted'
         AND check_in != '' AND check_in < ? AND check_out > ?
       ORDER BY check_in LIMIT 1`,
    )
    .get(villaId, userId, checkOut, checkIn)) as
    | { id: number; check_in: string; check_out: string }
    | undefined;
  return row ? { id: row.id, checkIn: row.check_in, checkOut: row.check_out } : null;
}

export type ManageBooking = {
  id: number;
  villaId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: BookingStatus;
  villaName: string;
  villaCity: string;
  villaImage: string;
  price: number;
  maxGuests: number;
  rooms: number;
  kind: string;
  /** Hotels/resorts: max occupancy of one room (0 for whole-villa kinds). */
  peoplePerRoom: number;
  /** Rooms this reservation holds (1 for whole-villa stays). */
  bookingRooms: number;
  /** Paid add-ons chosen at booking, as a {name, price} snapshot. */
  extras: VillaService[];
  /** Set when this booking is a package — its length/occupancy are fixed, so the
   *  manage view lets the guest move the start date but not change duration. */
  package: PackageSnapshot | null;
  /** The villa (or this stay's package) has been locked. The stay still goes
   *  ahead and its rooms/guests stay editable — only its DATES are frozen, since
   *  the place has stopped taking new ones. */
  locked: boolean;
  /** Set when the stay holds different rooms on different nights (the owner
   *  fulfilled it leg by leg). The self-serve editors only speak one flat
   *  count — and the modify actions refuse these — so the manage view shows
   *  the legs read-only and routes changes through the host. */
  roomPlan: RoomSegment[] | null;
  /** Coupon redeemed at checkout ('' = none) — labels the receipt's discount row and floors the charge at $1. */
  couponCode: string;
  /** The booking's own discount (a coupon's, or the owner's) — the manage flow
   *  re-applies it to any RE-PRICED total, so editing a couponed stay keeps
   *  the coupon. */
  discPct: number;
  discFixed: number;
  /** Money is still owed on this stay (owner-arranged or a merged upgrade). */
  paymentDue: boolean;
  /** What settling it costs, with the receipt behind the figure — mirrors the
   *  payment page so the manage view never shows a bare surprise number. */
  pay: {
    due: number;
    fullStay: number;
    hostDiscount: number;
    alreadyPaid: number;
  } | null;
};

/** A single booking (owned by the guest) with the villa fields the manage page
 *  needs to prefill its detail-style view. Null if it isn't the guest's. */
export async function getBookingForManage(
  bookingId: number,
  guestId: number,
): Promise<ManageBooking | null> {
  const row = (await getDb()
    .prepare(
      `SELECT b.id, b.villa_id, b.check_in, b.check_out, b.guests, b.rooms AS booking_rooms,
              b.status, b.package, b.extras, b.payment_due, b.room_plan,
              b.disc_pct, b.disc_fixed, b.paid_credit, b.coupon_code,
              v.name AS villa_name, v.city AS villa_city, v.image AS villa_image,
              v.price, v.discount, v.max_guests, v.rooms, v.kind, v.people_per_room,
              v.locked_at, v.admin_locked_at, pk.locked_at AS package_locked_at
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       LEFT JOIN packages pk ON pk.id = b.package_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, guestId)) as
    | {
        id: number;
        villa_id: number;
        check_in: string;
        check_out: string;
        guests: number;
        booking_rooms: number;
        status: BookingStatus;
        package: string;
        extras: string;
        payment_due: number;
        room_plan: string;
        disc_pct: number;
        disc_fixed: number;
        paid_credit: number;
        coupon_code: string;
        villa_name: string;
        villa_city: string;
        villa_image: string;
        price: number;
        discount: number;
        max_guests: number;
        rooms: number;
        kind: string;
        people_per_room: number;
        locked_at: string | null;
        admin_locked_at: string | null;
        package_locked_at: string | null;
      }
    | undefined;
  if (!row) return null;
  // Same receipt the payment page charges: stay (package price or nightly
  // quote) plus paid add-ons, less the owner's discount, less what the earlier
  // absorbed stay already paid. Only meaningful while the balance is due.
  const pkgSnap = parsePackage(row.package);
  const paidExtras = parseServiceList(row.extras).filter((s) => s.price > 0);
  const manageNights =
    row.check_in && row.check_out ? nightsBetween(row.check_in, row.check_out) : 0;
  const manageMoney = bookingMoney({
    pkg: pkgSnap,
    villaPrice: row.price,
    villaDiscount: row.discount,
    roomBased: isRoomBased(row.kind),
    rooms: Math.max(1, row.booking_rooms),
    nights: manageNights,
    roomPlan: row.room_plan,
    extras: paidExtras,
    discPct: row.disc_pct,
    discFixed: row.disc_fixed,
    paidCredit: row.paid_credit,
    paymentDue: row.payment_due === 1,
    couponCode: row.coupon_code,
  });
  return {
    id: row.id,
    villaId: row.villa_id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests,
    status: row.status,
    villaName: row.villa_name,
    villaCity: row.villa_city,
    villaImage: row.villa_image,
    price: row.price,
    maxGuests: row.max_guests,
    rooms: row.rooms,
    kind: row.kind,
    peoplePerRoom: row.people_per_room,
    bookingRooms: Math.max(1, row.booking_rooms),
    extras: parseServiceList(row.extras),
    package: pkgSnap,
    locked:
      row.locked_at !== null ||
      row.admin_locked_at !== null ||
      row.package_locked_at !== null,
    roomPlan: isRoomBased(row.kind) ? parseRoomPlan(row.room_plan) : null,
    couponCode: row.coupon_code,
    discPct: row.disc_pct,
    discFixed: row.disc_fixed,
    paymentDue: row.payment_due === 1,
    pay:
      row.payment_due === 1
        ? {
            due: manageMoney.amount,
            fullStay: manageMoney.fullStay,
            hostDiscount: manageMoney.hostDiscount,
            alreadyPaid: manageMoney.alreadyPaid,
          }
        : null,
  };
}

/**
 * Amenity chips to show in the search filter — a villa's facilities plus its
 * services (both free and paid). Canonical FACILITY_CHIPS come first, then the
 * service names. Only amenities that can still return at least one result are
 * shown: they're derived from the villas matching every OTHER active filter
 * (query, price, rating, guests, type, owner exclusion) and — when stay dates
 * are set — actually free for those dates. So an amenity offered only by a place
 * that's filtered out (wrong city, over budget, already booked…) never appears.
 * Any amenity the guest has already selected stays listed so it remains
 * toggleable even if the rest of the search would otherwise hide it.
 */
export async function getAvailableAmenities(
  filters: SearchFilterInput,
  checkIn?: string,
  checkOut?: string,
): Promise<string[]> {
  // Match every filter EXCEPT the amenity selection itself.
  const { where, params } = villaSearchWhere(filters, { amenities: false });
  const rows = (await getDb()
    .prepare(
      `SELECT v.id, v.facilities, v.services FROM villas v
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       LIMIT 200`,
    )
    .all(...params)) as { id: number; facilities: string; services: string }[];

  // With stay dates chosen, only count villas actually free for the range.
  let candidates = rows;
  if (checkIn && checkOut) {
    const free = await Promise.all(
      rows.map((r) => isVillaAvailable(r.id, checkIn, checkOut)),
    );
    candidates = rows.filter((_, i) => free[i]);
  }

  // Amenity chips = each villa's facilities plus its services (free AND paid) —
  // every offering a guest might want to filter by.
  const present = new Set<string>();
  for (const row of candidates) {
    for (const f of parseJsonList(row.facilities)) present.add(f);
    for (const s of parseServiceList(row.services)) present.add(s.name);
  }

  const selected = filters.amenities ?? [];
  // Keep any already-selected amenity listed so it stays toggleable.
  const show = new Set<string>([...present, ...selected]);
  // Canonical facility chips first (in FACILITY_CHIPS order), then the service
  // names (anything not a canonical chip) sorted, so the list stays stable.
  const facilityChips = FACILITY_CHIPS.filter((c) => show.has(c));
  const serviceChips = [...show]
    .filter((n) => !FACILITY_CHIPS.includes(n))
    .sort((a, b) => a.localeCompare(b));
  return [...facilityChips, ...serviceChips];
}

export async function getVillaCities(): Promise<string[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT DISTINCT city FROM villas
       WHERE city != '' AND ${villaLive("")} ORDER BY city ASC`,
    )
    .all()) as { city: string }[];
  return rows.map((r) => r.city);
}

/** Largest guest capacity across every listing (for hotels/resorts this is
 *  rooms × people-per-room). Caps the home hero's guest picker so it always
 *  reaches the biggest place currently listed. */
export async function getMaxVillaGuests(): Promise<number> {
  const row = (await getDb()
    .prepare(
      `SELECT COALESCE(MAX(max_guests), 0) AS n FROM villas WHERE ${villaLive("")}`,
    )
    .get()) as { n: number };
  return Math.max(1, row.n);
}

export type MaxGuestsByType = Record<PropertyType, number>;

/** Largest guest capacity within each hero tab (resort / hotel / rent). Lets the
 *  home hero cap its guest picker per tab, so the top option always returns at
 *  least one result for the tab the guest is browsing. */
export async function getMaxGuestsByType(): Promise<MaxGuestsByType> {
  const row = (await getDb()
    .prepare(
      `SELECT
         COALESCE(MAX(max_guests) FILTER (WHERE kind = 'Resort'), 0) AS resort,
         COALESCE(MAX(max_guests) FILTER (WHERE kind = 'Hotel'), 0) AS hotel,
         COALESCE(MAX(max_guests) FILTER (WHERE kind NOT IN ('Resort','Hotel')), 0) AS rent
       FROM villas
       WHERE ${villaLive("")}`,
    )
    .get()) as { resort: number; hotel: number; rent: number };
  return {
    resort: Math.max(1, row.resort),
    hotel: Math.max(1, row.hotel),
    rent: Math.max(1, row.rent),
  };
}

/** Villas the user has hearted, most recently saved first. Locked listings drop
 *  out — the card is a booking entry point, so leaving one up is a dead end. The
 *  favorite row itself is untouched, so unlocking brings the card back. */
export async function getFavoriteVillas(userId: number): Promise<CatalogVilla[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM favorites f
       JOIN villas v ON v.id = f.villa_id
       WHERE f.user_id = ? AND ${villaLive()}
       ORDER BY f.created_at DESC, v.id DESC`,
    )
    .all(userId)) as VillaWithReviews[];
  return rows.map(toCatalogVilla);
}

export async function getFavoriteVillaIds(userId: number): Promise<Set<number>> {
  const rows = (await getDb()
    .prepare("SELECT villa_id FROM favorites WHERE user_id = ?")
    .all(userId)) as { villa_id: number }[];
  return new Set(rows.map((r) => r.villa_id));
}

/** The receipt for one booking. Extracted because the guest's My Bookings, the
 *  manage page and the owner's Rent Requests all have to quote the SAME figure —
 *  three hand-rolled copies of this sum is three chances for the host and the
 *  guest to see different money for the same stay. */
export type BookingMoney = {
  /** The stay at list price: package price, or nightly quote + paid add-ons. */
  fullStay: number;
  /** Off it: whatever the owner knocked off when they arranged it. */
  hostDiscount: number;
  /** Credit from an earlier PAID stay this one absorbed. Only counts while the
   *  balance is still due — once settled it was money genuinely paid, just
   *  against the stay this one replaced. */
  alreadyPaid: number;
  /** What's actually charged: fullStay − hostDiscount − alreadyPaid. */
  amount: number;
};

export function bookingMoney(input: {
  /** Package snapshot, when the stay is one — its price replaces the quote. */
  pkg: PackageSnapshot | null;
  villaPrice: number;
  villaDiscount: number;
  roomBased: boolean;
  rooms: number;
  nights: number;
  /** Raw room_plan column — a stay whose rooms vary bills its real room-nights. */
  roomPlan: string;
  extras: VillaService[];
  discPct: number;
  discFixed: number;
  paidCredit: number;
  paymentDue: boolean;
  /** The coupon redeemed at checkout ('' = none). A coupon discount can never
   *  take the price to zero — the charge floors at $1, so a $101 coupon on a
   *  $100 stay leaves exactly $1 to pay. */
  couponCode?: string;
}): BookingMoney {
  const nights = Math.max(1, input.nights);
  const extrasTotal = input.extras.reduce((sum, s) => sum + s.price, 0);
  const plan = input.roomBased ? parseRoomPlan(input.roomPlan) : null;
  const roomNights = plan
    ? planRoomNights(plan)
    : (input.roomBased ? input.rooms : 1) * nights;
  const fullStay = input.pkg
    ? input.pkg.price
    : quote((input.villaPrice * roomNights) / nights, nights, input.villaDiscount)
        .total + extrasTotal;
  const hostDiscount = Math.min(
    input.couponCode ? Math.max(0, fullStay - 1) : fullStay,
    (fullStay * Math.max(0, input.discPct)) / 100 + Math.max(0, input.discFixed),
  );
  const alreadyPaid = input.paymentDue
    ? Math.min(Math.max(0, input.paidCredit), fullStay - hostDiscount)
    : 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    fullStay: round2(fullStay),
    hostDiscount: round2(hostDiscount),
    alreadyPaid: round2(alreadyPaid),
    amount: round2(fullStay - hostDiscount - alreadyPaid),
  };
}

const guestsLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;

/** Stored UTC "YYYY-MM-DD HH:MM:SS" → "30 Jul 2026, 14:15" (kept in UTC so the
 *  server-rendered string is deterministic and never mismatches on hydration). */
function formatBookedAt(utc: string): string {
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export async function getBookingsForGuest(guestId: number): Promise<BookingItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT b.id, b.dates, b.check_in, b.check_out, b.guests, b.rooms, b.status,
              b.created_at, b.extras, b.package, b.payment_due, b.room_plan,
              b.disc_pct, b.disc_fixed, b.paid_credit, b.coupon_code,
              v.name AS villa_name, v.city AS villa_city, v.kind AS villa_kind,
              v.price AS villa_price, v.discount AS villa_discount,
              rv.id AS my_review_id,
              rv.stars AS my_rating, rv.comment AS my_comment,
              rv.status AS my_review_status, rv.created_at AS my_review_at
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       LEFT JOIN reviews rv ON rv.booking_id = b.id
       WHERE b.guest_id = ?
       ORDER BY b.created_at DESC, b.id DESC`,
    )
    .all(guestId)) as Array<{
    id: number;
    dates: string;
    check_in: string;
    check_out: string;
    guests: number;
    rooms: number;
    status: BookingStatus;
    created_at: string;
    payment_due: number;
    room_plan: string;
    disc_pct: number;
    disc_fixed: number;
    paid_credit: number;
    coupon_code: string;
    extras: string;
    package: string;
    villa_name: string;
    villa_city: string;
    villa_kind: string;
    villa_price: number;
    villa_discount: number;
    my_review_id: number | null;
    my_rating: number | null;
    my_comment: string | null;
    my_review_status: ReviewStatus | null;
    my_review_at: string | null;
  }>;

  const histories = await getReviewHistories(
    rows
      .map((r) => r.my_review_id)
      .filter((id): id is number => typeof id === "number"),
  );
  const today = todayKey();
  return rows.map((r) => {
    /* The guest always sees their own review whatever its state, plus why it
       was turned down and everything that has happened to it. The reason is
       read from the history rather than stored on the review, so it survives
       the edit they make in response. */
    const reviewStatus = r.my_review_status ?? "pending";
    const history =
      r.my_review_id !== null ? histories.get(r.my_review_id) ?? [] : [];
    const reviewView =
      r.my_rating !== null && r.my_review_at && r.my_review_id !== null
        ? {
            id: r.my_review_id,
            stars: r.my_rating,
            comment: r.my_comment ?? "",
            status: reviewStatus,
            rejectedNote:
              reviewStatus === "rejected"
                ? [...history].reverse().find((e) => e.kind === "rejected")
                    ?.note ?? ""
                : "",
            history,
            canEdit: canEditReview(r.my_review_at),
            hoursLeft: editHoursLeft(r.my_review_at),
          }
        : null;
    const roomBased = isRoomBased(r.villa_kind);
    const rooms = Math.max(1, r.rooms);
    const nights =
      r.check_in && r.check_out ? nightsBetween(r.check_in, r.check_out) : 0;
    const pkg = parsePackage(r.package);
    const extras = parseServiceList(r.extras).filter((s) => s.price > 0);
    // Recompute the checkout total: a package's all-inclusive price, or the
    // nightly quote (price × rooms × nights, less discount, plus fee) — then any
    // paid add-ons. Mirrors what the payment page charged. An owner-granted
    // discount always comes off; the merge credit comes off only while the
    // balance is still DUE (once settled, the credit was money the guest really
    // did pay — just on the earlier stay this one absorbed). A stay whose room
    // count varies by night bills its real room-nights, not its peak count.
    const money = bookingMoney({
      pkg,
      villaPrice: r.villa_price,
      villaDiscount: r.villa_discount,
      roomBased,
      rooms,
      nights,
      roomPlan: r.room_plan,
      extras,
      discPct: r.disc_pct,
      discFixed: r.disc_fixed,
      paidCredit: r.paid_credit,
      paymentDue: r.payment_due === 1,
      couponCode: r.coupon_code,
    });
    const amountPaid = money.amount;
    return {
      id: r.id,
      villa: `${r.villa_name}, ${r.villa_city}`,
      kind: r.villa_kind,
      posted: timeAgo(r.created_at),
      bookedAt: formatBookedAt(r.created_at),
      dates: r.dates,
      nights,
      rooms,
      guests: guestsLabel(r.guests),
      // Accepted stays whose checkout has passed read as completed.
      status:
        r.status === "accepted" && r.check_out !== "" && r.check_out < today
          ? "completed"
          : r.status,
      // Strictly after today — a stay starting today has already begun, so it's
      // no longer cancellable (cancellation is only allowed before the start date).
      upcoming: r.check_in !== "" && r.check_in > today,
      createdAt: r.created_at,
      amountPaid,
      paymentDue: r.payment_due === 1,
      // Not only while DUE: a settled stay bought with a coupon (or an owner
      // discount) keeps its receipt, so a $1.00 'Amount paid' explains itself.
      pay:
        r.payment_due === 1 || money.hostDiscount > 0
          ? {
              fullStay: money.fullStay,
              hostDiscount: money.hostDiscount,
              alreadyPaid: money.alreadyPaid,
            }
          : null,
      couponCode: r.coupon_code,
      myRating: r.my_rating,
      myReview: reviewView,
      extras,
      package: pkg,
      plan: roomBased ? parseRoomPlan(r.room_plan) : null,
    };
  });
}

/** One step in a review's life, newest last. */
export type ReviewEvent = {
  id: number;
  kind: "submitted" | "edited" | "approved" | "rejected";
  /** The admin's reason for turning it down; "" on every other kind. */
  note: string;
  /** What the review said at that moment — a later edit never rewrites it. */
  stars: number;
  comment: string;
  /** Who acted, and whether they acted as MyVilla rather than as the guest. */
  actorName: string;
  byAdmin: boolean;
  when: string;
};

/**
 * The history of the given reviews, keyed by review id.
 *
 * One query for all of them: these lists render a row per booking or per
 * review, and asking per row is how a page ends up making thirty round trips
 * to say the same thing.
 */
export async function getReviewHistories(
  reviewIds: number[],
): Promise<Map<number, ReviewEvent[]>> {
  const out = new Map<number, ReviewEvent[]>();
  const ids = [...new Set(reviewIds)].filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return out;

  const rows = (await getDb()
    .prepare(
      `SELECT e.id, e.review_id, e.kind, e.note, e.stars, e.comment,
              e.by_admin, e.created_at,
              u.full_name AS actor_name, u.email AS actor_email
       FROM review_events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.review_id = ANY(?)
       ORDER BY e.review_id, e.id`,
    )
    .all(ids)) as {
    id: number;
    review_id: number;
    kind: ReviewEvent["kind"];
    note: string;
    stars: number;
    comment: string;
    by_admin: number;
    created_at: string;
    actor_name: string | null;
    actor_email: string | null;
  }[];

  for (const r of rows) {
    const list = out.get(r.review_id) ?? [];
    list.push({
      id: r.id,
      kind: r.kind,
      note: r.note,
      stars: Number(r.stars),
      comment: r.comment,
      // An admin acts as MyVilla, not as a person — the guest has no business
      // knowing which member of staff read their review.
      actorName: r.by_admin === 1
        ? "MyVilla"
        : r.actor_name || r.actor_email || "the guest",
      byAdmin: r.by_admin === 1,
      when: timeAgo(r.created_at),
    });
    out.set(r.review_id, list);
  }
  return out;
}

export type ReviewItem = {
  id: number;
  stars: number;
  comment: string;
  authorName: string;
  authorAvatar: string;
  date: string; // "January 2026"
};

function monthYear(sqliteUtc: string): string {
  const d = new Date(sqliteUtc.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type ReviewRow = {
  id: number;
  stars: number;
  comment: string;
  created_at: string;
  name: string;
  email: string;
  avatar: string;
};

const toReview = (r: ReviewRow): ReviewItem => ({
  id: r.id,
  stars: r.stars,
  comment: r.comment,
  authorName: r.name || r.email.split("@")[0],
  authorAvatar: r.avatar,
  date: monthYear(r.created_at),
});

/** Written reviews for one villa, newest first (only those with text). */
export async function getVillaReviews(
  villaId: number,
  limit = 12,
): Promise<ReviewItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT r.id, r.stars, r.comment, r.created_at,
              u.full_name AS name, u.email AS email, u.avatar AS avatar
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.villa_id = ? AND r.comment != '' AND r.status = 'approved'
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    )
    .all(villaId, limit)) as ReviewRow[];
  return rows.map(toReview);
}

/** Star distribution (5→1) for a villa's real ratings. */
export async function getVillaReviewDistribution(
  villaId: number,
): Promise<{ stars: number; count: number }[]> {
  const rows = (await getDb()
    .prepare(
      "SELECT stars, COUNT(*) AS n FROM reviews WHERE villa_id = ? AND status = 'approved' GROUP BY stars",
    )
    .all(villaId)) as { stars: number; n: number }[];
  const map = new Map(rows.map((r) => [r.stars, r.n]));
  return [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: map.get(s) ?? 0 }));
}

/** Written reviews across all villas a host owns (for the public profile). */
export async function getHostReviews(
  ownerId: number,
  limit = 6,
): Promise<ReviewItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT r.id, r.stars, r.comment, r.created_at,
              u.full_name AS name, u.email AS email, u.avatar AS avatar
       FROM reviews r
       JOIN villas v ON v.id = r.villa_id
       JOIN users u ON u.id = r.user_id
       WHERE v.owner_id = ? AND r.comment != '' AND r.status = 'approved'
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    )
    .all(ownerId, limit)) as ReviewRow[];
  return rows.map(toReview);
}

export async function getHostReviewDistribution(
  ownerId: number,
): Promise<{ stars: number; count: number }[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT r.stars AS stars, COUNT(*) AS n
       FROM reviews r JOIN villas v ON v.id = r.villa_id
       WHERE v.owner_id = ? AND r.status = 'approved' GROUP BY r.stars`,
    )
    .all(ownerId)) as { stars: number; n: number }[];
  const map = new Map(rows.map((r) => [r.stars, r.n]));
  return [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: map.get(s) ?? 0 }));
}

export async function getHostReviewSummary(
  ownerId: number,
): Promise<{ count: number; average: number }> {
  const row = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(ROUND(AVG(stars)::numeric, 2), 0) AS avg
       FROM reviews r JOIN villas v ON v.id = r.villa_id
       WHERE v.owner_id = ? AND r.status = 'approved'`,
    )
    .get(ownerId)) as { n: number; avg: number };
  return { count: row.n, average: row.avg };
}

/** One booking-rows engine for the owner's Rent Requests and the admin's
 *  platform-wide Bookings list — same SELECT, same money math, different
 *  scope predicate. `where` interpolates into the SQL, so it must be a
 *  string literal from THIS module, never caller input. */
async function bookingItems(where: string, params: unknown[]): Promise<RequestItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT b.id, b.dates, b.guests, b.rooms, b.status, b.payment_due,
              b.created_at, b.package, b.check_in, b.check_out, b.guest_id, b.extras,
              b.room_plan, b.disc_pct, b.disc_fixed, b.paid_credit, b.coupon_code,
              v.id AS villa_id, v.owner_id,
              v.name AS villa_name, v.city AS villa_city, v.kind AS villa_kind,
              v.price AS villa_price, v.discount AS villa_discount,
              u.full_name AS tenant, u.email AS tenant_email, u.avatar AS avatar,
              u.customer_id, u.phone_code, u.phone_number,
              o.full_name AS owner_name, o.email AS owner_email
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       JOIN users u ON u.id = b.guest_id
       JOIN users o ON o.id = v.owner_id
       WHERE ${where} AND b.status IN ('accepted','pending','declined','cancelled','completed')
       ORDER BY b.created_at DESC, b.id DESC`,
    )
    .all(...params)) as Array<{
    id: number;
    dates: string;
    guests: number;
    rooms: number;
    status: BookingStatus;
    payment_due: number;
    created_at: string;
    package: string;
    check_in: string;
    check_out: string;
    guest_id: number;
    extras: string;
    room_plan: string;
    disc_pct: number;
    disc_fixed: number;
    paid_credit: number;
    coupon_code: string;
    villa_name: string;
    villa_city: string;
    villa_kind: string;
    villa_price: number;
    villa_discount: number;
    tenant: string;
    tenant_email: string;
    avatar: string;
    customer_id: string | null;
    phone_code: string;
    phone_number: string;
    villa_id: number;
    owner_id: number;
    owner_name: string;
    owner_email: string;
  }>;
  return rows.map((r) => {
    const roomBased = isRoomBased(r.villa_kind);
    const rooms = Math.max(1, r.rooms);
    const nights =
      r.check_in && r.check_out ? nightsBetween(r.check_in, r.check_out) : 0;
    const pkg = parsePackage(r.package);
    const extras = parseServiceList(r.extras).filter((s) => s.price > 0);
    // The very same sum the guest is shown — see bookingMoney. The host quoting
    // one number while the guest sees another would be worse than no number.
    const money = bookingMoney({
      pkg,
      villaPrice: r.villa_price,
      villaDiscount: r.villa_discount,
      roomBased,
      rooms,
      nights,
      roomPlan: r.room_plan,
      extras,
      discPct: r.disc_pct,
      discFixed: r.disc_fixed,
      paidCredit: r.paid_credit,
      paymentDue: r.payment_due === 1,
      couponCode: r.coupon_code,
    });
    return {
      id: r.id,
      tenant: r.tenant || r.tenant_email,
      avatar: r.avatar,
      villa: `${r.villa_name}, ${r.villa_city}`,
      dates: r.dates,
      guests: guestsLabel(r.guests),
      checkIn: r.check_in ?? "",
      checkOut: r.check_out ?? "",
      rooms,
      status: r.status,
      paymentDue: r.payment_due === 1,
      createdAt: r.created_at,
      package: pkg,
      kind: r.villa_kind,
      nights,
      guestCount: r.guests,
      guestId: r.guest_id,
      bookedAt: formatBookedAt(r.created_at),
      amount: money.amount,
      money,
      guestEmail: r.tenant_email,
      guestCustomerId: r.customer_id ?? "",
      couponCode: r.coupon_code,
      guestPhone: r.phone_number
        ? `${r.phone_code} ${r.phone_number}`.trim()
        : "",
      extras,
      roomPlan: (roomBased ? parseRoomPlan(r.room_plan) : null) ?? [],
      villaId: r.villa_id,
      ownerId: r.owner_id,
      ownerName: r.owner_name || r.owner_email,
    };
  });
}

export function getRequestsForOwner(ownerId: number): Promise<RequestItem[]> {
  return bookingItems("v.owner_id = ?", [ownerId]);
}

/** Every booking on the platform — the admin's Bookings list. Cached per
 *  render pass so the overview stats and the list share one read. */
export const getAllBookings = cache(() => bookingItems("TRUE", []));

/* ------------------------ owner-made bookings ------------------------ */

// Shared with the client picker from a dependency-free module — see guests.ts.
export { GUEST_SEARCH_MIN, type GuestOption } from "./guests";

/** Users matching `query` by name, email or customer ID, for an owner booking on
 *  their behalf. Customer ID is searchable because it's the one identifier a
 *  guest can quote unambiguously — names collide and emails get mistyped.
 *  `excludeUserId` drops the owner themselves — nobody books their own villa
 *  for themselves. */
export async function searchGuests(
  query: string,
  excludeUserId: number,
): Promise<GuestOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < GUEST_SEARCH_MIN) return [];
  // LIKE metacharacters are escaped so a customer ID or email typed verbatim
  // matches literally — an unescaped "_" is LIKE's single-char wildcard, so
  // "a_b" would otherwise quietly match "axb" too.
  const escaped = trimmed.toLowerCase().replace(/([\\%_])/g, "\\$1");
  const like = `%${escaped}%`;
  const rows = (await getDb()
    .prepare(
      `SELECT id, full_name, email, customer_id, avatar FROM users
       WHERE id != ?
         AND (LOWER(full_name) LIKE ? ESCAPE '\\'
              OR LOWER(email) LIKE ? ESCAPE '\\'
              OR LOWER(COALESCE(customer_id, '')) LIKE ? ESCAPE '\\')
       ORDER BY full_name, email LIMIT 8`,
    )
    .all(excludeUserId, like, like, like)) as {
    id: number;
    full_name: string;
    email: string;
    customer_id: string | null;
    avatar: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    email: r.email,
    customerId: r.customer_id ?? "",
    avatar: r.avatar,
  }));
}

/** One user by id, for re-showing a picked guest server-side. */
export async function getGuestOption(id: number): Promise<GuestOption | null> {
  const r = (await getDb()
    .prepare(
      "SELECT id, full_name, email, customer_id, avatar FROM users WHERE id = ?",
    )
    .get(id)) as
    | {
        id: number;
        full_name: string;
        email: string;
        customer_id: string | null;
        avatar: string;
      }
    | undefined;
  return r
    ? {
        id: r.id,
        name: r.full_name,
        email: r.email,
        customerId: r.customer_id ?? "",
        avatar: r.avatar,
      }
    : null;
}

/* ------------------------ paying an owner's booking ------------------------ */

/** How many stays this guest has been asked to pay for — host-arranged bookings
 *  that hold nothing until settled. Drives the Payment Pending tab's badge, so
 *  a request is visible from anywhere in the profile rather than only once
 *  you open the page. */
export async function getPendingPaymentCount(guestId: number): Promise<number> {
  const r = (await getDb()
    .prepare(
      // Both payable shapes count: 'pending' (owner-arranged, unpaid) and
      // 'accepted' with a balance due (a merged upgrade of a paid stay).
      `SELECT COUNT(*) AS n FROM bookings
       WHERE guest_id = ? AND status IN ('pending','accepted') AND payment_due = 1`,
    )
    .get(guestId)) as { n: number };
  return Number(r?.n) || 0;
}

/** An owner-made booking the guest still owes for, with everything the payment
 *  page needs. Unlike a normal checkout, none of this comes from the URL — the
 *  stay already exists, so its terms are read straight off the row. */
export type BookingToPay = {
  id: number;
  villaId: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rooms: number;
  roomBased: boolean;
  extras: VillaService[];
  /** The stay's full price — what it would have cost at a normal checkout. */
  baseAmount: number;
  /** The owner's promised discount (% and/or fixed, resolved to dollars). */
  hostDiscount: number;
  /** What the guest already paid for the stay this one absorbed (merged
   *  upgrades only; 0 otherwise). */
  credit: number;
  /** What the guest owes now: base − host discount − credit. */
  amount: number;
  /** Merged upgrade of an already-paid stay — its rooms are held; paying
   *  settles the balance rather than creating the reservation. */
  upgraded: boolean;
  /** Set when the stay holds different rooms on different nights (the owner
   *  fulfilled an ask the calendar couldn't hold flat) — the payment page
   *  itemizes these legs instead of pretending one count fits every night. */
  plan: RoomSegment[] | null;
  /** Who arranged it, for "your host booked this for you". */
  hostName: string;
};

/** The booking `bookingId` if it's this guest's, still active, and awaiting
 *  their payment. Null otherwise — which is what stops one guest paying (or
 *  peeking at) another's booking, or paying the same stay twice. */
export async function getBookingToPay(
  bookingId: number,
  guestId: number,
): Promise<BookingToPay | null> {
  const r = (await getDb()
    .prepare(
      `SELECT b.id, b.villa_id, b.check_in, b.check_out, b.guests, b.rooms,
              b.room_plan, b.extras, b.status, b.payment_due, b.disc_pct,
              b.disc_fixed, b.paid_credit,
              v.kind, v.price, v.discount,
              u.full_name AS host_name, u.email AS host_email
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       JOIN users u ON u.id = v.owner_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, guestId)) as
    | {
        id: number;
        villa_id: number;
        check_in: string;
        check_out: string;
        guests: number;
        rooms: number;
        room_plan: string;
        extras: string;
        status: BookingStatus;
        payment_due: number;
        disc_pct: number;
        disc_fixed: number;
        paid_credit: number;
        kind: string;
        price: number;
        discount: number;
        host_name: string;
        host_email: string;
      }
    | undefined;
  if (!r) return null;
  // Two payable shapes: 'pending' (owner arranged it, holds no rooms until
  // paid) and 'accepted' with a balance due — a merged upgrade of a stay the
  // guest already paid for, whose rooms are held while they settle the rest.
  if (r.payment_due !== 1 || (r.status !== "pending" && r.status !== "accepted"))
    return null;

  const roomBased = isRoomBased(r.kind);
  const rooms = Math.max(1, r.rooms);
  const nights = Math.max(1, nightsBetween(r.check_in, r.check_out));
  const extras = parseServiceList(r.extras);
  const extrasTotal = extras.reduce((sum, s) => sum + s.price, 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Priced exactly like the guest's own checkout would have — same quote, same
  // automatic length-of-stay discount. A stay whose room count varies by night
  // bills its actual room-nights, not its peak count.
  const payPlan = roomBased ? parseRoomPlan(r.room_plan) : null;
  const roomNights = payPlan
    ? planRoomNights(payPlan)
    : (roomBased ? rooms : 1) * nights;
  const base = round2(
    quote((r.price * roomNights) / nights, nights, r.discount).total +
      extrasTotal,
  );
  // The owner's promised discount (% and/or fixed), never past the total…
  const hostDiscount = Math.min(
    base,
    round2((base * Math.max(0, r.disc_pct)) / 100 + Math.max(0, r.disc_fixed)),
  );
  // …then whatever the guest already paid for the stay this one absorbed.
  const credit = Math.min(round2(r.paid_credit), round2(base - hostDiscount));
  const amount = round2(base - hostDiscount - credit);

  return {
    id: r.id,
    villaId: r.villa_id,
    checkIn: r.check_in,
    checkOut: r.check_out,
    nights,
    guests: r.guests,
    rooms,
    roomBased,
    extras,
    baseAmount: base,
    hostDiscount,
    credit,
    amount,
    /** True for a merged upgrade: the rooms are already held, paying settles
     *  the balance rather than creating the reservation. */
    upgraded: r.status === "accepted",
    plan: payPlan,
    hostName: r.host_name || r.host_email,
  };
}

/* ------------------------------- coupons ------------------------------- */

/** An owner's coupon as listed on their Coupons page. */
export type CouponItem = {
  id: number;
  villaId: number;
  villaName: string;
  villaKind: string;
  code: string;
  /** Percent off (1–99) — 0 when the coupon is a fixed amount. */
  pct: number;
  /** Fixed amount off (> 0) — 0 when the coupon is a percentage. */
  fixed: number;
  createdAt: string;
  /** Locked to editing: a still-standing booking redeemed this code and that
   *  stay hasn't completed yet. The owner can't change it out from under an
   *  in-flight booking — editing reopens once every such stay completes.
   *  See {@link isCouponInUse} for exactly what counts. */
  inUse: boolean;
};

/** One coupon-rows engine for the owner list and the admin's platform-wide
 *  one. `where` must be a string literal from THIS module, never caller
 *  input; `ownerName` is joined for the admin view (owners know theirs). */
async function couponItems(
  where: string,
  extra: unknown[],
): Promise<(CouponItem & { ownerName: string })[]> {
  const today = todayKey();
  const rows = (await getDb()
    .prepare(
      // in_use mirrors isCouponInUse: a pending or still-current accepted stay
      // that carries this code holds the lock; a stay that has completed (an
      // accepted one past checkout) or was cancelled/declined never does.
      `SELECT c.id, c.villa_id, c.code, c.pct, c.fixed, c.created_at,
              v.name AS villa_name, v.kind AS villa_kind,
              o.full_name AS owner_name, o.email AS owner_email,
              CASE WHEN EXISTS (
                SELECT 1 FROM bookings b
                WHERE UPPER(b.coupon_code) = UPPER(c.code)
                  AND b.status IN ('pending', 'accepted')
                  AND NOT (b.status = 'accepted' AND b.check_out <> '' AND b.check_out < ?)
              ) THEN 1 ELSE 0 END AS in_use
       FROM coupons c
       JOIN villas v ON v.id = c.villa_id
       JOIN users o ON o.id = v.owner_id
       WHERE ${where}
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all(today, ...extra)) as {
    id: number;
    villa_id: number;
    code: string;
    pct: number;
    fixed: number;
    created_at: string;
    villa_name: string;
    villa_kind: string;
    owner_name: string;
    owner_email: string;
    in_use: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    villaId: r.villa_id,
    villaName: r.villa_name,
    villaKind: r.villa_kind,
    code: r.code,
    pct: r.pct,
    fixed: r.fixed,
    createdAt: r.created_at,
    inUse: r.in_use === 1,
    ownerName: r.owner_name || r.owner_email,
  }));
}

export function getCouponsForOwner(ownerId: number): Promise<CouponItem[]> {
  return couponItems("v.owner_id = ?", [ownerId]);
}

/** Every coupon on the platform with its property and owner — the admin's
 *  view. `inUse` still gates deletion, exactly as it does for the owner. */
export function getAllCouponsAdmin(): Promise<
  (CouponItem & { ownerName: string })[]
> {
  return couponItems("TRUE", []);
}

export type Coupon = {
  id: number;
  villaId: number;
  code: string;
  pct: number;
  fixed: number;
};

/** The coupon behind `code`, if any — codes are globally unique, so a bare
 *  code identifies one coupon; whether it applies to a given property is the
 *  caller's check (`coupon.villaId`). Case-insensitive. */
export async function findCoupon(code: string): Promise<Coupon | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const r = (await getDb()
    .prepare(
      `SELECT id, villa_id, code, pct, fixed FROM coupons
       WHERE UPPER(code) = UPPER(?)`,
    )
    .get(trimmed)) as
    | { id: number; villa_id: number; code: string; pct: number; fixed: number }
    | undefined;
  if (!r) return null;
  return { id: r.id, villaId: r.villa_id, code: r.code, pct: r.pct, fixed: r.fixed };
}

/** True when `userId` has EVER applied `code` to a booking. One coupon, one use
 *  per guest — for good — so a second checkout for the same property (or any
 *  property; codes are globally unique) is refused.
 *
 *  Booking status is deliberately not considered: a code is spent the moment
 *  it's applied at checkout, and cancelling that booking — by the guest or the
 *  owner — does NOT hand the coupon back. Once used, always used, so nobody can
 *  book at a discount, cancel, and redeem the same code again. Backstopped by
 *  the bookings_coupon_once unique index in db.ts. */
export async function hasRedeemedCoupon(
  userId: number,
  code: string,
): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const r = (await getDb()
    .prepare(
      `SELECT 1 FROM bookings
       WHERE guest_id = ? AND UPPER(coupon_code) = UPPER(?)
       LIMIT 1`,
    )
    .get(userId, trimmed)) as { "?column?": number } | undefined;
  return r !== undefined;
}

/** True while `code` is locked to editing: a still-standing booking redeemed it
 *  and that stay hasn't completed yet. The owner can't edit a coupon out from
 *  under an in-flight booking — the lock lifts once every such stay completes.
 *
 *  "Completed" is the same notion the trips list derives: a booking is done the
 *  moment its status is literally 'completed', or it's 'accepted' with a
 *  checkout that has passed. So a pending redemption, or an accepted stay still
 *  to come / in progress, holds the lock; a cancelled or declined booking never
 *  used the coupon and never held it. Case-insensitive, matching how the code is
 *  snapshotted onto bookings at checkout. */
export async function isCouponInUse(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const today = todayKey();
  const r = (await getDb()
    .prepare(
      `SELECT 1 FROM bookings
       WHERE UPPER(coupon_code) = UPPER(?)
         AND status IN ('pending', 'accepted')
         AND NOT (status = 'accepted' AND check_out <> '' AND check_out < ?)
       LIMIT 1`,
    )
    .get(trimmed, today)) as { "?column?": number } | undefined;
  return r !== undefined;
}

/** Codes starting with `prefix` (case-insensitive) — feeds the "already taken,
 *  try one of these" suggestions when an owner picks a code that exists. */
export async function getCouponCodesLike(prefix: string): Promise<Set<string>> {
  const escaped = prefix.trim().toUpperCase().replace(/([\%_])/g, "\$1");
  const rows = (await getDb()
    .prepare(`SELECT code FROM coupons WHERE UPPER(code) LIKE ? ESCAPE '\'`)
    .all(`${escaped}%`)) as { code: string }[];
  return new Set(rows.map((r) => r.code.toUpperCase()));
}
