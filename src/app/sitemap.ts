import type { MetadataRoute } from "next";
import { getCatalogVillas } from "@/lib/queries";

// Generated on-demand at request time, not at build: it queries Postgres, which
// isn't reachable during `next build` on a fresh host (Railway, etc.).
export const dynamic = "force-dynamic";

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/villas",
    "/search",
    "/packages",
    "/promotions",
    "/help",
    "/about",
    "/blog",
    "/terms",
    "/privacy",
    "/login",
    "/register",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const villas = (await getCatalogVillas(50)).map((v) => ({
    url: `${base}/place?id=${v.id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...villas];
}
