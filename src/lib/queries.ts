// Read-side queries mapping DB rows to the display shapes the UI renders.
import { getDb, timeAgo, type BookingStatus, type VillaRow } from "./db";
import type { VillaService } from "@/components/host/draft";

export type PropertyItem = {
  id: number;
  name: string;
  city: string;
  price: number;
  rating: number;
  reviews: number;
  posted: string;
  image: string;
};

export type CatalogVilla = {
  id: number;
  name: string;
  kind: string;
  city: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
};

export type BookingItem = {
  id: number;
  villa: string;
  posted: string;
  dates: string;
  guests: string;
  status: BookingStatus;
  createdAt: string;
  /** Stars the guest gave this stay, or null while unrated. */
  myRating: number | null;
};

export type RequestItem = {
  id: number;
  tenant: string;
  avatar: string;
  villa: string;
  dates: string;
  guests: string;
  status: BookingStatus;
  createdAt: string;
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

function toProperty(v: VillaRow): PropertyItem {
  return {
    id: v.id,
    name: v.name,
    city: v.city,
    price: v.price,
    rating: v.rating,
    reviews: v.reviews,
    posted: timeAgo(v.created_at, "Posted"),
    image: v.image,
  };
}

export async function getVillasByOwner(ownerId: number): Promise<PropertyItem[]> {
  const rows = (await getDb()
    .prepare("SELECT * FROM villas WHERE owner_id = ? ORDER BY created_at DESC, id DESC")
    .all(ownerId)) as VillaRow[];
  return rows.map(toProperty);
}

export async function getCatalogVillas(
  limit = 24,
  excludeOwnerId?: number,
): Promise<CatalogVilla[]> {
  const rows = (
    excludeOwnerId != null
      ? await getDb()
          .prepare(
            "SELECT * FROM villas WHERE owner_id != ? ORDER BY created_at DESC, id DESC LIMIT ?",
          )
          .all(excludeOwnerId, limit)
      : await getDb()
          .prepare("SELECT * FROM villas ORDER BY created_at DESC, id DESC LIMIT ?")
          .all(limit)
  ) as VillaRow[];
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    rating: v.rating,
    reviews: v.reviews,
    image: v.image,
  }));
}

export async function getVillaById(id: number): Promise<VillaRow | null> {
  const row = (await getDb().prepare("SELECT * FROM villas WHERE id = ?").get(id)) as
    | VillaRow
    | undefined;
  return row ?? null;
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

export async function getVillaDetail(id: number): Promise<VillaDetail | null> {
  const row = (await getDb()
    .prepare(
      `SELECT v.*, u.full_name AS host_name, u.avatar AS host_avatar,
              u.created_at AS host_joined
       FROM villas v JOIN users u ON u.id = v.owner_id
       WHERE v.id = ?`,
    )
    .get(id)) as
    | (VillaRow & { host_name: string; host_avatar: string; host_joined: string })
    | undefined;
  if (!row) return null;

  const gallery = parseJsonList(row.images);
  return {
    ...row,
    hostName: row.host_name || "MyVilla Host",
    hostAvatar: row.host_avatar,
    hostJoined: row.host_joined,
    facilityList: parseJsonList(row.facilities),
    serviceList: parseServiceList(row.services),
    gallery: gallery.length > 0 ? gallery : [row.image],
  };
}

export async function searchVillas(
  filters: SearchFilterInput,
): Promise<CatalogVilla[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    where.push("(name ILIKE ? OR city ILIKE ? OR address ILIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
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
    // New listings (0 reviews) stay visible regardless of the rating floor.
    where.push("(rating >= ? OR reviews = 0)");
    params.push(filters.rating);
  }
  for (const amenity of filters.amenities ?? []) {
    where.push("facilities ILIKE ?");
    params.push(`%${JSON.stringify(amenity)}%`);
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

  const orderBy = {
    newest: "created_at DESC, id DESC",
    price_asc: "price ASC, id DESC",
    price_desc: "price DESC, id DESC",
    rating: "rating DESC, reviews DESC, id DESC",
  }[filters.sort ?? "newest"];

  const rows = (await getDb()
    .prepare(
      `SELECT * FROM villas
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY ${orderBy} LIMIT 50`,
    )
    .all(...params)) as VillaRow[];

  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    rating: v.rating,
    reviews: v.reviews,
    image: v.image,
  }));
}

export type BookedRange = { checkIn: string; checkOut: string };

/** True when no confirmed stay overlaps the given range. `excludeBookingId`
 *  ignores one booking (used when editing it, so its own dates don't clash). */
