// Helpers for the ?next= return-URL used by auth redirects. Only same-site
// paths are honoured so the parameter can't be abused as an open redirect.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
