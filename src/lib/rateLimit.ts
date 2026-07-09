// Simple in-memory sliding-window rate limiter. Server-side only.
//
// NOTE: state lives in this process, so it resets on restart and is NOT shared
// across instances — it's a meaningful baseline for a single instance but a
// multi-instance deploy needs a shared store (e.g. Redis). Good enough to blunt
// brute-force / spam on auth endpoints today.
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

// Survive dev HMR (module state resets on hot reload).
const globalForRl = globalThis as unknown as {
  __myvillaRl?: Map<string, Bucket>;
};
const buckets = (globalForRl.__myvillaRl ??= new Map<string, Bucket>());

/** Returns true if the action is allowed; false if the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

/** Best-effort client IP from proxy headers (falls back to a shared bucket). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
