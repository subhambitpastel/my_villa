import { getCurrentUser } from "@/lib/session";
import HeaderClient from "./HeaderClient";

export default async function Header() {
  const user = await getCurrentUser();
  return <HeaderClient authed={user !== null} />;
}
