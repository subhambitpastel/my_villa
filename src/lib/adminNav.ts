// The /admin dashboard's sections — one source of truth for the sidebar, the
// same way accountNav.ts drives the profile shell. Deliberately NOT a
// "use client" module so server components can read it too.

export type AdminSection = {
  label: string;
  href: string;
  /** Which live count badges this tab, if any. */
  badge?: "openCalls";
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { label: "Overview", href: "/admin" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Properties", href: "/admin/properties" },
  { label: "Packages", href: "/admin/packages" },
  { label: "Call Requests", href: "/admin/calls", badge: "openCalls" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Users", href: "/admin/users" },
  { label: "Reviews", href: "/admin/reviews" },
];
