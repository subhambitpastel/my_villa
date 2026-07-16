import {
  ACCOUNT_BADGE_LABEL,
  type AccountCounts,
  type AccountSection,
} from "@/lib/accountNav";

/** The count pill next to an account nav label, in the sidebar and the header's
 *  avatar menu alike — one component so the two can't drift apart.
 *
 *  Renders nothing at zero: an empty queue is the normal state, and a "0" pill
 *  would draw the eye to every tab that has nothing waiting.
 */
export default function NavCountBadge({
  section,
  counts,
}: {
  section: AccountSection;
  counts: AccountCounts;
}) {
  const key = section.badge;
  if (!key) return null;
  const n = counts[key];
  if (n < 1) return null;

  return (
    <span
      aria-label={ACCOUNT_BADGE_LABEL[key](n)}
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff3d6] px-1.5 text-[11px] font-semibold text-[#a06a00]"
    >
      {/* Past 99 the exact number stops being actionable and starts widening
          the pill enough to push the label around. */}
      {n > 99 ? "99+" : n}
    </span>
  );
}
