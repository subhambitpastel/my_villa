import type { Metadata } from "next";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import HostWizard from "@/components/host/HostWizard";
import {
  DEFAULT_DRAFT,
  FACILITY_CHIPS,
  SERVICES,
  type Draft,
} from "@/components/host/draft";
import { getCurrentUser } from "@/lib/session";
import { getVillaDetail } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Add your Villa",
  description:
    "Register your villa for renting on MyVilla — add your details, photos, pricing and the account where you'll receive guest payments.",
};

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await getCurrentUser();

  const personal = user
    ? {
        fullName: user.full_name,
        gender: user.gender,
        email: user.email,
        dob: user.dob,
        address: user.address,
        emergency: user.emergency,
      }
    : undefined;

  // Personal details are only asked once — returning hosts whose profile
  // already covers the required fields go straight to Villa Details.
  const personalComplete = !!(
    user &&
    user.full_name.trim() &&
    user.gender &&
    user.dob.trim() &&
    user.address.trim()
  );

  // Edit mode: prefill the wizard from the villa being edited (owner only).
  let editId: number | undefined;
  let editDraft: Draft | undefined;
  if (edit && user) {
    const villa = await getVillaDetail(Number(edit));
    if (villa && villa.owner_id === user.id) {
      editId = villa.id;
      editDraft = {
        ...DEFAULT_DRAFT,
        personal: personal!,
        villa: {
          kind: villa.kind,
          name: villa.name,
          description: villa.description,
          area: villa.area,
          address: villa.address,
          // Old rows derived city from the address; don't prefill that junk.
          city: villa.city === villa.name ? "" : villa.city,
          rooms: String(villa.rooms),
          bathrooms: String(villa.bathrooms),
          maxGuests: String(villa.max_guests),
          facilities: villa.facilityList,
        },
        images: villa.gallery,
        services: {
          selected: villa.serviceList.map((s) => s.name),
          prices: Object.fromEntries(
            villa.serviceList
              .filter((s) => s.price > 0)
              .map((s) => [s.name, String(s.price)]),
          ),
          customs: villa.serviceList
            .map((s) => s.name)
            .filter((n) => !SERVICES.includes(n) && !FACILITY_CHIPS.includes(n)),
        },
        price: villa.price,
      };
    }
  }

  return (
    <>
      <Header />
      <main className="bg-[#fafafa] pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <HostWizard
            authed={user !== null}
            initialPersonal={personal}
            avatarUrl={user?.avatar}
            editId={editId}
            editDraft={editDraft}
            skipPersonal={personalComplete}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
