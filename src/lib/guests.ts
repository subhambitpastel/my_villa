// Guest-lookup shapes shared by the server queries and the client picker.
//
// This module is deliberately dependency-free: a client component importing a
// VALUE from a module that reaches the database would pull `pg` into the browser
// bundle (types alone are erased, values are not). Keeping the constant here
// rather than in queries.ts is what makes it safe for both sides to import.

/** A person an owner can book on behalf of, as shown in the guest picker. */
export type GuestOption = {
  id: number;
  name: string;
  email: string;
  /** Public customer ID ("subhamdas@a9345ds") — searchable, and shown so the
   *  owner can confirm they picked the right person when names collide. */
  customerId: string;
  avatar: string;
};

/** Shortest search that returns anyone. Owners look guests up by name, email or
 *  customer ID, so the lookup is deliberately not browsable — a blank or
 *  1-character query returns nothing rather than listing the whole user base. */
export const GUEST_SEARCH_MIN = 2;
