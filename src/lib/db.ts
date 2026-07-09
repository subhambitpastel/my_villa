// Postgres data layer — server-side only. Uses node-postgres (`pg`) with a
// connection pool. A thin async facade keeps the old `getDb().prepare(sql)
// .get/.all/.run(...)` shape, converts SQLite-style `?` placeholders to `$n`,
// and routes queries made inside `tx()` to that transaction's client via
// AsyncLocalStorage. Connection comes from DATABASE_URL.
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { hashPasswordSync } from "./password";
import { dayFromNow, formatRange } from "./dates";

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
  full_name: string;
  gender: string;
  dob: string;
  address: string;
  emergency: string;
  phone_code: string;
  phone_number: string;
  country: string;
  avatar: string;
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
  bathrooms: number;
  max_guests: number; // max guests the owner allows this villa to sleep
  facilities: string; // JSON string[]
  services: string; // JSON string[]
  price: number;
  rating: number;
  reviews: number;
  image: string;
  images: string; // JSON string[] — gallery, first entry doubles as cover
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
  full_name     TEXT NOT NULL DEFAULT '',
  gender        TEXT NOT NULL DEFAULT '',
  dob           TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  emergency     TEXT NOT NULL DEFAULT '',
  phone_code    TEXT NOT NULL DEFAULT '',
  phone_number  TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  avatar        TEXT NOT NULL DEFAULT '/images/host/avatar.png',
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
  bathrooms   INTEGER NOT NULL DEFAULT 1,
  max_guests  INTEGER NOT NULL DEFAULT 8,
  facilities  TEXT NOT NULL DEFAULT '[]',
  services    TEXT NOT NULL DEFAULT '[]',
  price       REAL NOT NULL DEFAULT 0,
  rating      REAL NOT NULL DEFAULT 0,
  reviews     INTEGER NOT NULL DEFAULT 0,
  image       TEXT NOT NULL DEFAULT '/images/host/photo-1.jpg',
  images      TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS bookings (
  id         SERIAL PRIMARY KEY,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  guest_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dates      TEXT NOT NULL DEFAULT '',
  check_in   TEXT NOT NULL DEFAULT '',
  check_out  TEXT NOT NULL DEFAULT '',
  guests     INTEGER NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'accepted'
             CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  created_at TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')
);

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

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_villas_owner ON villas(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_villa ON bookings(villa_id);
CREATE INDEX IF NOT EXISTS idx_reviews_villa ON reviews(villa_id);
`;

/** Timestamp text (UTC "YYYY-MM-DD HH:MM:SS") offset by a Postgres interval. */
const TS = (offsetParam: string) =>
  `to_char((now() AT TIME ZONE 'UTC') + (${offsetParam})::interval, 'YYYY-MM-DD HH24:MI:SS')`;

async function seed(pool: pg.Pool) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if ((rows[0] as { n: number }).n > 0) return;

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
  ) =>
    pool
      .query(
        `INSERT INTO villas (owner_id, name, kind, city, address, price, rating, reviews, image, facilities, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ${TS("$11")}) RETURNING id`,
        [owner, name, kind, city, address, price, rating, reviews, image, FACILITIES, createdOffset],
      )
      .then((r) => (r.rows[0] as { id: number }).id);

  const bund = await insVilla(tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai", 137, 4.69, 32, "/images/profile/prop-1.jpg", "-21 days");
  await insVilla(tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai", 137, 4.69, 32, "/images/profile/prop-2.jpg", "-2 months");
  const hunza = await insVilla(tatiana, "Hunza Luxus", "Resort", "Pakistan", "Hunza Valley, Pakistan", 105, 4.69, 32, "/images/profile/prop-3.jpg", "-4 months");

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
    const id = await insVilla(tatiana, name, kind, city, `${name}, ${city}`, price, 4.69, 32, image, "-5 months");
    if (name === "The Shan Luxus") shan = id;
  }

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
}

/**
 * Demo data is seeded on by default in development so the local app is
 * populated (Tatiana + tenants, demo villas/bookings, all with password
 * "myvilla123"). In production it's OFF unless explicitly opted in with
 * SEED_DEMO=1, so those fake credentials never ship to a live database.
 */
function shouldSeedDemo(): boolean {
  if (process.env.SEED_DEMO === "1") return true;
  if (process.env.SEED_DEMO === "0") return false;
  return process.env.NODE_ENV !== "production";
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

async function init(): Promise<pg.Pool> {
  const pool = new Pool(connectionConfig());
  await pool.query(SCHEMA);
  if (shouldSeedDemo()) await seed(pool);
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
