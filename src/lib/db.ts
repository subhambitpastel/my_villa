// Postgres data layer — server-side only. Uses node-postgres (`pg`) with a
// connection pool. A thin async facade keeps the old `getDb().prepare(sql)
// .get/.all/.run(...)` shape, converts SQLite-style `?` placeholders to `$n`,
// and routes queries made inside `tx()` to that transaction's client via
// AsyncLocalStorage. Connection comes from DATABASE_URL.
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { hashPasswordSync } from "./password";
import { allocateCustomerId } from "./customerId";
import { dayFromNow, formatRange } from "./dates";
import { quote } from "./pricing";

const { Pool } = pg;

if (typeof window !== "undefined") {
  throw new Error("src/lib/db.ts must never be imported from client code.");
}

// bigint (COUNT/SUM) → number, numeric (ROUND/AVG) → number, so callers get
// plain numbers instead of strings.
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // int8 / bigint
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // numeric

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  /** Public customer ID, e.g. "subhamdas@a9345ds" — minted at signup and never
   *  changed. Null only on a row read mid-upgrade, before the backfill runs. */
  customer_id: string | null;
  full_name: string;
  gender: string;
  dob: string;
  address: string;
  emergency: string;
  phone_code: string;
  phone_number: string;
  country: string;
  avatar: string;
  pay_methods: string; // JSON string[] — ways guests can pay this host
  pay_account_type: string; // "Credit Card or Debit Card" | "Bank Account" | …
  card_number: string; // host payout card/account, stored as entered (demo only)
  hosting_enabled: number; // 1 = host tools unlocked (auto-set on first listing)
  created_at: string;
};

export type VillaRow = {
  id: number;
  owner_id: number;
  name: string;
  kind: string;
  description: string;
  area: string;
  address: string;
  city: string;
  rooms: number;
  max_guests: number; // max guests the owner allows this villa to sleep
  people_per_room: number; // hotels/resorts: max occupancy of one room (0 = n/a)
  max_booking_days: number; // most distinct nights one guest may book here (default 30; 0 = no limit)
  featured: number; // 1 = paid promotion, shown in the home "Featured villas" row
  facilities: string; // JSON string[]
  services: string; // JSON string[]
  price: number;
  discount: number; // host-set % off the nightly price (0 = none)
  rating: number;
  reviews: number;
  image: string;
  images: string; // JSON string[] — gallery, first entry doubles as cover
  locked_at: string | null; // set = locked (no new bookings, hidden from browse)
  created_at: string;
};

export type PackageRow = {
  id: number;
  owner_id: number;
  villa_id: number;
  name: string;
  description: string;
  type: string; // "curated" | "weekend" | "weekly" | "monthly"
  nights: number; // fixed stay length
  max_guests: number; // occupancy cap ("for up to N guests")
  discount: number; // advertised % off the nightly rate (0 = none)
  price: number; // all-inclusive total for the N-night stay
  inclusions: string; // JSON string[] — included experiences, all mandatory
  locked_at: string | null; // set = locked; also implied by a locked villa
  created_at: string;
};

// A runtime-uploaded image, stored as bytes in the DB and served by
// /api/images/[id]. `bytes` comes back from node-postgres as a Node Buffer.
export type ImageRow = {
  id: string;
  mime: string;
  bytes: Buffer;
  owner_id: number | null;
  created_at: string;
};

export type BookingStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export type BookingRow = {
  id: number;
  villa_id: number;
  guest_id: number;
  dates: string; // display string, derived from check_in/check_out
  check_in: string; // YYYY-MM-DD ('' on legacy rows)
  check_out: string; // YYYY-MM-DD ('' on legacy rows)
  guests: number;
  rooms: number; // rooms this reservation holds (1 for whole-villa stays)
  room_plan: string; // JSON {checkIn, checkOut, rooms}[] when the stay's room
  // count changes mid-way (see rooms.ts); '' for a flat stay, where `rooms`
  // alone describes it. When set, `rooms` is the plan's peak.
  extras: string; // JSON {name, price}[] — paid add-ons chosen at checkout
  package_id: number | null; // soft ref to the booked package (null = nightly stay)
  package: string; // JSON snapshot {name, nights, guests, price, inclusions[]} or ''
  // 1 = the guest still owes for this stay. Only owner-made bookings start this
  // way: a guest booking their own stay pays at checkout, so it is never due.
  payment_due: number;
  // Owner-granted discount on an owner-arranged stay: a % of the total and/or a
  // fixed amount off. Stored so the guest sees at payment exactly what the
  // owner promised on the phone. Zero on guest-made bookings — unless a coupon
  // was applied at checkout, which snapshots its discount into these same
  // columns with the code below, so every receipt recomputes identically.
  disc_pct: number;
  disc_fixed: number;
  // The coupon redeemed at checkout ('' = none). Besides labelling the receipt,
  // a non-empty code switches the discount clamp: a coupon may never take the
  // price to zero — the charge floors at $1.
  coupon_code: string;
  // Value of an earlier PAID stay that was folded into this one when the owner
  // fulfilled a bigger request over the same dates — credited against what the
  // guest owes, since they already paid it once.
  paid_credit: number;
  status: BookingStatus;
  created_at: string;
};

