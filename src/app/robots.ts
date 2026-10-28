import type { MetadataRoute } from "next";

// API routes, the town search and typed-in towns (their slugs contain "~") stay out of crawls.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/find", "/*~", "/*%7E"] }],
  };
}
