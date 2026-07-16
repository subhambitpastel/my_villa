"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GuestRequestItem } from "@/lib/queries";
import AccountSearch from "@/components/account/AccountSearch";
import CallChat, { ChatButton } from "@/components/account/CallChat";
import { matchesSearch } from "@/lib/textSearch";
import { useChatSocket } from "@/lib/useChatSocket";
import { formatRange, nightsBetween } from "@/lib/dates";

/** One labelled fact about the request, matching the host's own view of it. */
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
 * The guest's side of a call request — the stays they've asked a host to set up
 * by hand, and the conversation with each one.
 *
 * Only open requests reach here: closing a request deletes its thread, so a
 * closed one would be a card with a dead button. A fulfilled request becomes a
 * real stay, which My Bookings already shows.
 */
export default function MyRequests({
  requests,
}: {
  requests: GuestRequestItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // By id, not the object: refreshing behind the open dialog must re-render it
  // with the new messages rather than pin it to a stale snapshot.
  const [chatId, setChatId] = useState<number | null>(null);
  const chatting = requests.find((r) => r.id === chatId) ?? null;

  // The guest's side of the same live thread — see the note in CallRequests.
  useChatSocket(() => router.refresh());

  const visible = requests.filter((r) =>
    matchesSearch(query, r.villaName, r.villaCity, r.hostName),
  );

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <h2 className="text-[16px] font-semibold text-[#121212]">
        <span className="text-brand">
          {String(requests.length).padStart(2, "0")}
        </span>{" "}
        My Request{requests.length === 1 ? "" : "s"}
      </h2>
      <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-body">
        Stays you&rsquo;ve asked a host to arrange for you — more rooms than you
        can book online, or a longer stay. They&rsquo;ll call or message you
        here. Once they set the booking up, the request closes and the stay moves
        to My Bookings.
      </p>

      {requests.length > 1 && (
        <AccountSearch
          value={query}
          onChange={setQuery}
          placeholder="Search your requests by property, city or host"
          className="mt-6"
        />
      )}

      {visible.length === 0 ? (
        <p className="mt-6 rounded-[6px] border border-[#dfdfdf] px-4 py-10 text-center text-[13px] text-muted">
          No requests match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((r) => {
            const nights =
              r.checkIn && r.checkOut ? nightsBetween(r.checkIn, r.checkOut) : 0;
            // The last thing said, whoever said it — the reason to open it.
            const last = r.chat[r.chat.length - 1];
            return (
              <li
                key={r.id}
                className="rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Image
                      src={r.villaImage}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-[6px] object-cover"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/place?id=${r.villaId}`}
                        className="truncate text-[15px] font-semibold text-heading hover:text-brand"
                      >
                        {r.villaName}, <span className="text-purple">{r.villaCity}</span>
                      </Link>
                      <p className="text-[12px] text-[#a1a1a2]">
                        {r.requested} · hosted by {r.hostName}
                      </p>
                    </div>
                  </div>
                  <ChatButton unread={r.unread} onClick={() => setChatId(r.id)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#e8d5a3]/70 pt-3 sm:grid-cols-4">
                  <Field label="Dates">
                    {r.checkIn && r.checkOut ? (
                      <>
                        {formatRange(r.checkIn, r.checkOut)}
                        {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
                      </>
                    ) : (
                      <span className="text-muted">Not stated</span>
                    )}
                  </Field>
                  <Field label="Rooms wanted">
                    {r.rooms > 0 ? r.rooms : <span className="text-muted">Not stated</span>}
                  </Field>
                  <Field label="Guests">
                    {r.guests > 0 ? r.guests : <span className="text-muted">Not stated</span>}
                  </Field>
                  <Field label="Add-ons">
                    {r.services.length > 0 ? (
                      r.services.map((s) => s.name).join(", ")
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </Field>
                </div>

                {/* The state of the conversation, not the request: whether
                    anyone has replied is the only thing they're waiting on. */}
                <div className="mt-3 rounded-[6px] bg-white px-3.5 py-3">
                  {last ? (
                    <>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
                        {last.mine ? "You said" : `${last.senderName} replied`}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#3a3a44]">
                        {last.body}
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">
                      No messages yet — the host will be in touch, or you can
                      message them first.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {chatting && (
        <CallChat
          requestId={chatting.id}
          withName={chatting.hostName}
          withAvatar={chatting.hostAvatar}
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