// created_at stays a UTC "YYYY-MM-DD HH:MM:SS" text string (what timeAgo and the
// host-joined parser expect); expires_at stays an ISO string compared against
// new Date().toISOString(). SERIAL ids, REAL money, integer 0/1 flags.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  -- Public customer ID ("subhamdas@a9345ds"). Nullable only so accounts created
  -- before this column can be backfilled on the next start; every row has one
  -- after init. See lib/customerId.ts.
  customer_id   TEXT UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  gender        TEXT NOT NULL DEFAULT '',
  dob           TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  emergency     TEXT NOT NULL DEFAULT '',
  phone_code    TEXT NOT NULL DEFAULT '',
  phone_number  TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  avatar        TEXT NOT NULL DEFAULT '/images/host/avatar.png',
  pay_methods      TEXT NOT NULL DEFAULT '[]',
  pay_account_type TEXT NOT NULL DEFAULT '',
  card_number      TEXT NOT NULL DEFAULT '',
  hosting_enabled INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS villas (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'Villa Living',
  description TEXT NOT NULL DEFAULT '',
  area        TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  rooms       INTEGER NOT NULL DEFAULT 1,
  max_guests  INTEGER NOT NULL DEFAULT 8,
  people_per_room INTEGER NOT NULL DEFAULT 0,
  -- Most distinct nights one guest may book here across all their stays
  -- (hotels/resorts). 0 = no limit. Beyond it the guest asks the host on a call.
  max_booking_days INTEGER NOT NULL DEFAULT 30,
  featured    INTEGER NOT NULL DEFAULT 0,
  facilities  TEXT NOT NULL DEFAULT '[]',
  services    TEXT NOT NULL DEFAULT '[]',
  price       REAL NOT NULL DEFAULT 0,
  discount    INTEGER NOT NULL DEFAULT 0,
  rating      REAL NOT NULL DEFAULT 0,
  reviews     INTEGER NOT NULL DEFAULT 0,
  image       TEXT NOT NULL DEFAULT '/images/host/photo-1.jpg',
  images      TEXT NOT NULL DEFAULT '[]',
  -- When set, the owner has locked this listing: it stops taking new bookings
  -- and drops out of search/browse, while bookings already made still stand.
  -- NULL = live. Nullable rather than a boolean so we keep the "when".
  locked_at TEXT,
  created_at  TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- package_id is a soft reference (packages is created after this table, and a
-- booked package is snapshotted into the package JSON so history survives the
-- package being edited/deleted). package is '' for normal nightly stays.
CREATE TABLE IF NOT EXISTS bookings (
  id         SERIAL PRIMARY KEY,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  guest_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dates      TEXT NOT NULL DEFAULT '',
  check_in   TEXT NOT NULL DEFAULT '',
  check_out  TEXT NOT NULL DEFAULT '',
  guests     INTEGER NOT NULL DEFAULT 1,
  rooms      INTEGER NOT NULL DEFAULT 1,
  room_plan  TEXT NOT NULL DEFAULT '',
  extras     TEXT NOT NULL DEFAULT '[]',
  package_id INTEGER,
  package    TEXT NOT NULL DEFAULT '',
  -- 1 = awaiting the guest's payment (an owner made this booking on their
  -- behalf). Guest-made bookings pay at checkout, so they default to 0 and
  -- every pre-existing row stays settled.
  payment_due INTEGER NOT NULL DEFAULT 0,
  -- Owner-granted discount on an owner-arranged stay (% and/or fixed $), shown
  -- to the guest at payment. Zero on guest-made bookings.
  disc_pct    INTEGER NOT NULL DEFAULT 0,
  disc_fixed  REAL NOT NULL DEFAULT 0,
  -- Value of an earlier paid stay folded into this one on fulfilment — credited
  -- against what the guest owes.
  paid_credit REAL NOT NULL DEFAULT 0,
  -- Coupon redeemed at checkout ('' = none). Its discount is snapshotted into
  -- disc_pct/disc_fixed above; a non-empty code floors the charge at $1.
  coupon_code TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'accepted'
             CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- Owner-created discount coupons, each tied to ONE property. The code is
-- globally unique (case-insensitively) so a guest can quote it without
-- ambiguity. Exactly one of pct/fixed is set: pct is 1–99 (never 0, never a
-- free stay), fixed is > 0 — and at redemption a fixed discount can never take
-- the price below $1.
CREATE TABLE IF NOT EXISTS coupons (
  id         SERIAL PRIMARY KEY,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  pct        INTEGER NOT NULL DEFAULT 0,
  fixed      REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique ON coupons (UPPER(code));

CREATE TABLE IF NOT EXISTS password_resets (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'),
  PRIMARY KEY (user_id, villa_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- Owner-defined stay packages: a named, fixed bundle of included experiences
-- (airport pickup, sightseeing, meals…) offered on one villa at a single price.
-- Unlike optional extra services, a booked package's inclusions can't be
-- unbundled by the guest — it's all-or-nothing.
-- nights is the fixed stay length; max_guests the occupancy cap ("for up to
-- N guests"); price the all-inclusive total for that N-night stay (covers the
-- accommodation + inclusions — no nightly rate or service fee added on top).
CREATE TABLE IF NOT EXISTS packages (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  villa_id    INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'curated',
  nights      INTEGER NOT NULL DEFAULT 1,
  max_guests  INTEGER NOT NULL DEFAULT 1,
  discount    INTEGER NOT NULL DEFAULT 0,
  price       REAL NOT NULL DEFAULT 0,
  inclusions  TEXT NOT NULL DEFAULT '[]',
  -- Same as villas.locked_at, but for a single package. A package is also
  -- unbookable when its villa is locked, whatever this column says.
  locked_at TEXT,
  created_at  TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- A guest asking the host to ring them about a booking the self-serve flow
-- won't take — in practice, a stay longer than MAX_STAY_NIGHTS or one that
-- exceeds the property's per-guest day budget (villas.max_booking_days). The
-- dates and room count they wanted are kept so the host can act on the request
-- without a back-and-forth.
-- Things that HAPPENED, addressed to one person: a stay booked, cancelled or
-- changed, a review left, a call asked for, a payment requested.
--
-- A table rather than something derived from the other tables, because most of
-- these leave no trace in current state — nothing about a booking row says it
-- was edited, and a cancelled one that's later deleted takes its own news with
-- it. Read/unread has to live somewhere too.
--
-- title/body are rendered when the event happens and stored as written (the
-- same reason bookings snapshot their package and extras): the villa can be
-- renamed or removed afterwards and the news still reads true. href is where
-- clicking it goes — decided at write time by the code that knows why it fired.
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  -- Who it's FOR (not who caused it).
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  href       TEXT NOT NULL DEFAULT '',
  read_at    TEXT, -- NULL = unread
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS call_requests (
  id         SERIAL PRIMARY KEY,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  guest_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in   TEXT NOT NULL DEFAULT '',
  check_out  TEXT NOT NULL DEFAULT '',
  rooms      INTEGER NOT NULL DEFAULT 0, -- rooms the guest wanted (0 = unstated)
  guests     INTEGER NOT NULL DEFAULT 0, -- party size they picked (0 = unstated)
  message    TEXT NOT NULL DEFAULT '', -- the guest's own note to the host
  -- Paid add-ons the guest had ticked when they asked, as a {name, price}
  -- snapshot (same shape as bookings.extras). Snapshotted rather than indexed
  -- so it still reads correctly if the host later edits their service list.
  services   TEXT NOT NULL DEFAULT '[]',
  status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done'
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- The back-and-forth between a guest and a host about one call request. The
-- guest's note on the request itself is copied in as the first message when they
-- ask, so a thread is a plain uniform list rather than "a note, then messages".
--
-- Deliberately tied to the request and nothing else: resolving a request wipes
-- its messages (see resolveCallRequestAction), and deleting the request or
-- either party cascades the rest away. There is no archive by design — the chat
-- exists to arrange one booking, and stops mattering once it's arranged.
CREATE TABLE IF NOT EXISTS call_messages (
  id         SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES call_requests(id) ON DELETE CASCADE,
  -- Who wrote it. Always one of the two participants (the request's guest, or
  -- the villa's owner) — enforced in sendCallMessageAction.
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  -- Set when the OTHER party has seen it. NULL = still unread by them.
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_call_messages_request ON call_messages(request_id);

-- User-uploaded images (villa photos, profile avatars) stored as BYTEA blobs
-- rather than files on disk. The host's filesystem is ephemeral (Railway/VM
-- redeploys wipe it), so uploads must live in the database to survive. Each row
-- is served by GET /api/images/[id]; the id (a random hex + extension) is what's
-- stored in villas.image/images and users.avatar. Bundled /images/* assets stay
-- as static files — only runtime uploads land here.
CREATE TABLE IF NOT EXISTS images (
  id          TEXT PRIMARY KEY,
  mime        TEXT NOT NULL,
  bytes       BYTEA NOT NULL,
  owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

-- Additive migrations for databases created before a column existed. Postgres
-- makes ADD COLUMN IF NOT EXISTS a no-op when the column is already present.
ALTER TABLE villas ADD COLUMN IF NOT EXISTS people_per_room INTEGER NOT NULL DEFAULT 0;
ALTER TABLE villas ADD COLUMN IF NOT EXISTS max_booking_days INTEGER NOT NULL DEFAULT 30;
-- Every listing defaults to a 30-night per-guest cap (owners can change or
-- clear it); align the column default on databases created when it was 0.
-- Deliberately no data backfill here: 0 is a valid owner choice ("no limit"),
-- and rewriting it on every boot would clobber that choice.
ALTER TABLE villas ALTER COLUMN max_booking_days SET DEFAULT 30;
ALTER TABLE villas ADD COLUMN IF NOT EXISTS featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE villas ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rooms INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_plan TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_due INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS disc_pct    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS disc_fixed  REAL NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_credit REAL NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extras TEXT NOT NULL DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS nights INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS max_guests INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'curated';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0;
-- This column was called archived_at before the feature was renamed to "Lock".
-- RENAME rather than add: the ADD COLUMN below would happily create an empty
-- locked_at beside the old column, quietly putting every already-delisted
-- listing back on the market. Guarded both ways so it's a no-op on a database
-- that's already been renamed (or was created fresh with locked_at).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'villas' AND column_name = 'archived_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'villas' AND column_name = 'locked_at')
  THEN ALTER TABLE villas RENAME COLUMN archived_at TO locked_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'packages' AND column_name = 'archived_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'packages' AND column_name = 'locked_at')
  THEN ALTER TABLE packages RENAME COLUMN archived_at TO locked_at;
  END IF;
END $$;

-- Nullable with no default, so every existing listing stays live on upgrade.
ALTER TABLE villas   ADD COLUMN IF NOT EXISTS locked_at TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS locked_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_methods      TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_account_type TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_number      TEXT NOT NULL DEFAULT '';
-- Nullable + no default: it can't be generated in DDL, so existing rows are
-- backfilled by backfillCustomerIds() right after this schema runs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_customer_id_key ON users(customer_id);
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS guests  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS services TEXT NOT NULL DEFAULT '[]';

-- Requests made before chat existed still have their note only on the request
-- row; lift it into the thread so every open request opens as a real
-- conversation instead of a blank one.
--
-- Scoped to open requests on purpose. Resolving a request DELETEs its messages,
-- so an unscoped backfill would resurrect a deleted chat on the next boot. An
-- open request always has its first message written at creation, so the
-- NOT EXISTS only ever fires for pre-chat rows.
INSERT INTO call_messages (request_id, sender_id, body, created_at)
SELECT c.id, c.guest_id, c.message, c.created_at
  FROM call_requests c
 WHERE c.message <> ''
   AND c.status = 'open'
   AND NOT EXISTS (SELECT 1 FROM call_messages m WHERE m.request_id = c.id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_villas_owner ON villas(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_villa ON bookings(villa_id);
-- Every read is "this user's, newest first" — and the unread count runs on
-- every page load, so it can't be a scan.
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_villa ON reviews(villa_id);
CREATE INDEX IF NOT EXISTS idx_packages_owner ON packages(owner_id);
CREATE INDEX IF NOT EXISTS idx_packages_villa ON packages(villa_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_villa ON call_requests(villa_id);

-- One coupon, one use per guest — for good. A UNIQUE index over (guest, code)
-- across EVERY booking that carries the coupon, whatever its status: a code is
-- spent the moment it's applied, and cancelling the booking (guest- or
-- owner-side) does not return it. The race-proof backstop to the check in
-- createBookingAction (READ COMMITTED lets two concurrent checkouts both read
-- "unused"; this stops the second INSERT).
--
-- Migrates the older index that excluded cancelled/declined rows: a
-- CREATE ... IF NOT EXISTS can't widen an existing index, so drop the old shape
-- first — but only when that older, status-filtered shape is actually what's
-- there, so steady-state boots don't rebuild the index every time. Wrapped so
-- pre-existing data that already reused a coupon under the old rule can't stop
-- the app from starting: the drop rolls back together with the failed create,
-- leaving the previous index in place; the app-level check still holds.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'bookings_coupon_once' AND indexdef LIKE '%status%'
  ) THEN
    DROP INDEX bookings_coupon_once;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS bookings_coupon_once
    ON bookings (guest_id, UPPER(coupon_code))
    WHERE coupon_code <> '';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Keep each villa's denormalized rating/reviews true to the reviews table.
-- rateStayAction maintains these on new reviews; this corrects any villa that
-- drifted out of sync (e.g. older seed rows that carried placeholder values),
-- touching only rows that are actually wrong so it's a cheap no-op once synced.
UPDATE villas SET reviews = agg.cnt, rating = agg.avg
FROM (
  SELECT v.id,
         COUNT(r.id) AS cnt,
         COALESCE(ROUND(AVG(r.stars)::numeric, 2), 0) AS avg
  FROM villas v LEFT JOIN reviews r ON r.villa_id = v.id
  GROUP BY v.id
) agg
WHERE villas.id = agg.id
  AND (villas.reviews <> agg.cnt OR villas.rating <> agg.avg);
`;

/** Timestamp text (UTC "YYYY-MM-DD HH:MM:SS") offset by a Postgres interval. */
const TS = (offsetParam: string) =>
  `to_char((now() AT TIME ZONE 'UTC') + (${offsetParam})::interval, 'YYYY-MM-DD HH24:MI:SS')`;

async function seed(pool: pg.Pool, force: boolean) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  const hasData = (rows[0] as { n: number }).n > 0;
  // "if-empty" mode leaves an already-populated database untouched. "force" mode
  // wipes every data table first (identity sequences reset too) so a reseed
  // always yields exactly the demo dataset instead of piling on duplicates.
  if (hasData && !force) return;
  if (force) {
    await pool.query(
      `TRUNCATE users, villas, sessions, bookings, password_resets,
                favorites, reviews, packages RESTART IDENTITY CASCADE`,
    );
  }

  const demoHash = hashPasswordSync("myvilla123");
  const insUser = (
    email: string,
    name: string,
    gender: string,
    dob: string,
    address: string,
    country: string,
    avatar: string,
  ) =>
    pool
      .query(
        `INSERT INTO users (email, password_hash, full_name, gender, dob, address, country, avatar)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [email, demoHash, name, gender, dob, address, country, avatar],
      )
      .then((r) => (r.rows[0] as { id: number }).id);

  const tatiana = await insUser(
    "tatiana@myvilla.com",
    "Tatiana David",
    "Female",
    "January 16, 1991",
    "The Bund, Shanghai",
    "China",
    "/images/host/avatar.png",
  );

  // Tatiana is the demo host — fill the fields the wizard collects but the basic
  // insert leaves blank: contact/emergency details, the host-tools unlock, and
  // the payout card guests' payments land in.
  await pool.query(
    `UPDATE users SET
       emergency = $2, phone_code = $3, phone_number = $4, hosting_enabled = 1,
       pay_methods = $5, pay_account_type = $6, card_number = $7
     WHERE id = $1`,
    [
      tatiana,
      "+86 138 0013 8000",
      "+86",
      "138 0013 8000",
      JSON.stringify(["Mastercard", "VISA", "PayPal"]),
      "Credit Card or Debit Card",
      "4242 4242 4242 4242",
    ],
  );

  const tenants: number[] = [];
  for (const [email, name, avatar] of [
    ["alena@myvilla.com", "Alena James", "/images/profile/tenant-1.jpg"],
    ["rachiel@myvilla.com", "Rachiel Simen", "/images/profile/tenant-2.jpg"],
    ["micheal@myvilla.com", "Micheal Han", "/images/profile/tenant-3.jpg"],
    ["alex@myvilla.com", "Alex Whitmen", "/images/profile/tenant-4.jpg"],
  ]) {
    tenants.push(await insUser(email, name, "", "", "", "", avatar));
  }

  const FACILITIES = JSON.stringify(["Wifi", "Free Parking"]);
  // Priced extras every listing offers, stored as the `{name, price}[]` shape the
  // villa detail page reads (see parseServiceList in queries.ts).
  const SERVICE_MENU = [
    { name: "Airport Pickup", price: 25 },
    { name: "Daily Housekeeping", price: 15 },
    { name: "Private Chef", price: 60 },
  ];
  // Realistic size/capacity per villa kind so listings don't all read as a
  // default 1-bed / 1-bath / 8-guest place with a blank description.
  // perRoom = max occupancy of one room; only hotels/resorts sell by the room,
  // so other kinds keep 0 (they book as one whole unit).
  const DIMS: Record<
    string,
    { area: string; rooms: number; maxGuests: number; perRoom: number }
  > = {
    Resort: { area: "1450", rooms: 6, maxGuests: 14, perRoom: 3 },
    Hotel: { area: "820", rooms: 4, maxGuests: 8, perRoom: 2 },
    Bungalow: { area: "560", rooms: 2, maxGuests: 4, perRoom: 0 },
    "Villa Living": { area: "980", rooms: 4, maxGuests: 8, perRoom: 0 },
  };
  const KIND_NOUN: Record<string, string> = {
    "Villa Living": "villa",
    Resort: "resort",
    Hotel: "hotel",
    Bungalow: "bungalow",
  };
  const dimsFor = (name: string, kind: string, city: string) => {
    const d = DIMS[kind] ?? DIMS["Villa Living"];
    const noun = KIND_NOUN[kind] ?? "villa";
    return {
      ...d,
      description: `${name} is a ${d.rooms}-bedroom ${noun} in ${city}, sleeping up to ${d.maxGuests} guests across ${d.area} sq yd of living space. Sunlit rooms, a full kitchen and an easy walk to the best of ${city} make it a simple place to settle in.`,
      services: SERVICE_MENU,
    };
  };

  const insVilla = (
    owner: number,
    name: string,
    kind: string,
    city: string,
    address: string,
    price: number,
    rating: number,
    reviews: number,
    image: string,
    createdOffset: string,
  ) => {
    const d = dimsFor(name, kind, city);
    return pool
      .query(
        `INSERT INTO villas
           (owner_id, name, kind, description, area, city, address, rooms,
            max_guests, people_per_room, facilities, services, price, rating, reviews, image, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, ${TS("$17")}) RETURNING id`,
        [
          owner, name, kind, d.description, d.area, city, address, d.rooms,
          d.maxGuests, d.perRoom, FACILITIES, JSON.stringify(d.services), price, rating,
          reviews, image, createdOffset,
        ],
      )
      .then((r) => (r.rows[0] as { id: number }).id);
  };

  const bund = await insVilla(tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai", 137, 0, 0, "/images/profile/prop-1.jpg", "-21 days");
  await insVilla(tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai", 137, 0, 0, "/images/profile/prop-2.jpg", "-2 months");
  const hunza = await insVilla(tatiana, "Hunza Luxus", "Resort", "Pakistan", "Hunza Valley, Pakistan", 105, 0, 0, "/images/profile/prop-3.jpg", "-4 months");

  const catalog: Array<[string, string, string, number, string]> = [
    ["The Bund", "Resort", "Shanghai", 137, "/images/card-bund-1.png"],
    ["The Bund", "Hotel", "Shanghai", 137, "/images/card-bund-2.png"],
    ["The Bund", "Villa Living", "Shanghai", 137, "/images/card-bund-3.png"],
    ["The Bund", "Resort", "Shanghai", 137, "/images/card-bund-4.png"],
    ["The Shan Luxus", "Hotel", "Shanghai", 126, "/images/search-2.jpg"],
    ["Villa de Naoul", "Villa Living", "Belfast", 97, "/images/search-4.jpg"],
    ["La casa Ville", "Villa Living", "New York", 133, "/images/search-5.jpg"],
    ["Iris Villa", "Villa Living", "Shanghai", 119, "/images/villa-1.jpg"],
  ];
  let shan = 0;
  for (const [name, kind, city, price, image] of catalog) {
    const id = await insVilla(tatiana, name, kind, city, `${name}, ${city}`, price, 0, 0, image, "-5 months");
    if (name === "The Shan Luxus") shan = id;
  }

  // A few featured (paid-promotion) listings so the home "Featured villas" row
  // isn't empty in the demo — a resort, a villa and a hotel.
  await pool.query("UPDATE villas SET featured = 1 WHERE id = ANY($1)", [
    [hunza, bund, shan],
  ]);

  const insBooking = (
    villaId: number,
    guestId: number,
    dates: string,
    checkIn: string,
    checkOut: string,
    guests: number,
    status: string,
    createdOffset: string,
  ) =>
    pool
      .query(
        `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, ${TS("$8")}) RETURNING id`,
        [villaId, guestId, dates, checkIn, checkOut, guests, status, createdOffset],
      )
      .then((r) => (r.rows[0] as { id: number }).id);

  const book = (
    villaId: number,
    tenantIdx: number,
    inOffset: number,
    outOffset: number,
    guests: number,
    status: string,
    createdOffset: string,
  ) => {
    const checkIn = dayFromNow(inOffset);
    const checkOut = dayFromNow(outOffset);
    return insBooking(villaId, tenants[tenantIdx], formatRange(checkIn, checkOut), checkIn, checkOut, guests, status, createdOffset);
  };

  await book(bund, 0, 20, 23, 3, "accepted", "-3 days");
  await book(bund, 1, 33, 36, 4, "accepted", "-2 days");
  await book(hunza, 2, 14, 21, 1, "accepted", "-5 days");
  await book(hunza, 3, 45, 47, 5, "accepted", "-1 days");
  await book(bund, 0, -48, -45, 3, "completed", "-2 months");
  await book(hunza, 1, -80, -76, 4, "completed", "-3 months");

  const seedReviews: Array<[number, number, number, number, number, string, number, string]> = [
    [bund, 0, -60, -57, 3, "-2 months", 5, "Absolutely stunning views over the Bund. Spotless throughout, and the host left a welcome basket. Would book again in a heartbeat."],
    [bund, 1, -95, -91, 2, "-3 months", 4, "Great location right by the water. Warm, comfortable apartment and a smooth check-in."],
    [hunza, 1, -120, -116, 4, "-4 months", 5, "Waking up to the Hunza valley was unreal. Peaceful, clean, and the kitchen had everything we needed."],
    [hunza, 2, -150, -143, 1, "-5 months", 4, "A proper mountain retreat. A bit of a drive to get there, but worth every minute for the scenery."],
    [shan, 0, -62, -58, 2, "-2 months", 5, "The Shan Luxus lived up to its name — modern, quiet and beautifully finished. Highly recommend."],
    [shan, 3, -35, -32, 3, "-1 months", 4, "Comfortable stay, responsive host, and a lovely neighbourhood to explore in the evenings."],
  ];
  for (const [villaId, tIdx, inOff, outOff, guests, age, stars, comment] of seedReviews) {
    const bookingId = await book(villaId, tIdx, inOff, outOff, guests, "completed", age);
    await pool.query(
      `INSERT INTO reviews (booking_id, villa_id, user_id, stars, comment, created_at)
       VALUES ($1,$2,$3,$4,$5, ${TS("$6")})`,
      [bookingId, villaId, tenants[tIdx], stars, comment, age],
    );
  }

  // Seed villas are inserted without a gallery — give each its cover plus stock
  // interior shots (matches the old SQLite backfill).
  await pool.query(
    `UPDATE villas
       SET images = json_build_array(image, '/images/interior-living.jpg', '/images/interior-kitchen.jpg', '/images/bedroom.jpg', '/images/interior-bath.jpg')::text
     WHERE images = '[]'`,
  );

  // Derive reviewed villas' aggregates from their real reviews.
  await pool.query(
    `UPDATE villas SET
       reviews = (SELECT COUNT(*) FROM reviews WHERE villa_id = villas.id),
       rating  = COALESCE((SELECT ROUND(AVG(stars)::numeric, 2) FROM reviews WHERE villa_id = villas.id), 0)
     WHERE id IN (SELECT DISTINCT villa_id FROM reviews)`,
  );

  // Demo stay packages — fixed nights + occupancy, one all-inclusive price.
  // At least one of every type (Curated + the Weekend/Weekly/Monthly presets)
  // across all three villa kinds: Bund = whole villa, Hunza = resort and Shan =
  // hotel (both room-based).
  const insPackage = (
    villaId: number,
    name: string,
    description: string,
    type: string,
    nights: number,
    maxGuests: number,
    discount: number,
    price: number,
    inclusions: string[],
  ) =>
    pool.query(
      `INSERT INTO packages (owner_id, villa_id, name, description, type, nights, max_guests, discount, price, inclusions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tatiana, villaId, name, description, type, nights, maxGuests, discount, price, JSON.stringify(inclusions)],
    );
  // Price a preset like a real booking of that length (long-stay discount baked
  // in by quote), sold all-inclusive; `rooms` is what the occupancy reserves on
  // a room-based villa (1 for a whole-villa stay).
  const presetPrice = (nightly: number, rooms: number, nights: number) =>
    Math.round(quote(nightly * rooms, nights).total * 100) / 100;

  // Curated — custom nights/price, no advertised discount. One per villa kind.
  await insPackage(bund, "Shanghai City Break", "Three nights on the Bund with the sights sorted for you.", "curated", 3, 6, 0, 780, ["Airport pickup & drop", "Guided city tour", "Welcome dinner"]);
  await insPackage(hunza, "Hunza Valley Explorer", "Five mountain nights with transfers and daily sightseeing.", "curated", 5, 6, 0, 1200, ["Airport transfers", "Valley sightseeing tour", "Campfire dinner", "Daily breakfast"]);
  if (shan) await insPackage(shan, "Shan Luxus Weekend", "A quick two-night city escape with a spa session included.", "curated", 2, 4, 0, 520, ["Airport pickup", "Spa session for two", "Daily breakfast"]);

  // Presets — Weekend (3n), Weekly (7n, 15% off), Monthly (28n, 30% off). Shan
  // for 4 guests and Hunza for 6 guests each reserve 2 rooms; the Bund is whole.
  if (shan) await insPackage(shan, "Shan Weekend Getaway", "A three-night hotel escape with the essentials handled.", "weekend", 3, 4, 0, presetPrice(126, 2, 3), ["Airport pickup", "Daily breakfast", "Late checkout"]);
  await insPackage(hunza, "Hunza Weekly Escape", "A full week in the valley at a long-stay rate.", "weekly", 7, 6, 15, presetPrice(105, 2, 7), ["Airport transfers", "Guided day hikes", "Daily breakfast", "Campfire dinner"]);
  await insPackage(bund, "Bund Monthly Retreat", "Live on the Bund for a month — the long-stay rate, all-inclusive.", "monthly", 28, 6, 30, presetPrice(137, 1, 28), ["Airport pickup & drop", "Weekly housekeeping", "City transit pass", "Welcome dinner"]);
}

/**
 * Demo data seeding (Tatiana + tenants, demo villas/bookings, all with password
 * "myvilla123") is controlled by SEED_DEMO, evaluated once per server start:
 *   • "1"   → force: remove ALL existing data, then reseed. Every boot resets
 *             the database to exactly the demo dataset.
 *   • "2"   → if-empty: seed only when the database is empty; never remove data.
 *   • "0"   → off: never seed.
 *   • unset → dev seeds if-empty so the local app is populated; production is OFF
 *             so the fake credentials never ship to a live database.
 */
type SeedMode = "force" | "if-empty" | "off";
function seedMode(): SeedMode {
  const v = process.env.SEED_DEMO;
  if (v === "1") return "force";
  if (v === "2") return "if-empty";
  if (v === "0") return "off";
  return process.env.NODE_ENV !== "production" ? "if-empty" : "off";
}

function connectionConfig(): pg.PoolConfig {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://myvilla:myvilla@localhost:5432/myvilla";
  // Cloud SQL over public IP wants SSL; the Auth Proxy / local Postgres don't.
  const ssl =
    process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined;
  return { connectionString, ssl, max: 10 };
}

/** Give a customer ID to any account that predates the column. Generated here in
 *  TS (not DDL) so signup and this backfill mint IDs through the same function —
 *  one source of truth for the format. A no-op once every row has one. */
async function backfillCustomerIds(pool: pg.Pool) {
  const missing = await pool.query<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE customer_id IS NULL OR customer_id = '' ORDER BY id",
  );
  if (missing.rowCount === 0) return;
  const existing = await pool.query<{ customer_id: string }>(
    "SELECT customer_id FROM users WHERE customer_id IS NOT NULL",
  );
  const taken = new Set(existing.rows.map((r) => r.customer_id));
  for (const row of missing.rows) {
    const id = allocateCustomerId(row.email, taken);
    taken.add(id); // reserve within this batch too, not just against the DB
    await pool.query("UPDATE users SET customer_id = $1 WHERE id = $2", [id, row.id]);
  }
}

async function init(): Promise<pg.Pool> {
  const pool = new Pool(connectionConfig());
  await pool.query(SCHEMA);
  const mode = seedMode();
  if (mode !== "off") await seed(pool, mode === "force");
  // After seeding: a wipe-and-reseed inserts fresh users that need IDs too.
  await backfillCustomerIds(pool);
  // Sweep expired sessions / reset tokens so those tables don't grow forever.
  try {
    const now = new Date().toISOString();
    await pool.query("DELETE FROM sessions WHERE expires_at < $1", [now]);
    await pool.query("DELETE FROM password_resets WHERE expires_at < $1", [now]);
  } catch {
    /* non-fatal housekeeping */
  }
  return pool;
}

// One pool + one init across hot reloads (module state resets on HMR).
const globalForDb = globalThis as unknown as { __myvillaPool?: Promise<pg.Pool> };

function getReady(): Promise<pg.Pool> {
  if (!globalForDb.__myvillaPool) globalForDb.__myvillaPool = init();
  return globalForDb.__myvillaPool;
}

// Queries made inside tx() run on that transaction's client (set here) instead
// of a fresh pooled connection, so a check-then-write stays atomic.
const txStore = new AsyncLocalStorage<pg.PoolClient>();

/** SQLite-style `?` placeholders → Postgres `$1, $2, …`. */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(
  sql: string,
  params: unknown[],
): Promise<pg.QueryResult> {
  const runner = txStore.getStore() ?? (await getReady());
  return runner.query(sql, params);
}

type Stmt = {
  get: <T = unknown>(...params: unknown[]) => Promise<T | undefined>;
  all: <T = unknown>(...params: unknown[]) => Promise<T[]>;
  run: (
    ...params: unknown[]
  ) => Promise<{ changes: number; lastInsertRowid?: number }>;
};

type Db = {
  prepare: (sql: string) => Stmt;
  exec: (sql: string) => Promise<void>;
};

/**
 * Async facade over the pool that mirrors the old sqlite API: `getDb()
 * .prepare(sql).get/all/run(...params)`. Placeholders are `?` (converted to
 * `$n`); INSERTs that need the new id must add `RETURNING id` and read
 * `.run().lastInsertRowid`.
 */
export function getDb(): Db {
  return {
    prepare(sql: string): Stmt {
      const text = toPg(sql);
      return {
        async get<T>(...params: unknown[]) {
          const r = await run(text, params);
          return r.rows[0] as T | undefined;
        },
        async all<T>(...params: unknown[]) {
          const r = await run(text, params);
          return r.rows as T[];
        },
        async run(...params: unknown[]) {
          const r = await run(text, params);
          return {
            changes: r.rowCount ?? 0,
            lastInsertRowid: (r.rows[0] as { id?: number } | undefined)?.id,
          };
        },
      };
    },
    async exec(sql: string) {
      await run(toPg(sql), []);
    },
  };
}

/**
 * Run `fn` inside a transaction — everything commits together or rolls back on
 * throw. All queries made inside `fn` (via getDb()) run on the transaction's
 * client through AsyncLocalStorage, so a check-then-write can't interleave with
 * another writer.
 */
export async function tx<T>(fn: () => Promise<T> | T): Promise<T> {
  const pool = await getReady();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await txStore.run(client, async () => fn());
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* already aborted */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** "Posted 3 weeks ago" style label from a UTC "YYYY-MM-DD HH:MM:SS" timestamp. */
export function timeAgo(sqliteUtc: string, prefix = ""): string {
  const then = new Date(sqliteUtc.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  let label: string;
  if (mins < 2) label = "just now";
  else if (mins < 60) label = `${mins} minutes ago`;
  else if (mins < 48 * 60) label = `${Math.round(mins / 60)} hours ago`;
  else if (mins < 14 * 24 * 60) label = `${Math.round(mins / (24 * 60))} days ago`;
  else if (mins < 60 * 24 * 60) label = `${Math.round(mins / (7 * 24 * 60))} weeks ago`;
  else label = `${Math.round(mins / (30 * 24 * 60))} months ago`;
  return prefix ? `${prefix} ${label}` : label;
}
