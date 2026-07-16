import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MyRequests from "@/components/account/MyRequests";
import { getCurrentUser } from "@/lib/session";
import { getCallRequestsForGuest } from "@/lib/queries";

export const metadata: Metadata = {
  title: "My Requests",
  description: "Stays you've asked a host to arrange, and your chat with them.",
};

export default async function MyRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout renders the sign-in gate

  const requests = await getCallRequestsForGuest(user.id);
  // The nav hides this section for anyone with no open requests, so landing
  // here with none means the last one just closed (or the URL was typed).
  // Nothing to show and no link back to it — send them somewhere real.
  if (requests.length === 0) redirect("/profile/bookings");

  return <MyRequests requests={requests} />;
}
