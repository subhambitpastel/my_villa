// GET /api/chatbot/threads/[id] — the messages of one past conversation, so the
// widget can re-open it. Scoped to the signed-in user: getThreadMessages returns
// null for a thread that isn't theirs (or doesn't exist), which we surface as a
// plain 404 — so one user can neither read nor probe for another's history.

import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { chatbotEnabled } from "@/lib/chatbot/config";
import { getThreadMessages } from "@/lib/chatbot/threads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!chatbotEnabled()) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const threadId = Number(id);
  if (!Number.isInteger(threadId) || threadId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await getThreadMessages(threadId, user.id);
  if (messages === null) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ id: threadId, messages });
}
