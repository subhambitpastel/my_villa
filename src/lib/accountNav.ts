// The account sections, in ONE canonical order shared by the header's avatar
// menu and the profile sidebar, so the app reads the same way in both places
// for guests and hosts alike.
//
// A plain module on purpose (no "use client"): value exports from a client
// module turn into proxies when a server component imports them.

/** The counters a section can badge. Both are queues someone else is waiting
 *  on: an unpaid stay holds no rooms, and a call request is a guest sitting by
 *  the phone — neither should need the page opened to be noticed. */
export type AccountCountKey =
  | "pendingPayments"
  | "callRequests"
  /** Open requests this user has MADE. Not a badge — it decides whether the My
   *  Requests section exists at all. */
  | "myRequests"
  /** Replies waiting on them in a request thread, either side of the table. */
  | "unreadChat";

export type AccountCounts = Record<AccountCountKey, number>;

/** Signed-out, or nothing waiting. Named so callers don't hand-write zeroes. */
export const NO_ACCOUNT_COUNTS: AccountCounts = {
  pendingPayments: 0,
  callRequests: 0,
  myRequests: 0,
  unreadChat: 0,
};

/** Screen-reader wording — a bare "3" next to a label says nothing about what
 *  it counts, and the two badges count different things. */
export const ACCOUNT_BADGE_LABEL: Record<
  AccountCountKey,
  (n: number) => string
> = {
  pendingPayments: (n) => `${n} awaiting payment`,
  callRequests: (n) => `${n} waiting for a call`,
  myRequests: (n) => `${n} open`,
  unreadChat: (n) => `${n} unread message${n === 1 ? "" : "s"}`,
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
  /** Hide the section entirely while this counter is 0. For sections that only
   *  mean anything once the user has done the thing — an empty My Requests is
   *  noise for the many guests who never ask for a call. Distinct from `badge`:
   *  what makes a section EXIST isn't always what's worth a number on it. */
  hideWhen?: AccountCountKey;
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
  // The guest's side of a call request: where they read the host's reply. Only
  // appears once they've actually asked for a call — badged with unread replies
  // rather than request count, since that's the part with something to do.
  {
    label: "My Requests",
    href: "/profile/my-requests",
    badge: "unreadChat",
    hideWhen: "myRequests",
  },
  { label: "My Property", href: "/profile/properties", hostOnly: true },
  { label: "My Packages", href: "/profile/packages", hostOnly: true },
  { label: "Rent Requests", href: "/profile/requests", hostOnly: true },
  {
    label: "Call Requests",
    href: "/profile/calls",
    hostOnly: true,
    badge: "callRequests",
  },
  { label: "Coupons", href: "/profile/coupons", hostOnly: true },
];

/** The sections a guest (hosting off) or a host may see, in canonical order.
 *  `counts` only decides `hideWhen` sections; without it they stay hidden,
 *  which is the safe default — a nav link to an empty page is worse than none. */
export const accountSectionsFor = (
  isHost: boolean,
  counts: AccountCounts = NO_ACCOUNT_COUNTS,
): AccountSection[] =>
  ACCOUNT_SECTIONS.filter(
    (section) =>
      (isHost || !section.hostOnly) &&
      (!section.hideWhen || counts[section.hideWhen] > 0),
  );
