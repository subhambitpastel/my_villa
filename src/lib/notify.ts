// Writing notifications. A plain module, NOT a "use server" one: a server
// action file may only export async functions, and every export there becomes
// a publicly callable endpoint — `notify` must never be one. Both actions.ts
// and adminActions.ts import from here.

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import type { NotificationType } from "./notifications";

/**
 * Tell `userId` that something happened.
 *
 * Never throws. A notification is a side-effect of the real thing — a booking,
 * a cancellation, a review — and none of those should fail because the news
 * about them couldn't be filed. A missed notification is a small loss; a
 * booking that blew up while telling someone about it is a much bigger one.
 *
 * The wording is passed in already written, and stored as-is: the villa may be
 * renamed or deleted later, and "Alena booked The Bund" should still read true.
 */
export async function notify(input: {
  /** Who it's FOR — never the person who caused it. */
  userId: number;
  type: NotificationType;
  title: string;
  body?: string;
  /** Where clicking it should land them. */
  href?: string;
}): Promise<void> {
  try {
    await getDb()
      .prepare(
        `INSERT INTO notifications (user_id, type, title, body, href)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.type,
        input.title,
        input.body ?? "",
        input.href ?? "",
      );
    // The bell is in the header of every page, so its count is stale everywhere.
    revalidatePath("/", "layout");
  } catch {
    /* see above: the event itself matters more than the news of it */
  }
}

/** The signed-in person's display name, for "X booked your villa". */
export const displayName = (u: { full_name: string; email: string }) =>
  u.full_name.trim() || u.email;
