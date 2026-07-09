// Minimal email transport. Server-side only.
//
// There's no real mail provider wired up yet, so in development (and any
// environment without one configured) messages are logged to the server
// console — that keeps flows like password reset fully testable. To send real
// mail in production, implement the SMTP/provider branch below and set the
// relevant env vars; the rest of the app calls `sendEmail` and doesn't care.
import { headers } from "next/headers";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(msg: EmailMessage): Promise<void> {
  // Future: if (process.env.SMTP_URL) { ...real provider send...; return; }
  // Dev/no-provider fallback — visible in the server console.
  console.log(
    `\n──────── EMAIL (dev console transport) ────────\n` +
      `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n` +
      `───────────────────────────────────────────────\n`,
  );
}

/** Absolute base URL for links in emails (honours proxy headers). */
export async function appBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
