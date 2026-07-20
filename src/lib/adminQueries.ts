// Platform-wide queries for the /admin dashboard. Everything here is
// admin-surface only — the section pages and layout call these after their
// own is_admin check; nothing in the guest/owner flows imports this module.

import { getDb, timeAgo, type BookingStatus } from "./db";
import { getAllBookings, parseServiceList } from "./queries";
import { canEditReview, type ReviewStatus } from "./reviews";
import type { VillaService } from "@/components/host/draft";

/** Open call requests across the whole platform — the sidebar badge. */
export async function getOpenCallRequestCount(): Promise<number> {
  const row = (await getDb()
    .prepare("SELECT COUNT(*) AS n FROM call_requests WHERE status = 'open'")
    .get()) as { n: number };
  return row.n;
}

export type AdminStats = {
  users: number;
  disabledUsers: number;
  hosts: number;
  villas: number;
  lockedVillas: number;
  bookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
  /** Money actually collected: every settled stay's own receipt total. */
  revenue: number;
  openCalls: number;
  packages: number;
  coupons: number;
  reviews: number;
};

const ZERO_STATUS: Record<BookingStatus, number> = {
  pending: 0,
  accepted: 0,
  declined: 0,
  cancelled: 0,
  completed: 0,
};

/** The overview tiles. Revenue is summed in TS from each booking's own
 *  `money.amount` (bookingMoney) rather than in SQL: a stay's price derives
 *  live from its room plan, package snapshot and the villa's current rate, so
 *  a SQL SUM would disagree with the receipts guests and owners are shown. */
export async function getAdminStats(): Promise<AdminStats> {
  const db = getDb();
  const one = async (sql: string, ...params: unknown[]) =>
    ((await db.prepare(sql).get(...params)) as { n: number }).n;

  const [
    users,
    disabledUsers,
    hosts,
    villas,
    lockedVillas,
    openCalls,
    packages,
    coupons,
    reviews,
    bookingRows,
  ] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM users"),
    one("SELECT COUNT(*) AS n FROM users WHERE disabled_at IS NOT NULL"),
    one(
      `SELECT COUNT(*) AS n FROM users u
       WHERE u.hosting_enabled = 1
          OR EXISTS (SELECT 1 FROM villas v WHERE v.owner_id = u.id)`,
    ),
    one("SELECT COUNT(*) AS n FROM villas"),
    one("SELECT COUNT(*) AS n FROM villas WHERE locked_at IS NOT NULL"),
    one("SELECT COUNT(*) AS n FROM call_requests WHERE status = 'open'"),
    one("SELECT COUNT(*) AS n FROM packages"),
    one("SELECT COUNT(*) AS n FROM coupons"),
    one("SELECT COUNT(*) AS n FROM reviews"),
    getAllBookings(),
  ]);

  const bookingsByStatus = { ...ZERO_STATUS };
  let revenue = 0;
  for (const b of bookingRows) {
    bookingsByStatus[b.status] = (bookingsByStatus[b.status] ?? 0) + 1;
    // A stay counts once it's settled: accepted or completed, nothing owed.
    if ((b.status === "accepted" || b.status === "completed") && !b.paymentDue)
      revenue += b.money.amount;
  }

  return {
    users,
    disabledUsers,
    hosts,
    villas,
    lockedVillas,
    bookings: bookingRows.length,
    bookingsByStatus,
    revenue: Math.round(revenue * 100) / 100,
    openCalls,
    packages,
    coupons,
    reviews,
  };
}

export type AdminUserItem = {
  id: number;
  name: string;
  email: string;
  customerId: string;
  avatar: string;
  country: string;
  isHost: boolean;
  isAdmin: boolean;
  disabled: boolean;
  joined: string;
  bookings: number;
  properties: number;
  /** Reviews this person WROTE as a guest. */
  reviewsWritten: number;
  /** Reviews their properties RECEIVED, and the average stars across them. */
  reviewsReceived: number;
  hostRating: number;
};

