import Link from "next/link";
import type { VillaDetail } from "@/lib/queries";
import { isRoomBased } from "@/lib/rooms";

/** One labelled row in the read-only details list. Mirrors a single edit field
 *  from the host wizard, so an owner sees exactly what a save would change. */
function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-[12px] font-medium uppercase tracking-wide text-[#9d9da6]">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] leading-relaxed text-heading">{children}</dd>
    </div>
  );
}

/** A muted "—" for a field the owner hasn't filled in, so a blank never reads
 *  as a rendering bug. */
const Empty = () => <span className="text-[#b5b5bd]">Not set</span>;

/** Section heading inside the details card. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 text-[15px] font-semibold text-brand first:mt-0">
      {children}
    </h3>
  );
}

/**
 * Read-only view of a villa, showing the same fields the edit wizard collects —
 * so an owner can review a listing's settings without opening the editor (which
 * a live booking can freeze). Purely presentational: everything comes straight
 * from the villa row, no mutation path.
 */
export default function PropertyView({
  villa,
  editable,
}: {
  villa: VillaDetail;
  /** False when live bookings freeze editing — the Edit button then explains
   *  itself instead of leading to the locked notice. */
  editable: boolean;
}) {
  const roomBased = isRoomBased(villa.kind);
  const netPrice =
    villa.discount > 0
      ? Math.round(villa.price * (1 - villa.discount / 100))
      : villa.price;

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      {/* Breadcrumb back to the list this was opened from. */}
      <Link
        href="/profile/properties"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand transition-colors hover:text-brand-dark"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        My Properties
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold text-heading">
            {villa.name}
            {villa.city ? (
              <>
                , <span className="text-purple">{villa.city}</span>
              </>
            ) : null}
          </h2>
          <span className="mt-1.5 inline-block rounded-[3px] bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
            {villa.kind}
          </span>
        </div>
        {/* Edit is frozen while guests hold live bookings — same rule as the
            list and the /host route, so this button can't dead-end there. */}
        {editable ? (
          <Link
            href={`/host?edit=${villa.id}`}
            className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Edit listing
          </Link>
        ) : (
          <span
            title="This listing has active bookings, so its details are frozen until those stays finish."
            className="rounded-[8px] border border-[#e8d5a3] bg-[#fdf9f0] px-4 py-2 text-[13px] font-semibold text-[#a06a00]"
          >
            Editing locked
          </span>
        )}
      </div>

      {/* Photos — the same gallery the wizard's image step manages. Plain <img>
          (not next/image) because runtime uploads are served from /api/images
          and share the wizard's handling. */}
      {villa.gallery.length > 0 && (
        <>
          <SectionTitle>Photos</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {villa.gallery.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${src}-${i}`}
                src={src}
                alt={`${villa.name} photo ${i + 1}`}
                className="h-32 w-full rounded-[6px] object-cover"
              />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Details</SectionTitle>
      <dl className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Property type">{villa.kind}</Field>
        <Field label="Name">{villa.name || <Empty />}</Field>
        <Field label="City">{villa.city || <Empty />}</Field>
        <Field label="Villa dimensions">
          {villa.area ? `${villa.area} sq. yards` : <Empty />}
        </Field>
        <Field label="Address" full>
          {villa.address || <Empty />}
        </Field>
        <Field label="Description" full>
          {villa.description ? (
            <span className="whitespace-pre-line">{villa.description}</span>
          ) : (
            <Empty />
          )}
        </Field>
        <Field label="Number of rooms">{villa.rooms || <Empty />}</Field>
        {roomBased ? (
          <Field label="Guests per room">
            {villa.people_per_room || <Empty />}
            {villa.people_per_room && villa.rooms ? (
              <span className="ml-2 text-[12px] text-body">
                (sleeps up to {villa.people_per_room * villa.rooms} in total)
              </span>
            ) : null}
          </Field>
        ) : (
          <Field label="Maximum guests">{villa.max_guests || <Empty />}</Field>
        )}
        <Field label="Max booking days per guest">
          {villa.max_booking_days > 0 ? (
            `${villa.max_booking_days} night${villa.max_booking_days === 1 ? "" : "s"}`
          ) : (
            <span className="text-body">No limit</span>
          )}
        </Field>
      </dl>

      <SectionTitle>Pricing</SectionTitle>
      <dl className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Price per night">
          {villa.discount > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">${netPrice}</span>
              <span className="text-[12px] text-[#9d9da6] line-through">
                ${villa.price}
              </span>
              <span className="rounded-[3px] bg-[#fdecec] px-1.5 py-0.5 text-[11px] font-semibold text-[#eb5757]">
                {villa.discount}% off
              </span>
            </span>
          ) : (
            <span className="font-semibold">${villa.price}</span>
          )}
        </Field>
        <Field label="Discount">
          {villa.discount > 0 ? `${villa.discount}% off` : <span className="text-body">None</span>}
        </Field>
      </dl>

      <SectionTitle>Facilities</SectionTitle>
      {villa.facilityList.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {villa.facilityList.map((f) => (
            <span
              key={f}
              className="rounded-[4px] bg-[#f4f4f8] px-3 py-1.5 text-[13px] text-heading"
            >
              {f}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-body">No facilities added.</p>
      )}

      <SectionTitle>Extra services</SectionTitle>
      {villa.serviceList.length > 0 ? (
        <ul className="mt-3 divide-y divide-line/60 rounded-[8px] border border-line/60">
          {villa.serviceList.map((s) => (
            <li
              key={s.name}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
            >
              <span className="text-heading">{s.name}</span>
              {s.price > 0 ? (
                <span className="font-semibold text-heading">${s.price}</span>
              ) : (
                <span className="rounded-[3px] bg-[#e9f7ee] px-2 py-0.5 text-[11px] font-semibold text-[#1f9d55]">
                  Free
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-body">No extra services added.</p>
      )}
    </div>
  );
}
