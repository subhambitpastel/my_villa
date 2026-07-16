// The bot's window onto a user's OWN data — the "what's mine" half of the
// assistant, next to the doc RAG's "how does it work" half. Server-only.
//
// Every tool here is read-only and SELF-SCOPED: it takes the signed-in user's id
// (passed from the session by the graph, never chosen by the model) and calls an
// existing, already-scoped query in queries.ts. The model's only influence is
// picking WHICH tool runs — never an id, a filter, or a row. That's the wall
// that keeps one user from ever seeing another's data: there is no code path
// where a value from the question reaches a query.
//
// Each tool returns a COMPACT text block, not the raw UI objects. The page
// queries return rich, React-shaped records (avatars, image URLs, receipt
// breakdowns); dumping those into the prompt is noise and wasted tokens. The
// formatters below keep only the fields that answer questions, in a form the
// model can quote back.

import {
  getBookingsForGuest,
  getFavoriteVillas,
  getVillasByOwner,
  getRequestsForOwner,
  getCallRequestsForOwner,
} from "@/lib/queries";
import { bookingReference } from "@/lib/pricing";
import type { Audience } from "./config";

/** A single self-scoped lookup the classifier can choose. */
export type DataTool = {
  key: string;
  /** True = only a host may use it (property/host data). False = anyone, because
   *  EVERY user can book stays — a host is also a guest, so a host must be able
   *  to ask about their own bookings, not just their listings. This is a role
   *  gate, NOT the doc audience: the doc audience stays binary, but data access
   *  is additive (a host gets guest tools too). */
  ownerOnly: boolean;
  /** One line telling the classifier when this tool answers the question. */
  description: string;
  /** Run the lookup for `userId` and return a compact text block ('' = nothing
   *  relevant found, which the caller turns into a clear "you have none"). */
  run: (userId: number) => Promise<string>;
};

const money = (n: number) => `$${n.toFixed(2)}`;

