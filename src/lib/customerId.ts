// A user's public customer ID — e.g. "subhamdas@a9345ds".
//
// Shape: <readable prefix>@<random suffix>.
//   • The prefix is the email's local part, reduced to letters and digits. Email
//     is fixed at signup and can't be changed from the app, so the readable half
//     never goes stale.
//   • The suffix is what actually makes it unique — two people at
//     subhamdas@gmail.com / subhamdas@yahoo.com still get different IDs.
//
// Minted once, at signup (and backfilled once for accounts that predate the
// column), then FROZEN. It deliberately does not follow the user's name: an
// identifier that mutates is not an identifier — anything a customer has already
// quoted (a support ticket, a receipt) must keep resolving.

import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LEN = 7;
/** Long enough to stay readable, short enough not to dominate the ID. */
const MAX_PREFIX = 20;

/** The readable half: the email's local part, letters and digits only.
 *  Falls back to "user" for an address whose local part has neither. */
export function customerIdPrefix(email: string): string {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  return local.replace(/[^a-z0-9]/g, "").slice(0, MAX_PREFIX) || "user";
}

/** The unique half: SUFFIX_LEN random lowercase alphanumerics (36^7 ≈ 78bn).
 *  Not a secret — it's shown in the account page — but crypto random keeps IDs
 *  from clustering, and the caller checks for a clash regardless. */
export function customerIdSuffix(length = SUFFIX_LEN): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** A candidate ID for this email. Uniqueness is the caller's job — see
 *  allocateCustomerId, which retries against the rows already taken. */
export const customerIdFor = (email: string): string =>
  `${customerIdPrefix(email)}@${customerIdSuffix()}`;

/**
 * A customer ID for `email` that isn't in `taken`. Retries a few times, then
 * widens the suffix — with 36^7 candidates per prefix, reaching that is
 * effectively impossible, but it means this can never loop forever or return a
 * duplicate. The DB's unique index is the final backstop.
 */
export function allocateCustomerId(
  email: string,
  taken: ReadonlySet<string>,
): string {
  for (let i = 0; i < 5; i++) {
    const id = customerIdFor(email);
    if (!taken.has(id)) return id;
  }
  return `${customerIdPrefix(email)}@${customerIdSuffix(SUFFIX_LEN + 5)}`;
}
