import type { NextConfig } from "next";

import { indexable, resolveSiteUrl } from "./src/lib/site-url";

/**
 * FastAPI is the only backend. Next.js proxies `/api/*` to it so the owner session
 * cookie stays first-party (SameSite=Strict) without a second backend in Next.js.
 *
 * API_ORIGIN is read at build/start time on the server only and is never sent to the browser.
 */
const apiOrigin = (process.env.API_ORIGIN ?? "http://127.0.0.1:8100").replace(/\/+$/, "");

// Canonical origin and indexing rule, decided once at build time (see src/lib/site-url.ts).
const siteUrl = resolveSiteUrl(process.env);
const allowIndexing = indexable(process.env);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // A full Content-Security-Policy is added and verified with production deployment (Phase 11).
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Inlined into every bundle, so metadata, structured data and the sitemap agree on one origin.
  env: { NEXT_PUBLIC_SITE_URL: siteUrl, NEXT_PUBLIC_ALLOW_INDEXING: allowIndexing ? "true" : "false" },
  images: {
    // AVIF first (smallest), WebP as the fallback; the original format only for old browsers.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Files in /public keep their names when they change, so they are cached for a day, not forever.
      {
        source: "/:file(ishimwe-jean-claude\\.png|Resume\\.pdf)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      // The API proxy is never indexed (robots.txt also disallows it).
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Preview deployments are never indexed.
      ...(allowIndexing
        ? []
        : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]),
      // Owner pages must never be stored by any shared or browser cache.
      {
        source: "/owner/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
