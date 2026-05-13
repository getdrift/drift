import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/demo", "/waitlist"], disallow: ["/app", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
