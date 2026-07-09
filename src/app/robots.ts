import type { MetadataRoute } from "next";

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/account surfaces out of the index.
      disallow: ["/profile", "/payment", "/account", "/welcome", "/host"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
