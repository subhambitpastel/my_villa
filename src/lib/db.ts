// SQLite data layer — server-side only. Uses Node's built-in sqlite module,
// so there are no native dependencies to install.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { hashPasswordSync } from "./password";
import { dayFromNow, formatRange } from "./dates";

if (typeof window !== "undefined") {
  throw new Error("src/lib/db.ts must never be imported from client code.");
}

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

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "myvilla.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
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
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS villas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  guest_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dates      TEXT NOT NULL DEFAULT '',
  check_in   TEXT NOT NULL DEFAULT '',
  check_out  TEXT NOT NULL DEFAULT '',
  guests     INTEGER NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'accepted'
             CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, villa_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  villa_id   INTEGER NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_villas_owner ON villas(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_villa ON bookings(villa_id);
CREATE INDEX IF NOT EXISTS idx_reviews_villa ON reviews(villa_id);
`;

function seed(db: DatabaseSync) {
  const hasUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get() as {
    n: number;
  };
  if (hasUsers.n > 0) return;

  const demoHash = hashPasswordSync("myvilla123");
  const insertUser = db.prepare(
    `INSERT INTO users (email, password_hash, full_name, gender, dob, address, country, avatar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tatiana = insertUser.run(
    "tatiana@myvilla.com",
    demoHash,
    "Tatiana David",
    "Female",
    "January 16, 1991",
    "The Bund, Shanghai",
    "China",
    "/images/host/avatar.png",
  ).lastInsertRowid as number;

  const tenants = [
    ["alena@myvilla.com", "Alena James", "/images/profile/tenant-1.jpg"],
    ["rachiel@myvilla.com", "Rachiel Simen", "/images/profile/tenant-2.jpg"],
    ["micheal@myvilla.com", "Micheal Han", "/images/profile/tenant-3.jpg"],
    ["alex@myvilla.com", "Alex Whitmen", "/images/profile/tenant-4.jpg"],
  ].map(
    ([email, name, avatar]) =>
      insertUser.run(email, demoHash, name, "", "", "", "", avatar)
        .lastInsertRowid as number,
  );

  const insertVilla = db.prepare(
    `INSERT INTO villas (owner_id, name, kind, city, address, price, rating, reviews, image, facilities, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
  );
  const FACILITIES = JSON.stringify(["Wifi", "Free Parking"]);

  // Tatiana's own listings (shown under Profile > My Properties).
  const bund = insertVilla.run(
    tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai",
    137, 4.69, 32, "/images/profile/prop-1.jpg", FACILITIES, "-21 days",
  ).lastInsertRowid as number;
  insertVilla.run(
    tatiana, "The Bund", "Villa Living", "Shanghai", "The Bund, Shanghai",
    137, 4.69, 32, "/images/profile/prop-2.jpg", FACILITIES, "-2 months",
  );
  const hunza = insertVilla.run(
    tatiana, "Hunza Luxus", "Resort", "Pakistan", "Hunza Valley, Pakistan",
    105, 4.69, 32, "/images/profile/prop-3.jpg", FACILITIES, "-4 months",
  ).lastInsertRowid as number;

  // Browsing catalog (home page cards + search results). Kinds are spread so
  // the hero's Resort / Hotels / Rent tabs each return results.
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
    const id = insertVilla.run(
      tatiana, name, kind, city, `${name}, ${city}`,
      price, 4.69, 32, image, FACILITIES, "-5 months",
    ).lastInsertRowid as number;
    if (name === "The Shan Luxus") shan = id;
  }

  // Bookings on Tatiana's villas → they appear as her rent requests, and as
  // the tenants' bookings. Paid at checkout, so active stays are confirmed.
  // Every booking carries real check_in/check_out dates (not just a text
  // label) so it participates in availability: an active stay genuinely blocks
  // those days on the villa's calendar, and the display label is derived from
  // the same dates so lists and the calendar can never disagree.
  const insertBooking = db.prepare(
    `INSERT INTO bookings (villa_id, guest_id, dates, check_in, check_out, guests, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
  );
  function book(
    villaId: number,
    tenantIdx: number,
    inOffset: number,
    outOffset: number,
    guests: number,
    status: string,
    createdOffset: string,
  ): number {
    const checkIn = dayFromNow(inOffset);
    const checkOut = dayFromNow(outOffset);
    return insertBooking.run(
      villaId,
      tenants[tenantIdx],
      formatRange(checkIn, checkOut),
      checkIn,
      checkOut,
      guests,
      status,
      createdOffset,
    ).lastInsertRowid as number;
  }

  // Active confirmed stays sit in the near future so they really do block those
  // dates on the villa's calendar (this is what demonstrates availability);
  // completed stays are safely in the past and never block.
  book(bund, 0, 20, 23, 3, "accepted", "-3 days");
  book(bund, 1, 33, 36, 4, "accepted", "-2 days");
  book(hunza, 2, 14, 21, 1, "accepted", "-5 days");
  book(hunza, 3, 45, 47, 5, "accepted", "-1 days");
  book(bund, 0, -48, -45, 3, "completed", "-2 months");
  book(hunza, 1, -80, -76, 4, "completed", "-3 months");

  // Real written reviews — each is a completed stay so the villa pages render
  // genuine review cards (and the aggregates below are derived from them, not
  // fabricated). villaId, tenantIdx, inOffset, outOffset, guests, ageOffset, stars, comment.
  const seedReviews: Array<[number, number, number, number, number, string, number, string]> = [
    [bund, 0, -60, -57, 3, "-2 months", 5, "Absolutely stunning views over the Bund. Spotless throughout, and the host left a welcome basket. Would book again in a heartbeat."],
    [bund, 1, -95, -91, 2, "-3 months", 4, "Great location right by the water. Warm, comfortable apartment and a smooth check-in."],
    [hunza, 1, -120, -116, 4, "-4 months", 5, "Waking up to the Hunza valley was unreal. Peaceful, clean, and the kitchen had everything we needed."],
    [hunza, 2, -150, -143, 1, "-5 months", 4, "A proper mountain retreat. A bit of a drive to get there, but worth every minute for the scenery."],
    [shan, 0, -62, -58, 2, "-2 months", 5, "The Shan Luxus lived up to its name — modern, quiet and beautifully finished. Highly recommend."],
    [shan, 3, -35, -32, 3, "-1 months", 4, "Comfortable stay, responsive host, and a lovely neighbourhood to explore in the evenings."],
  ];
  const insertReview = db.prepare(
    `INSERT INTO reviews (booking_id, villa_id, user_id, stars, comment, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
  );
  for (const [villaId, tIdx, inOff, outOff, guests, age, stars, comment] of seedReviews) {
    const bookingId = book(villaId, tIdx, inOff, outOff, guests, "completed", age);
    insertReview.run(bookingId, villaId, tenants[tIdx], stars, comment, age);
  }
  // Derive the reviewed villas' aggregates from their real reviews so the
  // displayed rating/count matches the cards shown.
  db.exec(
    `UPDATE villas SET
       reviews = (SELECT COUNT(*) FROM reviews WHERE villa_id = villas.id),
       rating  = COALESCE((SELECT ROUND(AVG(stars), 2) FROM reviews WHERE villa_id = villas.id), 0)
     WHERE id IN (SELECT DISTINCT villa_id FROM reviews)`,
  );
}

/** Add columns introduced after the first release to databases created before them. */
function migrate(db: DatabaseSync) {
  const cols = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name,
    );

  // try/catch: concurrent processes (e.g. parallel build workers) may race on
  // the same ALTER; "duplicate column name" from the loser is harmless.
  const addColumn = (table: string, column: string, ddl: string) => {
    if (cols(table).includes(column)) return;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {
      /* another process added it first */
    }
  };
  addColumn("villas", "images", "images TEXT NOT NULL DEFAULT '[]'");
  addColumn("villas", "max_guests", "max_guests INTEGER NOT NULL DEFAULT 8");
  addColumn("bookings", "check_in", "check_in TEXT NOT NULL DEFAULT ''");
  addColumn("bookings", "check_out", "check_out TEXT NOT NULL DEFAULT ''");
  addColumn(
    "users",
    "hosting_enabled",
    "hosting_enabled INTEGER NOT NULL DEFAULT 0",
  );
  addColumn("reviews", "comment", "comment TEXT NOT NULL DEFAULT ''");
  // Existing hosts keep their tools unlocked.
  db.exec(
    "UPDATE users SET hosting_enabled = 1 WHERE hosting_enabled = 0 AND id IN (SELECT DISTINCT owner_id FROM villas)",
  );

  // Bookings are paid at checkout and confirm instantly — the owner no longer
  // accepts/declines. Requests still waiting on the old flow count as paid,
  // so confirm them rather than leaving them stuck forever.
  db.exec("UPDATE bookings SET status = 'accepted' WHERE status = 'pending'");

  // Villas without a gallery get their cover plus stock interior shots.
  const bare = db
    .prepare("SELECT id, image FROM villas WHERE images = '[]'")
    .all() as { id: number; image: string }[];
  if (bare.length > 0) {
    const fill = db.prepare("UPDATE villas SET images = ? WHERE id = ?");
    for (const v of bare) {
      fill.run(
        JSON.stringify([
          v.image,
          "/images/interior-living.jpg",
          "/images/interior-kitchen.jpg",
          "/images/bedroom.jpg",
          "/images/interior-bath.jpg",
        ]),
        v.id,
      );
    }
  }
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

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  if (shouldSeedDemo()) seed(db);
  // Sweep expired sessions/reset tokens so those tables don't grow forever
  // (they were previously only filtered out at read time).
  try {
    db.exec(
      "DELETE FROM sessions WHERE expires_at < datetime('now');" +
        "DELETE FROM password_resets WHERE expires_at < datetime('now');",
    );
  } catch {
    /* non-fatal housekeeping */
  }
  // Fold the WAL back into the main file so data survives hard process kills.
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* another connection holds the WAL — checkpoint later */
  }
  return db;
}

// Reuse one connection across hot reloads in dev (module state resets on HMR).
const globalForDb = globalThis as unknown as { __myvillaDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__myvillaDb) {
    globalForDb.__myvillaDb = open();
  }
  return globalForDb.__myvillaDb;
}

/**
 * Run `fn` inside an IMMEDIATE write transaction — everything commits together
 * or rolls back on throw. IMMEDIATE takes the write lock up front so a
 * check-then-insert (e.g. availability → booking) can't interleave with
 * another writer. Safe to call with a single shared connection.
 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* transaction already aborted by SQLite */
    }
    throw e;
  }
}

/** "Posted 3 weeks ago" style label from a sqlite datetime('now') timestamp. */
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