/** BookingStatus → a word a user recognises from the UI. */
const STATUS_LABEL: Record<string, string> = {
  accepted: "Confirmed",
  pending: "Payment pending",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/** One booking as a single line — the reference is derived the same way the UI
 *  derives it, so a user can match it to what they see on screen. */
function bookingLine(b: {
  id: number;
  villa: string;
  kind: string;
  dates: string;
  nights: number;
  guests: string;
  rooms: number;
  status: string;
  amountPaid: number;
  paymentDue: boolean;
  myRating: number | null;
}): string {
  const parts = [
    bookingReference(b.id),
    b.villa,
    b.kind,
    b.dates || "dates not set",
    b.nights ? `${b.nights} night${b.nights === 1 ? "" : "s"}` : null,
    b.guests,
    `${b.rooms} room${b.rooms === 1 ? "" : "s"}`,
    statusLabel(b.status),
    money(b.amountPaid),
    b.paymentDue ? "PAYMENT DUE" : null,
    b.myRating ? `you rated it ${b.myRating}★` : null,
  ].filter(Boolean);
  return "- " + parts.join(" · ");
}

export const DATA_TOOLS: DataTool[] = [
  // ── guest ──────────────────────────────────────────────────────────────────
  {
    key: "recent_bookings",
    ownerOnly: false,
    description:
      "The user's own bookings, most recent first — use for 'my last booking', 'my recent stays', 'my booking history', whether they've rated a stay, or a specific past booking.",
    run: async (userId) => {
      const all = await getBookingsForGuest(userId);
      if (all.length === 0) return "You have no bookings yet.";
      const lines = all.slice(0, 8).map(bookingLine);
      const more = all.length > 8 ? `\n(…and ${all.length - 8} older.)` : "";
      return `Your bookings, most recent first:\n${lines.join("\n")}${more}`;
    },
  },
  {
    key: "upcoming_stays",
    ownerOnly: false,
    description:
      "The user's confirmed upcoming/future stays (check-in still ahead) — use for 'my next trip', 'my upcoming stays', 'when am I travelling'.",
    run: async (userId) => {
      const all = await getBookingsForGuest(userId);
      const upcoming = all.filter(
        (b) => b.upcoming && (b.status === "accepted" || b.status === "pending"),
      );
      if (upcoming.length === 0) return "You have no upcoming stays booked.";
      return `Your upcoming stays:\n${upcoming.map(bookingLine).join("\n")}`;
    },
  },
  {
    key: "pending_payments",
    ownerOnly: false,
    description:
      "Stays the user still owes money for and must pay (including host-arranged bookings awaiting payment) — use for 'what do I owe', 'unpaid bookings', 'do I have anything to pay'.",
    run: async (userId) => {
      const all = await getBookingsForGuest(userId);
      const due = all.filter((b) => b.paymentDue);
      if (due.length === 0) return "You have nothing awaiting payment.";
      const total = due.reduce((sum, b) => sum + b.amountPaid, 0);
      return `Stays awaiting your payment (total ${money(total)}):\n${due
        .map(bookingLine)
        .join("\n")}`;
    },
  },
  {
    key: "favorites",
    ownerOnly: false,
    description:
      "Villas the user has saved to their favorites/wishlist — use for 'my saved villas', 'my wishlist', 'what have I favorited'.",
    run: async (userId) => {
      const favs = await getFavoriteVillas(userId);
      if (favs.length === 0) return "Your favorites list is empty.";
      const lines = favs.map(
        (v) =>
          `- ${v.name}, ${v.city} (${v.kind}) · ${money(v.price)}/night${
            v.rating ? ` · ${v.rating}★` : " · new listing"
          }`,
      );
      return `Your saved villas:\n${lines.join("\n")}`;
    },
  },

  // ── owner ──────────────────────────────────────────────────────────────────
  {
    key: "my_properties",
    ownerOnly: true,
    description:
      "The owner's own listed properties with key stats — use for 'my listings', 'my properties', 'is X locked', 'how are my villas rated', 'which of my places is featured'.",
    run: async (userId) => {
      const props = await getVillasByOwner(userId);
      if (props.length === 0) return "You have no properties listed.";
      const lines = props.map((p) => {
        const flags = [
          p.featured ? "featured" : null,
          p.locked ? "LOCKED (not taking bookings)" : null,
        ].filter(Boolean);
        return `- ${p.name}, ${p.city} (${p.kind}) · ${money(p.price)}/night · ${
          p.rooms
        } room${p.rooms === 1 ? "" : "s"} · ${
          p.reviews ? `${p.rating}★ (${p.reviews} reviews)` : "no reviews yet"
        }${flags.length ? ` · ${flags.join(", ")}` : ""}`;
      });
      // An explicit count by kind so "how many villas / hotels / resorts do I
      // have" is answered from a stated number, not by the model tallying lines
      // (which it can miscount). Kinds are whatever the listings actually use.
      const byKind = new Map<string, number>();
      for (const p of props) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
      const breakdown = [...byKind.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([kind, n]) => `${n} ${kind}`)
        .join(", ");
      return `Your properties — ${props.length} total (${breakdown}):\n${lines.join(
        "\n",
      )}`;
    },
  },
  {
    key: "bookings_on_my_properties",
    ownerOnly: true,
    description:
      "Bookings and requests across the owner's properties (all statuses), most recent first — use for 'who booked my villa', 'my recent bookings', 'how much have my bookings made', 'any bookings awaiting payment'.",
    run: async (userId) => {
      const reqs = await getRequestsForOwner(userId);
      if (reqs.length === 0) return "No one has booked your properties yet.";
      const lines = reqs.slice(0, 10).map((r) => {
        const parts = [
          r.tenant,
          r.villa,
          r.dates || "dates not set",
          r.guests,
          `${r.rooms} room${r.rooms === 1 ? "" : "s"}`,
          statusLabel(r.status),
          money(r.amount),
          r.paymentDue ? "awaiting payment" : null,
        ].filter(Boolean);
        return "- " + parts.join(" · ");
      });
      const more = reqs.length > 10 ? `\n(…and ${reqs.length - 10} more.)` : "";
      return `Bookings on your properties, most recent first:\n${lines.join(
        "\n",
      )}${more}`;
    },
  },
  {
    key: "call_requests",
    ownerOnly: true,
    description:
      "Guests who have asked the owner for a call about a booking the online flow won't take (open call requests) — use for 'who wants a call', 'my call requests', 'anyone waiting to hear from me'.",
    run: async (userId) => {
      const calls = await getCallRequestsForOwner(userId);
      if (calls.length === 0) return "You have no open call requests.";
      const lines = calls.map((c) => {
        const when =
          c.checkIn && c.checkOut ? `${c.checkIn} → ${c.checkOut}` : "no dates given";
        const parts = [
          c.guestName,
          c.villaName,
          when,
          c.rooms ? `${c.rooms} room${c.rooms === 1 ? "" : "s"}` : null,
          c.unread ? `${c.unread} unread message${c.unread === 1 ? "" : "s"}` : null,
          c.message ? `note: "${c.message.slice(0, 80)}"` : null,
        ].filter(Boolean);
        return "- " + parts.join(" · ");
      });
      return `Guests waiting for a call from you:\n${lines.join("\n")}`;
    },
  },
];

/** The tools a given user may run. Additive, not exclusive: a host (owner
 *  audience) gets the owner tools AND the guest tools, because a host is also a
 *  guest and can ask about their own bookings. A plain guest gets guest tools
 *  only — an owner tool is never shown to, or runnable by, a non-host. */
export const toolsForAudience = (audience: Audience): DataTool[] =>
  DATA_TOOLS.filter((t) => !t.ownerOnly || audience === "owner");

export type FetchedData = { key: string; text: string };

/**
 * Run the chosen tools for one user and collect their text blocks. Only keys
 * that are valid FOR THIS AUDIENCE run — an owner key slipped into a guest
 * request is ignored, not executed. A tool that throws is dropped (its absence
 * just means the model answers without that slice) rather than failing the whole
 * turn.
 */
export async function fetchUserData(
  keys: string[],
  userId: number,
  audience: Audience,
): Promise<FetchedData[]> {
  const allowed = new Map(toolsForAudience(audience).map((t) => [t.key, t]));
  const chosen = [...new Set(keys)].map((k) => allowed.get(k)).filter(Boolean) as DataTool[];
  const out: FetchedData[] = [];
  for (const tool of chosen) {
    try {
      const text = await tool.run(userId);
      if (text) out.push({ key: tool.key, text });
    } catch {
      /* skip a failed lookup — better a partial answer than none */
    }
  }
  return out;
}
