import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://wazenlyapp.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/contact", "/privacy", "/terms"],
      disallow: ["/dashboard", "/auth", "/invite", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
