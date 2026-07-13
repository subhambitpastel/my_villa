// Read-side queries mapping DB rows to the display shapes the UI renders.
import { getDb, timeAgo, type BookingStatus, type VillaRow } from "./db";
import type { VillaService } from "@/components/host/draft";
import { roomCapacity, roomsFreeForRange, type RoomBooking } from "./rooms";
import { parsePackageType, type PackageType } from "./packageTypes";

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
  posted: string;
  dates: string;
  guests: string;
  status: BookingStatus;
  createdAt: string;
  /** Stars the guest gave this stay, or null while unrated. */
  myRating: number | null;
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
  /** Rooms this reservation holds (1 for whole-villa stays). */
  rooms: number;
  status: BookingStatus;
  createdAt: string;
  /** Set when this booking is a package (all-inclusive), else null. */
  package: PackageSnapshot | null;
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
const RVW_COUNT = "(SELECT COUNT(*) FROM reviews rv WHERE rv.villa_id = v.id)";
const RVW_RATING =
  "COALESCE((SELECT ROUND(AVG(rv.stars)::numeric, 2) FROM reviews rv WHERE rv.villa_id = v.id), 0)";

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

// Shared column list + row mapper for the three package-listing queries.
const PKG_COLS = `p.id, p.villa_id, p.name, p.description, p.type, p.nights, p.max_guests,
  p.discount, p.price, p.inclusions, v.name AS villa_name, v.city AS villa_city,
  v.kind AS villa_kind, v.image AS villa_image`;

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
  villa_name: string;
  villa_city: string;
  villa_kind: string;
  villa_image: string;
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

/** Packages offered on one villa (guest-facing villa page). */
export async function getPackagesForVilla(
  villaId: number,
): Promise<PackageItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT ${PKG_COLS}
       FROM packages p JOIN villas v ON v.id = p.villa_id
       WHERE p.villa_id = ?
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
  const where = excludeOwnerId != null ? "WHERE p.owner_id != ?" : "";
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
              p.price, p.inclusions, v.kind AS villa_kind, v.rooms AS villa_rooms,
              v.people_per_room AS people_per_room, v.max_guests AS villa_max_guests
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
        villa_kind: string;
        villa_rooms: number;
        people_per_room: number;
        villa_max_guests: number;
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
  villaDescription: string;
  villaRooms: number;
  peoplePerRoom: number;
  ownerId: number;
  rating: number;
  reviews: number;
};

