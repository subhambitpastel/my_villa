import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAdminToken } from "@/lib/session";

/**
 * Keeps the back office out of the marketplace.
 *
 * An admin is not a member: they moderate what other people list, book and
 * review, and must never be able to do those things themselves. Removing the
 * site header took the LINKS away, but a typed URL still reached the whole
 * guest/host site — so the boundary lives here, in front of every page at
 * once, rather than in a guard each new page could forget to add.
 *
 * This is the navigation half only. Next's own guidance is that a proxy is an
 * optimistic check, not an authorization layer, so it deliberately does NOT
 * try to police writes: server actions carry their own refusal (see
 * `denyAdmin` in actions.ts), which is what actually stops a forged request.
 * Hence the GET/HEAD narrowing below — a POST is a write, and writes are
 * answered by the action itself, with a message, instead of being bounced to
 * a page that can't handle the method.
 */
export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Signed out, or signed in as a member: the site is theirs.
  if (!token || !(await isAdminToken(token))) return NextResponse.next();

  // The one place an admin belongs. `/admin` itself is outside the matcher,
  // so this can't loop.
  const url = request.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the back office, the APIs (which authorize themselves,
  // and would choke on an HTML redirect), and static assets.
  matcher: [
    "/((?!admin|api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|images/|icons/|fonts/).*)",
  ],
};
