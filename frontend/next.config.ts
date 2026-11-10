import type { NextConfig } from "next";

/**
 * FastAPI is the only backend. Next.js proxies `/api/*` to it so the owner session
 * cookie stays first-party (SameSite=Strict) without a second backend in Next.js.
 *
 * API_ORIGIN is read at build/start time on the server only and is never sent to the browser.
 */
const apiOrigin = (process.env.API_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // A full Content-Security-Policy is added and verified in Phase 11.
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
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
