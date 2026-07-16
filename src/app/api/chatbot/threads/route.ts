// GET /api/chatbot/threads — the signed-in user's past assistant conversations,
// most-recently-active first, for the widget's history list.
//
// Same gate and auth as the chat endpoint: invisible (404) when the feature is
// off, and only ever the caller's OWN threads (listThreads filters by user id).

import { getCurrentUser } from "@/lib/session";
import { chatbotEnabled } from "@/lib/chatbot/config";
import { listThreads } from "@/lib/chatbot/threads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!chatbotEnabled()) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const threads = await listThreads(user.id);
    return Response.json({ threads });
  } catch (err) {
    console.error("chatbot thread list failed:", err);
    return Response.json({ threads: [] });
  }
}