export async function getPackageDetail(
  id: number,
): Promise<PackageDetail | null> {
  const row = (await getDb()
    .prepare(
      `SELECT p.id, p.name, p.description, p.nights, p.max_guests, p.discount, p.price, p.inclusions,
              v.id AS villa_id, v.name AS villa_name, v.city AS villa_city,
              v.kind AS villa_kind, v.image AS villa_image, v.description AS villa_description,
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
        villa_id: number;
        villa_name: string;
        villa_city: string;
        villa_kind: string;
        villa_image: string;
        villa_description: string;
        villa_rooms: number;
        people_per_room: number;
        owner_id: number;
        rvw_count: number;
        rvw_rating: number;
      }
    | undefined;
  if (!row) return null;
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
    villaDescription: row.villa_description,
    villaRooms: row.villa_rooms,
    peoplePerRoom: row.people_per_room,
    ownerId: row.owner_id,
    rating: Number(row.rvw_rating),
    reviews: Number(row.rvw_count),
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
             FROM villas v WHERE v.owner_id != ? ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(excludeOwnerId, limit)
      : await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
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
             FROM villas v WHERE v.featured = 1 AND v.owner_id != ?
             ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
          )
          .all(excludeOwnerId, limit)
      : await getDb()
          .prepare(
            `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
             FROM villas v WHERE v.featured = 1
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
    where.push(`(${RVW_RATING} >= ? OR ${RVW_COUNT} = 0)`);
    params.push(filters.rating);
  }
  if (filters.guests != null) {
    where.push("max_guests >= ?");
    params.push(filters.guests);
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

/** True when no confirmed stay overlaps the given range. `excludeBookingId`
 *  ignores one booking (used when editing it, so its own dates don't clash). */
export async function isVillaAvailable(
  villaId: number,
  checkIn: string,
  checkOut: string,
  roomsNeeded = 1,
  excludeBookingId = 0,
): Promise<boolean> {
  const villa = (await getDb()
    .prepare("SELECT kind, rooms FROM villas WHERE id = ?")
    .get(villaId)) as { kind: string; rooms: number } | undefined;
  if (!villa) return false;
  // Whole-villa kinds have capacity 1, so any overlap blocks (as before);
  // hotels/resorts allow concurrent stays up to their room count.
  const capacity = roomCapacity(villa.kind, villa.rooms);
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out, rooms FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != ''
         AND check_in < ? AND check_out > ? AND id != ?`,
    )
    .all(villaId, checkOut, checkIn, excludeBookingId)) as {
    check_in: string;
    check_out: string;
    rooms: number;
  }[];
  const bookings: RoomBooking[] = rows.map((r) => ({
    checkIn: r.check_in,
    checkOut: r.check_out,
    rooms: Math.max(1, r.rooms),
  }));
  const need = Math.max(1, Math.trunc(roomsNeeded) || 1);
  return roomsFreeForRange(checkIn, checkOut, bookings, capacity) >= need;
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
): Promise<RoomBooking[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT check_in, check_out, rooms FROM bookings
       WHERE villa_id = ? AND status = 'accepted'
         AND check_in != '' AND check_out != '' AND id != ?`,
    )
    .all(villaId, excludeBookingId)) as {
    check_in: string;
    check_out: string;
    rooms: number;
  }[];
  return rows.map((r) => ({
    checkIn: r.check_in,
    checkOut: r.check_out,
    rooms: Math.max(1, r.rooms),
  }));
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
  kind: string;
  /** Hotels/resorts: max occupancy of one room (0 for whole-villa kinds). */
  peoplePerRoom: number;
  /** Rooms this reservation holds (1 for whole-villa stays). */
  bookingRooms: number;
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
              b.status,
              v.name AS villa_name, v.city AS villa_city, v.image AS villa_image,
              v.price, v.max_guests, v.rooms, v.bathrooms, v.kind, v.people_per_room
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
        booking_rooms: number;
        status: BookingStatus;
        villa_name: string;
        villa_city: string;
        villa_image: string;
        price: number;
        max_guests: number;
        rooms: number;
        bathrooms: number;
        kind: string;
        people_per_room: number;
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
    kind: row.kind,
    peoplePerRoom: row.people_per_room,
    bookingRooms: Math.max(1, row.booking_rooms),
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

/** Largest guest capacity across every listing (for hotels/resorts this is
 *  rooms × people-per-room). Caps the home hero's guest picker so it always
 *  reaches the biggest place currently listed. */
export async function getMaxVillaGuests(): Promise<number> {
  const row = (await getDb()
    .prepare("SELECT COALESCE(MAX(max_guests), 0) AS n FROM villas")
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
       FROM villas`,
    )
    .get()) as { resort: number; hotel: number; rent: number };
  return {
    resort: Math.max(1, row.resort),
    hotel: Math.max(1, row.hotel),
    rent: Math.max(1, row.rent),
  };
}

/** Villas the user has hearted, most recently saved first. */
export async function getFavoriteVillas(userId: number): Promise<CatalogVilla[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT v.*, ${RVW_COUNT} AS rvw_count, ${RVW_RATING} AS rvw_rating
       FROM favorites f
       JOIN villas v ON v.id = f.villa_id
       WHERE f.user_id = ?
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

const guestsLabel = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;

export async function getBookingsForGuest(guestId: number): Promise<BookingItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT b.id, b.dates, b.check_out, b.guests, b.status, b.created_at, b.extras,
              b.package,
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
    extras: string;
    package: string;
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
    extras: parseServiceList(r.extras).filter((s) => s.price > 0),
    package: parsePackage(r.package),
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
      `SELECT b.id, b.dates, b.guests, b.rooms, b.status, b.created_at, b.package,
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
    rooms: number;
    status: BookingStatus;
    created_at: string;
    package: string;
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
    rooms: r.rooms,
    status: r.status,
    createdAt: r.created_at,
    package: parsePackage(r.package),
  }));
}
