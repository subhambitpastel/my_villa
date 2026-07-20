// What a notification is, shared by the server that writes them and the bell
// that renders them.
//
// Dependency-free on purpose, like lib/guests.ts and lib/callRequest.ts: the
// bell is a client component, and importing a VALUE from a module that reaches
// the database pulls `pg` into the browser bundle. Types alone are erased;
// values are not.

/** Why a notification fired. The type drives its icon and tone — the wording
 *  itself is written when the event happens and stored with it. */
export type NotificationType =
  /** Guest: a host arranged a stay for them and it's waiting to be paid. */
  | "payment_request"
  /** Owner: a guest booked one of their listings. */
  | "booking_made"
  /** Either side: a stay was called off by the other one. */
  | "booking_cancelled"
  /** Owner: a guest changed the dates/rooms of a stay they'd already booked. */
  | "booking_changed"
  /** Owner: a guest wants a call about a stay the online flow won't take. */
  | "call_request"
  /** Either side: the other one wrote in a call request's thread. */
  | "chat_message"
  /** Owner: a guest rated a finished stay. */
  | "review"
  /** Either side: MyVilla support acted on their listing, coupon or stay. */
  | "moderation";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  /** Where clicking it goes. "" when there's nowhere useful to send them. */
  href: string;
  /** False = still bold with a dot. Only an indication — nothing gates on it. */
  read: boolean;
  /** "2 hours ago" — relative, since that's how recency is read at a glance. */
  when: string;
};

/** How each kind reads at a glance. The icon and colour only reinforce the
 *  words; nothing here is the sole carrier of meaning. */
export const NOTIFICATION_TONE: Record<
  NotificationType,
  { bg: string; fg: string }
> = {
  // Money the guest owes — the one kind with something still to do.
  payment_request: { bg: "bg-[#fff3d6]", fg: "text-[#a06a00]" },
  // Good news for a host.
  booking_made: { bg: "bg-[#e5f4ee]", fg: "text-[#1c7d5c]" },
  // Something was lost.
  booking_cancelled: { bg: "bg-[#fdecec]", fg: "text-[#c0392b]" },
  booking_changed: { bg: "bg-[#e9e8fd]", fg: "text-brand" },
  // Someone is waiting on the host.
  call_request: { bg: "bg-[#fff3d6]", fg: "text-[#a06a00]" },
  // Someone is mid-conversation and waiting on a reply.
  chat_message: { bg: "bg-[#e9e8fd]", fg: "text-brand" },
  review: { bg: "bg-[#e9e8fd]", fg: "text-brand" },
  // Support stepped in — same weight as something being lost.
  moderation: { bg: "bg-[#fdecec]", fg: "text-[#c0392b]" },
};

/** Prefix for the screen-reader label, so a notification announces what KIND it
 *  is before its title — the icon that says so visually is decorative. */
export const NOTIFICATION_KIND_LABEL: Record<NotificationType, string> = {
  payment_request: "Payment request",
  booking_made: "New booking",
  booking_cancelled: "Booking cancelled",
  booking_changed: "Booking changed",
  call_request: "Call request",
  chat_message: "New message",
  review: "New review",
  moderation: "Moderation notice",
};

/** Most recent notifications the bell holds. It's a glance, not an archive —
 *  and the pages behind each one are the real record. */
export const NOTIFICATION_LIMIT = 12;
