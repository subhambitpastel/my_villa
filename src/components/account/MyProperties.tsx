"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteVillaAction } from "@/lib/actions";
import type { PropertyItem } from "@/lib/queries";
import { Star } from "@/components/home/sections";

export default function MyProperties({
  properties,
}: {
  properties: PropertyItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(id: number) {
    startTransition(async () => {
      await deleteVillaAction(id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line/60 bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#121212]">Property Owned</h2>
        <Link
          href="/host"
          className="rounded-[8px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Add Property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-base font-semibold text-ink">No properties yet</p>
          <p className="mt-1 text-sm text-body">
            Register your villa and it will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {properties.map((p) => (
            <li
              key={p.id}
              className="flex gap-4 overflow-hidden rounded-[6px] bg-white shadow-[0px_4px_14px_0px_rgba(0,0,0,0.09)] sm:gap-5"
            >
              <div className="relative h-[132px] w-28 shrink-0 overflow-hidden rounded-l-[6px] sm:w-[135px]">
                <Image
                  src={p.image}
                  alt={`${p.name}, ${p.city}`}
                  fill
                  sizes="135px"
                  className="object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-3">
                <h3 className="truncate text-[15px] font-semibold text-heading">
                  {p.name}, <span className="text-purple">{p.city}</span>
                </h3>
                <p className="mt-0.5 text-[13px] font-semibold text-heading">
                  ${p.price}/night
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-purple">
                  {p.reviews > 0 ? (
                    <>
                      <Star size={12} /> {p.rating} ({p.reviews})
                    </>
                  ) : (
                    <span className="rounded bg-[#e9e8fd] px-1.5 py-0.5">New listing</span>
                  )}
                </p>
                <p className="mt-auto">
                  <span className="rounded-[3px] bg-[#e9e8fd] px-2 py-1 text-[10px] text-brand">
                    {p.posted}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between px-4 py-3">
                <Link
                  href={`/host?edit=${p.id}`}
                  className="text-[13px] font-medium text-[#121212] underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(p.id)}
                  className="text-[13px] font-medium text-[#eb8ba9] underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
