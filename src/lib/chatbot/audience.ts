// Which document answers a given user — the guest/owner split. Server-only
// (reaches the DB). Kept in one place so the API route and the layout can't
// drift on what "is this person a host" means.

import { getVillasByOwner } from "@/lib/queries";
import type { SessionUser } from "@/lib/session";
import type { Audience } from "./config";

/**
 * A user is answered from the OWNER doc when they're in hosting mode. This is
 * exactly the app's own `isHost` rule (profile layout, /account): hosting is on
 * when the flag is set OR they own at least one villa — listing a property flips
 * the flag, but the "owns villas" arm covers the instant before a stale session
 * catches up. Everyone else gets the GUEST doc.
 *
 * The chatbot follows the SAME switch the rest of the UI uses, so a user whose
 * account shows host tools is answered as a host, and a plain guest as a guest —
 * no third state to reason about.
 */
export async function audienceFor(user: SessionUser): Promise<Audience> {
  if (user.hosting_enabled === 1) return "owner";
  const villas = await getVillasByOwner(user.id);
  return villas.length > 0 ? "owner" : "guest";
}
