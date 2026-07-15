import type { Metadata } from "next";
import CallRequests from "@/components/account/CallRequests";
import { getCurrentUser } from "@/lib/session";
import { getCallRequestsForOwner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Call Requests",
  description: "Guests waiting for a call about a booking you arrange directly.",
};

export default async function CallRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  return <CallRequests requests={await getCallRequestsForOwner(user.id)} />;
}
