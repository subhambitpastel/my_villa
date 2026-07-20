// DB-backed sessions stored in an httpOnly cookie. Server-side only.
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getDb, type UserRow } from "./db";
import { nowIso, nowMs } from "./clock";

const COOKIE_NAME = "myvilla_session";
const SESSION_DAYS = 30;

export type SessionUser = Omit<UserRow, "password_hash">;

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(nowMs() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expires.toISOString());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // disabled_at IS NULL: an account an admin disabled loses its live sessions
  // instantly — the row simply stops resolving, whatever cookie is presented.
  const row = (await getDb()
    .prepare(
      `SELECT u.id, u.email, u.customer_id, u.full_name, u.gender, u.dob, u.address,
              u.emergency, u.phone_code, u.phone_number, u.country, u.avatar,
              u.pay_methods, u.pay_account_type, u.card_number, u.hosting_enabled,
              u.is_admin, u.disabled_at, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.disabled_at IS NULL`,
    )
    .get(token, nowIso())) as SessionUser | undefined;

  return row ?? null;
}