/** Every account, with the counts that say what they actually do here. No
 *  such query existed — guest/owner surfaces only ever look up one user. */
export async function getAdminUsers(): Promise<AdminUserItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT u.id, u.email, u.customer_id, u.full_name, u.avatar, u.country,
              u.hosting_enabled, u.is_admin, u.disabled_at, u.created_at,
              (SELECT COUNT(*) FROM bookings b WHERE b.guest_id = u.id) AS bookings,
              (SELECT COUNT(*) FROM villas v WHERE v.owner_id = u.id) AS properties,
              (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) AS reviews_written,
              (SELECT COUNT(*) FROM reviews r JOIN villas v ON v.id = r.villa_id
                WHERE v.owner_id = u.id) AS reviews_received,
              COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM reviews r
                JOIN villas v ON v.id = r.villa_id
                WHERE v.owner_id = u.id), 0) AS host_rating
       FROM users u
       ORDER BY u.created_at DESC, u.id DESC`,
    )
    .all()) as {
    id: number;
    email: string;
    customer_id: string | null;
    full_name: string;
    avatar: string;
    country: string;
    hosting_enabled: number;
    is_admin: number;
    disabled_at: string | null;
    created_at: string;
    bookings: number;
    properties: number;
    reviews_written: number;
    reviews_received: number;
    host_rating: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.full_name || r.email,
    email: r.email,
    customerId: r.customer_id ?? "",
    avatar: r.avatar,
    country: r.country,
    isHost: r.hosting_enabled === 1 || Number(r.properties) > 0,
    isAdmin: r.is_admin === 1,
    disabled: r.disabled_at !== null,
    joined: timeAgo(r.created_at),
    bookings: Number(r.bookings),
    properties: Number(r.properties),
    reviewsWritten: Number(r.reviews_written),
    reviewsReceived: Number(r.reviews_received),
    hostRating: Number(r.host_rating),
  }));
}

export type AdminCallItem = {
  id: number;
  villaName: string;
  ownerName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  message: string;
  services: VillaService[];
  status: string;
  requested: string;
};

/** Every call request, resolved ones included (the owner's list shows only
 *  open). No chat transcript: a resolved request's messages are deleted, and
 *  a live thread is a private guest–host channel. */
export async function getAllCallRequestsAdmin(): Promise<AdminCallItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT c.id, c.check_in, c.check_out, c.rooms, c.guests, c.message,
              c.services, c.status, c.created_at,
              v.name AS villa_name,
              o.full_name AS owner_name, o.email AS owner_email,
              g.full_name AS guest_name, g.email AS guest_email,
              g.phone_code, g.phone_number
       FROM call_requests c
       JOIN villas v ON v.id = c.villa_id
       JOIN users o ON o.id = v.owner_id
       JOIN users g ON g.id = c.guest_id
       ORDER BY c.created_at DESC, c.id DESC`,
    )
    .all()) as {
    id: number;
    check_in: string;
    check_out: string;
    rooms: number;
    guests: number;
    message: string;
    services: string;
    status: string;
    created_at: string;
    villa_name: string;
    owner_name: string;
    owner_email: string;
    guest_name: string;
    guest_email: string;
    phone_code: string;
    phone_number: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    villaName: r.villa_name,
    ownerName: r.owner_name || r.owner_email,
    guestName: r.guest_name || r.guest_email,
    guestEmail: r.guest_email,
    guestPhone: r.phone_number
      ? `${r.phone_code} ${r.phone_number}`.trim()
      : "",
    checkIn: r.check_in,
    checkOut: r.check_out,
    rooms: Number(r.rooms),
    guests: Number(r.guests),
    message: r.message,
    services: parseServiceList(r.services),
    status: r.status,
    requested: timeAgo(r.created_at),
  }));
}

