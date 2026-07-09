import type { MetadataRoute } from "next";
import { getCatalogVillas } from "@/lib/queries";

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
