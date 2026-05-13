import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/brief", "/demo", "/terms", "/privacy"],
        disallow: ["/app", "/api", "/welcome", "/login", "/logout"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