export type AdminReviewItem = {
  id: number;
  villaId: number;
  /** The stay this rates — one review per booking, so it identifies it. */
  bookingId: number;
  status: ReviewStatus;
  /** The author may still rewrite it — approving now could approve different
   *  words in an hour, so the admin is told. */
  editable: boolean;
  stars: number;
  comment: string;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  villaName: string;
  ownerId: number;
  ownerName: string;
  when: string;
};

/** Every rating on the platform. Unlike the public villa list this KEEPS
 *  star-only reviews (no comment) — they still moved a property's rating. */
export async function getAdminReviews(): Promise<AdminReviewItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT r.id, r.villa_id, r.booking_id, r.status, r.stars, r.comment, r.created_at,
              r.user_id AS author_id, v.owner_id,
              u.full_name AS author_name, u.email AS author_email, u.avatar,
              v.name AS villa_name, v.city AS villa_city,
              o.full_name AS owner_name, o.email AS owner_email
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN villas v ON v.id = r.villa_id
       JOIN users o ON o.id = v.owner_id
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC, r.id DESC`,
    )
    .all()) as {
    id: number;
    villa_id: number;
    booking_id: number;
    status: ReviewStatus;
    stars: number;
    comment: string;
    created_at: string;
    author_id: number;
    owner_id: number;
    author_name: string;
    author_email: string;
    avatar: string;
    villa_name: string;
    villa_city: string;
    owner_name: string;
    owner_email: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    villaId: r.villa_id,
    bookingId: r.booking_id,
    status: r.status,
    editable: canEditReview(r.created_at),
    stars: Number(r.stars),
    comment: r.comment,
    authorId: r.author_id,
    authorName: r.author_name || r.author_email,
    authorAvatar: r.avatar,
    villaName: `${r.villa_name}, ${r.villa_city}`,
    ownerId: r.owner_id,
    ownerName: r.owner_name || r.owner_email,
    when: timeAgo(r.created_at),
  }));
}

export type ActivityItem = {
  kind: "booking" | "review" | "call" | "signup";
  title: string;
  when: string;
  href: string;
};

/** A newest-first feed across the platform's four "something happened"
 *  tables, for the overview page. */
export async function getRecentActivity(limit = 12): Promise<ActivityItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT kind, created_at, actor, subject, extra FROM (
         SELECT 'booking' AS kind, b.created_at,
                COALESCE(NULLIF(u.full_name, ''), u.email) AS actor,
                v.name AS subject, b.status AS extra
           FROM bookings b JOIN users u ON u.id = b.guest_id
                           JOIN villas v ON v.id = b.villa_id
         UNION ALL
         SELECT 'review', r.created_at,
                COALESCE(NULLIF(u.full_name, ''), u.email), v.name, r.stars::text
           FROM reviews r JOIN users u ON u.id = r.user_id
                          JOIN villas v ON v.id = r.villa_id
         UNION ALL
         SELECT 'call', c.created_at,
                COALESCE(NULLIF(u.full_name, ''), u.email), v.name, c.status
           FROM call_requests c JOIN users u ON u.id = c.guest_id
                                JOIN villas v ON v.id = c.villa_id
         UNION ALL
         SELECT 'signup', u.created_at,
                COALESCE(NULLIF(u.full_name, ''), u.email), '', ''
           FROM users u
       ) feed
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)) as {
    kind: ActivityItem["kind"];
    created_at: string;
    actor: string;
    subject: string;
    extra: string;
  }[];

  return rows.map((r) => ({
    kind: r.kind,
    title:
      r.kind === "booking"
        ? `${r.actor} booked ${r.subject} (${r.extra})`
        : r.kind === "review"
          ? `${r.actor} rated ${r.subject} ${r.extra}★`
          : r.kind === "call"
            ? `${r.actor} asked for a call about ${r.subject}`
            : `${r.actor} joined MyVilla`,
    when: timeAgo(r.created_at),
    href:
      r.kind === "booking"
        ? "/admin/bookings"
        : r.kind === "review"
          ? "/admin/reviews"
          : r.kind === "call"
            ? "/admin/calls"
            : "/admin/users",
  }));
}
