// Review moderation rules, shared by the guest actions, the admin actions and
// the read queries. A plain module (not "use server"): the guest and admin
// action files both need these, and an export from a server-action file would
// become a publicly callable endpoint.

import { getDb } from "./db";
import { nowMs, nowStamp } from "./clock";

export type ReviewStatus = "pending" | "approved" | "rejected";

/** How long the author may still change what they wrote. Measured from when
 *  the review was CREATED, not from approval — a day to reconsider, then the
 *  words stand. */
export const REVIEW_EDIT_HOURS = 24;

/** SQL fragment: only reviews that passed moderation count publicly. */
export const APPROVED_ONLY = "status = 'approved'";

const WINDOW_MS = REVIEW_EDIT_HOURS * 60 * 60 * 1000;

/**
 * How long ago a review was written, in ms. `created_at` is UTC text
 * ("YYYY-MM-DD HH:MM:SS"), parsed the way timeAgo parses it.
 *
 * Never negative. A row stamped ahead of "now" is treated as written this
 * instant — nothing can be younger than new. That happens for real: the
 * pretend clock (lib/clock) is an offset that keeps ticking, so a review
 * written during one run sits a few minutes past the moment the NEXT run
 * starts from. Without this, the window would read as longer than it is.
 */
function ageMs(createdAt: string, now = nowMs()): number {
  const written = new Date(createdAt.replace(" ", "T") + "Z").getTime();
  if (!Number.isFinite(written)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - written);
}

/** Still inside the author's editing window? */
export function canEditReview(createdAt: string, now = nowMs()): boolean {
  return ageMs(createdAt, now) < WINDOW_MS;
}

/** Whole hours left to edit (0 once the window has closed) — for the guest's
 *  "you can still change this for N hours" line. Capped at the window itself:
 *  a label promising 25 hours of a 24-hour window is simply wrong, whatever
 *  the clocks are doing. */
export function editHoursLeft(createdAt: string, now = nowMs()): number {
  const left = WINDOW_MS - ageMs(createdAt, now);
  if (left <= 0) return 0;
  return Math.min(REVIEW_EDIT_HOURS, Math.ceil(left / (60 * 60 * 1000)));
}

/**
 * The same window as a short label — "23h left", "45m left" — or "" once it
 * has closed. For the admin, who is deciding whether to act on words that may
 * still change under them.
 *
 * Minutes below the hour mark on purpose: rounding the last fifty-nine minutes
 * up to "1h left" reads as a comfortable margin at the exact moment there
 * isn't one.
 */
export function editWindowLeft(createdAt: string, now = nowMs()): string {
  const left = WINDOW_MS - ageMs(createdAt, now);
  if (left <= 0) return "";
  const minutes = Math.ceil(left / (60 * 1000));
  if (minutes >= 60) return `${editHoursLeft(createdAt, now)}h left`;
  return `${minutes}m left`;
}

/**
 * Rewrite a villa's cached rating/reviews from its APPROVED reviews.
 *
 * Moderation makes the running-average trick unusable: a review can enter,
 * leave or re-enter the average when an admin approves, rejects or the author
 * edits it. Recomputing the two columns from the table is exact every time and
 * cheap at this scale — and the public read path (queries.ts RVW_* subqueries)
 * derives its numbers the same way, so cache and screen can never disagree.
 */
export async function recomputeVillaRating(villaId: number): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE villas SET
         reviews = (SELECT COUNT(*) FROM reviews r
                     WHERE r.villa_id = ? AND r.status = 'approved'),
         rating  = COALESCE((SELECT ROUND(AVG(r.stars)::numeric, 2) FROM reviews r
                     WHERE r.villa_id = ? AND r.status = 'approved'), 0)
       WHERE id = ?`,
    )
    .run(villaId, villaId, villaId);
}

/** Longest a rejection reason may be — long enough to explain, short enough
 *  to read on a booking row. */
export const MAX_REVIEW_NOTE = 500;

/**
 * Record a step in a review's life.
 *
 * Never throws: the history is a record OF the decision, not part of making
 * it, and a booking flow that blew up while filing its own paperwork would be
 * a worse failure than a missing line. Snapshots the stars and words so a
 * later edit cannot rewrite what an admin was looking at.
 */
export async function recordReviewEvent(input: {
  reviewId: number;
  kind: "submitted" | "edited" | "approved" | "rejected";
  actorId: number;
  byAdmin?: boolean;
  note?: string;
  stars?: number;
  comment?: string;
}): Promise<void> {
  try {
    await getDb()
      .prepare(
        `INSERT INTO review_events
           (review_id, kind, actor_id, by_admin, note, stars, comment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.reviewId,
        input.kind,
        input.actorId,
        input.byAdmin ? 1 : 0,
        (input.note ?? "").trim().slice(0, MAX_REVIEW_NOTE),
        input.stars ?? 0,
        input.comment ?? "",
        nowStamp(),
      );
  } catch {
    /* see above */
  }
}
