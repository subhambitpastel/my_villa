// Review moderation rules, shared by the guest actions, the admin actions and
// the read queries. A plain module (not "use server"): the guest and admin
// action files both need these, and an export from a server-action file would
// become a publicly callable endpoint.

import { getDb } from "./db";
import { nowMs } from "./clock";

export type ReviewStatus = "pending" | "approved" | "rejected";

/** How long the author may still change what they wrote. Measured from when
 *  the review was CREATED, not from approval — a day to reconsider, then the
 *  words stand. */
export const REVIEW_EDIT_HOURS = 24;

/** SQL fragment: only reviews that passed moderation count publicly. */
export const APPROVED_ONLY = "status = 'approved'";

/** `created_at` is UTC text ("YYYY-MM-DD HH:MM:SS"); parse it the same way
 *  timeAgo does. Returns ms since the review was written. */
function ageMs(createdAt: string, now = nowMs()): number {
  const written = new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(written) ? now - written : Number.POSITIVE_INFINITY;
}

/** Still inside the author's editing window? */
export function canEditReview(createdAt: string, now = nowMs()): boolean {
  return ageMs(createdAt, now) < REVIEW_EDIT_HOURS * 60 * 60 * 1000;
}

/** Whole hours left to edit (0 once the window has closed) — for the guest's
 *  "you can still change this for N hours" line. */
export function editHoursLeft(createdAt: string, now = nowMs()): number {
  const left = REVIEW_EDIT_HOURS * 60 * 60 * 1000 - ageMs(createdAt, now);
  return left > 0 ? Math.ceil(left / (60 * 60 * 1000)) : 0;
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
