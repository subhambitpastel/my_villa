import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getAdminReviews } from "@/lib/adminQueries";
import AdminReviews from "@/components/admin/AdminReviews";

export const metadata: Metadata = {
  title: "Admin · Reviews",
  description: "Every rating guests have left, and the moderation queue.",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** Preselects the person filter: "author:<id>" (ratings they wrote) or
     *  "owner:<id>" (ratings their properties received). The Users page links
     *  its review counts straight here. */
    user?: string;
  }>;
}) {
  if ((await getCurrentUser())?.is_admin !== 1) return null;
  const { user } = await searchParams;
  const items = await getAdminReviews();
  // Only the two shapes this page understands get through; anything else is
  // ignored rather than silently filtering every row away.
  const person = /^(author|owner):\d+$/.test(user ?? "") ? user! : "";
  return <AdminReviews items={items} initialPerson={person} />;
}
