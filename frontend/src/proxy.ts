import { NextResponse, type NextRequest } from "next/server";

/**
 * Marks the API requests that came through this site, so FastAPI can trust their X-Forwarded-For.
 *
 * Runs only on the routes that use the visitor's address. Everything else, large media uploads
 * included, keeps going straight through the rewrite in next.config.ts. The secret is added to the
 * request sent to the API and is never returned to the browser.
 */
const PROXY_SECRET_HEADER = "x-trusted-proxy-secret";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PROXY_SECRET_HEADER); // never forward a value the visitor sent
  const secret = process.env.TRUSTED_PROXY_SECRET?.trim();
  if (secret) headers.set(PROXY_SECRET_HEADER, secret);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/api/v1/contact",
    "/api/v1/auth/login",
    "/api/v1/analytics/pageview",
    "/api/v1/owner/diagnostics/client-address",
  ],
};