export async function isVillaAvailable(
  villaId: number,
  checkIn: string,
  checkOut: string,
  excludeBookingId = 0,
): Promise<boolean> {
  const clash = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_in < ? AND check_out > ?
         AND id != ?`,
    )
    .get(villaId, checkOut, checkIn, excludeBookingId)) as { n: number };
  return clash.n === 0;
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
  bathrooms: number;
};

/** A single booking (owned by the guest) with the villa fields the manage page
 *  needs to prefill its detail-style view. Null if it isn't the guest's. */
export async function getBookingForManage(
  bookingId: number,
  guestId: number,
): Promise<ManageBooking | null> {
  const row = (await getDb()
    .prepare(
      `SELECT b.id, b.villa_id, b.check_in, b.check_out, b.guests, b.status,
              v.name AS villa_name, v.city AS villa_city, v.image AS villa_image,
              v.price, v.max_guests, v.rooms, v.bathrooms
       FROM bookings b JOIN villas v ON v.id = b.villa_id
       WHERE b.id = ? AND b.guest_id = ?`,
    )
    .get(bookingId, guestId)) as
    | {
        id: number;
        villa_id: number;
        check_in: string;
        check_out: string;
        guests: number;
        status: BookingStatus;
        villa_name: string;
        villa_city: string;
        villa_image: string;
        price: number;
        max_guests: number;
        rooms: number;
        bathrooms: number;
      }
    | undefined;
  if (!row) return null;
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
    bathrooms: row.bathrooms,
  };
}

export async function getVillaCities(): Promise<string[]> {
  const rows = (await getDb()
    .prepare(
      "SELECT DISTINCT city FROM villas WHERE city != '' ORDER BY city ASC",
    )
    .all()) as { city: string }[];
  return rows.map((r) => r.city);
}

/** Villas the user has hearted, most recently saved first. */
export async function getFavoriteVillas(userId: number): Promise<CatalogVilla[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.* FROM favorites f
       JOIN villas v ON v.id = f.villa_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC, v.id DESC`,
    )
    .all(userId)) as VillaRow[];
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    city: v.city,
    price: v.price,
    rating: v.rating,
    reviews: v.reviews,
    image: v.image,
  }));
}

export async function getFavoriteVillaIds(userId: number): Promise<Set<number>> {
  const rows = (await getDb()
    .prepare("SELECT villa_id FROM favorites WHERE user_id = ?")
    .all(userId)) as { villa_id: number }[];
  return new Set(rows.map((r) => r.villa_id));
}

const guestsLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;

export async function getBookingsForGuest(guestId: number): Promise<BookingItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT b.id, b.dates, b.check_out, b.guests, b.status, b.created_at,
              v.name AS villa_name, v.city AS villa_city,
              rv.stars AS my_rating
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       LEFT JOIN reviews rv ON rv.booking_id = b.id
       WHERE b.guest_id = ?
       ORDER BY b.created_at DESC, b.id DESC`,
    )
    .all(guestId)) as Array<{
    id: number;
    dates: string;
    check_out: string;
    guests: number;
    status: BookingStatus;
    created_at: string;
    villa_name: string;
    villa_city: string;
    my_rating: number | null;
  }>;
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => ({
    id: r.id,
    villa: `${r.villa_name}, ${r.villa_city}`,
    posted: timeAgo(r.created_at),
    dates: r.dates,
    guests: guestsLabel(r.guests),
    // Accepted stays whose checkout has passed read as completed.
    status:
      r.status === "accepted" && r.check_out !== "" && r.check_out < today
        ? "completed"
        : r.status,
    createdAt: r.created_at,
    myRating: r.my_rating,
  }));
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
       WHERE r.villa_id = ? AND r.comment != ''
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
      "SELECT stars, COUNT(*) AS n FROM reviews WHERE villa_id = ? GROUP BY stars",
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
       WHERE v.owner_id = ? AND r.comment != ''
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
       WHERE v.owner_id = ? GROUP BY r.stars`,
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
       WHERE v.owner_id = ?`,
    )
    .get(ownerId)) as { n: number; avg: number };
  return { count: row.n, average: row.avg };
}

export async function getRequestsForOwner(ownerId: number): Promise<RequestItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT b.id, b.dates, b.guests, b.status, b.created_at,
              v.name AS villa_name, v.city AS villa_city,
              u.full_name AS tenant, u.email AS tenant_email, u.avatar AS avatar
       FROM bookings b
       JOIN villas v ON v.id = b.villa_id
       JOIN users u ON u.id = b.guest_id
       WHERE v.owner_id = ? AND b.status IN ('accepted','declined','cancelled')
       ORDER BY b.created_at DESC, b.id DESC`,
    )
    .all(ownerId)) as Array<{
    id: number;
    dates: string;
    guests: number;
    status: BookingStatus;
    created_at: string;
    villa_name: string;
    villa_city: string;
    tenant: string;
    tenant_email: string;
    avatar: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    tenant: r.tenant || r.tenant_email,
    avatar: r.avatar,
    villa: `${r.villa_name}, ${r.villa_city}`,
    dates: r.dates,
    guests: guestsLabel(r.guests),
    status: r.status,
    createdAt: r.created_at,
  }));
}
