import { getCurrentUser } from "@/lib/session";
import { getAccountCounts, getVillasByOwner } from "@/lib/queries";
import { NO_ACCOUNT_COUNTS } from "@/lib/accountNav";
import HeaderClient from "./HeaderClient";

export default async function Header() {
  const user = await getCurrentUser();
  // Same rule as the profile sidebar: host links show for anyone in hosting
  // mode (or who already owns villas) — guests don't see My Property.
  const isHost = user
    ? user.hosting_enabled === 1 ||
      (await getVillasByOwner(user.id)).length > 0
    : false;
  // The header is on every page, so this is the one place the badges reach a
  // guest who never opens their profile.
  const counts = user
    ? await getAccountCounts(user.id, isHost)
    : NO_ACCOUNT_COUNTS;
  return (
    <HeaderClient
      authed={user !== null}
      isHost={isHost}
      counts={counts}
      avatar={user?.avatar}
      name={user?.full_name}
      email={user?.email}
    />
  );
}
