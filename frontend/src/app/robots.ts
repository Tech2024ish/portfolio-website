import type { MetadataRoute } from "next";

import { absoluteUrl, allowIndexing, siteUrl } from "@/lib/site";

/**
 * /robots.txt. The public portfolio is crawlable; the Owner Studio, the API proxy and the
 * development styleguide are not (they also send noindex). Preview deployments disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/owner", "/api/", "/styleguide"] },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl.origin,
  };
}
