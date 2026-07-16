// The account sections, in ONE canonical order shared by the header's avatar
// menu and the profile sidebar, so the app reads the same way in both places
// for guests and hosts alike.
//
// A plain module on purpose (no "use client"): value exports from a client
// module turn into proxies when a server component imports them.

/** The counters a section can badge. Both are queues someone else is waiting
 *  on: an unpaid stay holds no rooms, and a call request is a guest sitting by
 *  the phone — neither should need the page opened to be noticed. */
export type AccountCountKey = "pendingPayments" | "callRequests";

export type AccountCounts = Record<AccountCountKey, number>;

/** Signed-out, or nothing waiting. Named so callers don't hand-write zeroes. */
export const NO_ACCOUNT_COUNTS: AccountCounts = {
  pendingPayments: 0,
  callRequests: 0,
};

/** Screen-reader wording — a bare "3" next to a label says nothing about what
 *  it counts, and the two badges count different things. */
export const ACCOUNT_BADGE_LABEL: Record<
  AccountCountKey,
  (n: number) => string
> = {
  pendingPayments: (n) => `${n} awaiting payment`,
  callRequests: (n) => `${n} waiting for a call`,
};

export type AccountSection = {
  label: string;
  href: string;
  hostOnly?: boolean;
  /** Kept out of the header's avatar menu. "Profile Settings" would sit a few
   *  pixels from "Settings" there — two near-identical names pointing at
   *  different pages. It stays in the sidebar, and the Settings page's
   *  "Personal Settings" card still reaches it. */
  sidebarOnly?: boolean;
  /** Which counter rides on this section, if any. Declared here rather than at
   *  each render site so the header menu and the sidebar can't drift on which
   *  tab shows which number. */
  badge?: AccountCountKey;
};

/** Guest-facing sections first, host-only ones appended — a guest sees an
 *  unbroken list, and a host sees that same order with the hosting tools after
 *  it, so switching hosting mode on only ever adds to the end. */
export const ACCOUNT_SECTIONS: AccountSection[] = [
  { label: "Profile Settings", href: "/profile", sidebarOnly: true },
  { label: "My Bookings", href: "/profile/bookings" },
  // Right after My Bookings: it's a booking that isn't one yet. A host arranged
  // it, it holds nothing, and it disappears from here the moment it's paid.
  { label: "Payment Pending", href: "/profile/payments", badge: "pendingPayments" },
  { label: "My Favorites", href: "/profile/favorites" },
  { label: "My Property", href: "/profile/properties", hostOnly: true },
  { label: "My Packages", href: "/profile/packages", hostOnly: true },
  { label: "Rent Requests", href: "/profile/requests", hostOnly: true },
  {
    label: "Call Requests",
    href: "/profile/calls",
    hostOnly: true,
    badge: "callRequests",
  },
];

/** The sections a guest (hosting off) or a host may see, in canonical order. */
export const accountSectionsFor = (isHost: boolean): AccountSection[] =>
  ACCOUNT_SECTIONS.filter((section) => isHost || !section.hostOnly);
