import { getCurrentUser } from "@/lib/session";
import { getVillasByOwner } from "@/lib/queries";
import HeaderClient from "./HeaderClient";

export default async function Header() {
  const user = await getCurrentUser();
  // Same rule as the profile sidebar: host links show for anyone in hosting
  // mode (or who already owns villas) — guests don't see My Property.
  const isHost = user
    ? user.hosting_enabled === 1 ||
      (await getVillasByOwner(user.id)).length > 0
    : false;
  return (
    <HeaderClient
      authed={user !== null}
      isHost={isHost}
      avatar={user?.avatar}
      name={user?.full_name}
      email={user?.email}
    />
  );
}
