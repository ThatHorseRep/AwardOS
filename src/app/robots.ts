import type { MetadataRoute } from "next";
import { getAppOrigin } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/e/"],
      disallow: [
        "/dashboard/",
        "/events/",
        "/settings/",
        "/account/",
        "/api/",
        "/invite/",
        "/embed/",
        "/e/*/vote",
        "/e/*/nominate",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
