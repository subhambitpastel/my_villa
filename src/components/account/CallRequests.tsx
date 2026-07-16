"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveCallRequestAction } from "@/lib/actions";
import type { CallRequestItem } from "@/lib/queries";
import AccountSearch from "@/components/account/AccountSearch";
import CallChat, { ChatButton } from "@/components/account/CallChat";
import { matchesSearch } from "@/lib/textSearch";
import { useChatSocket } from "@/lib/useChatSocket";
import { formatRange, nightsBetween } from "@/lib/dates";

/**
 * Opens the owner's booking form for this request, already filled in with what
 * the guest asked for. Only what they actually stated is carried: the request
 * stores 0 for an unpicked room/guest count and "" for unpicked dates, and
 * passing those through would prefill the form with fictions. Anything omitted
 * just falls back to the form's own defaults.
 */
function fulfilHref(c: CallRequestItem): string {
  const qs = new URLSearchParams({
    villa: String(c.villaId),
    guest: String(c.guestId),
    // Carried so booking it closes the request — fulfilling it IS the answer,
    // and it shouldn't still sit here waiting on a call afterwards.
    call: String(c.id),
  });
  if (c.checkIn && c.checkOut) {
    qs.set("in", c.checkIn);
    qs.set("out", c.checkOut);
  }
  if (c.rooms > 0) qs.set("rooms", String(c.rooms));
  if (c.guests > 0) qs.set("guests", String(c.guests));
  // Add-ons they'd already ticked, as indices into the villa's current list.
  if (c.serviceIdx.length > 0) qs.set("svc", c.serviceIdx.join(","));
  return `/host/booking?${qs.toString()}`;
}

/** One labelled fact about the requester. Laid out as a grid rather than prose
 *  so the host can scan straight to the bit they need mid-call. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] text-[#3a3a44]">{children}</p>
    </div>
  );
}

/**
 * Guests waiting on a call about a stay the self-serve flow wouldn't take —
 * more rooms than one guest may book online, or a stay longer than the nightly
 * flow handles. The host rings them and sets it up by hand, so this page's job
 * is to put everything needed for that call in one place.
 */
export default function CallRequests({
  requests,
}: {
  requests: CallRequestItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  // Which thread is open, by request id. Held as an id rather than the request
  // itself so a router.refresh() behind the dialog re-renders it with the new
  // messages instead of freezing on a stale copy.
  const [chatId, setChatId] = useState<number | null>(null);
  const chatting = requests.find((c) => c.id === chatId) ?? null;

  // Subscribed at the LIST, not inside the open thread: a message should also
  // move the card's preview and its unread badge, whether or not the thread is
  // open. refresh() re-renders this server component, and the dialog reads its
  // messages from the same `requests` — so the open chat updates with it.
  useChatSocket(() => router.refresh());

  function resolve(id: number) {
    startTransition(async () => {
      await resolveCallRequestAction(id);
      router.refresh();
    });
  }

  const visible = requests.filter((c) =>
    matchesSearch(
      query,
      c.guestName,
      c.guestEmail,
      c.guestCustomerId,
      c.guestPhone,
      c.villaName,
      c.message,
    ),
  );

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <h2 className="text-[16px] font-semibold text-[#121212]">
        <span className="text-brand">
          {String(requests.length).padStart(2, "0")}
        </span>{" "}
        Call Request{requests.length === 1 ? "" : "s"}
      </h2>
      <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-body">
        Guests who wanted a stay that can&rsquo;t be completed online — more
        rooms than one guest may book, or a longer stay than the nightly flow
        takes. Give them a ring and set the booking up directly, then mark it as
        called.
      </p>

      {requests.length > 0 && (
        <AccountSearch
          value={query}
          onChange={setQuery}
          placeholder="Search by name, email, customer ID or property"
          className="mt-6"
        />
      )}

      {requests.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-base font-semibold text-ink">No call requests</p>
          <p className="mt-1 text-sm text-body">
            When a guest asks for more rooms or a longer stay than they can book
            online, their request shows up here.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-10 text-center text-[13px] text-muted">
          No call requests match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((c) => {
            const nights =
              c.checkIn && c.checkOut ? nightsBetween(c.checkIn, c.checkOut) : 0;
            return (
              <li
                key={c.id}
                className="rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Image
                      src={c.guestAvatar}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-heading">
                        {c.guestName}
                      </p>
                      <p className="text-[12px] text-[#a1a1a2]">{c.requested}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {/* The point of the call is usually just to make the booking
                        — so offer that directly, with everything the guest
                        already told us carried straight into the form. Calling
                        stays available for when there's actually more to
                        discuss. */}
                    <Link
                      href={fulfilHref(c)}
                      className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Fulfil this request
                    </Link>
                    {/* Not everything needs a phone call — and a guest who
                        left a note has already started the conversation. */}
                    <ChatButton unread={c.unread} onClick={() => setChatId(c.id)} />
                    {c.guestPhone ? (
                      <a
                        href={`tel:${c.guestPhone.replace(/\s+/g, "")}`}
                        className="rounded-[8px] border border-brand px-4 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                      >
                        Call {c.guestPhone}
                      </a>
                    ) : (
                      <a
                        href={`mailto:${c.guestEmail}`}
                        className="rounded-[8px] border border-brand px-4 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/5"
                      >
                        Email guest
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => resolve(c.id)}
                      className="text-[13px] font-medium text-[#7a7a85] underline disabled:opacity-50"
                    >
                      Mark as called
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#e8d5a3]/70 pt-3 sm:grid-cols-3">
                  <Field label="Customer ID">
                    {c.guestCustomerId ? (
                      <span className="font-mono font-semibold text-brand">
                        {c.guestCustomerId}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Field>
                  <Field label="Email">
                    <a href={`mailto:${c.guestEmail}`} className="underline">
                      {c.guestEmail}
                    </a>
                  </Field>
                  <Field label="Phone">
                    {c.guestPhone || <span className="text-muted">Not provided</span>}
                  </Field>
                  <Field label="Property">{c.villaName}</Field>
                  <Field label="Dates">
                    {c.checkIn && c.checkOut ? (
                      <>
                        {formatRange(c.checkIn, c.checkOut)}
                        {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
                      </>
                    ) : (
                      <span className="text-muted">Not stated</span>
                    )}
                  </Field>
                  <Field label="Rooms wanted">
                    {c.rooms > 0 ? c.rooms : <span className="text-muted">Not stated</span>}
                  </Field>
                  <Field label="Guests">
                    {c.guests > 0 ? c.guests : <span className="text-muted">Not stated</span>}
                  </Field>
                  {/* They ticked these before asking — worth showing, so the
                      host knows what the stay includes without asking again. */}
                  <Field label="Add-ons wanted">
                    {c.services.length > 0 ? (
                      c.services.map((s) => s.name).join(", ")
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </Field>
                </div>

                {/* The guest's own words — the one thing the numbers above
                    can't carry, so it gets room to breathe rather than a cell. */}
                {c.message && (
                  <div className="mt-3 rounded-[6px] bg-white px-3.5 py-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
                      Their message
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#3a3a44]">
                      {c.message}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {chatting && (
        <CallChat
          requestId={chatting.id}
          withName={chatting.guestName}
          withAvatar={chatting.guestAvatar}
          subtitle={
            chatting.checkIn && chatting.checkOut
              ? `${chatting.villaName} · ${formatRange(chatting.checkIn, chatting.checkOut)}`
              : chatting.villaName
          }
          messages={chatting.chat}
          unread={chatting.unread}
          onClose={() => setChatId(null)}
          onSent={() => router.refresh()}
        />
      )}
    </div>
  );
}
