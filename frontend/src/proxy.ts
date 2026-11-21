import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * Two jobs, chosen by path:
 *
 * 1. Languages, on public pages. Every language uses the same addresses (`/`, `/projects`): the
 *    visitor's choice, stored by the language menu in the `lang` cookie (English without one),
 *    selects the matching pre-rendered page in app/[lang] through an internal rewrite, so the URL
 *    never changes. Paths that already carry a language (`/fr/...`, and the rewritten path itself,
 *    which Next passes through the proxy again) are left alone.
 *
 * 2. Marks the API requests that came through this site, so FastAPI can trust their
 *    X-Forwarded-For. Runs only on the routes that use the visitor's address; everything else
 *    under /api, large media uploads included, goes straight through the rewrite in
 *    next.config.ts. The secret is added to the request sent to the API and never returned.
 */
const PROXY_SECRET_HEADER = "x-trusted-proxy-secret";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return markTrustedRequest(request);
  if (isLocale(pathname.split("/")[1])) return NextResponse.next();

  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  const lang = isLocale(chosen) ? chosen : DEFAULT_LOCALE;
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

function markTrustedRequest(request: NextRequest) {
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
    // Public pages: everything except Next's own files, the API, the Owner Studio, files with an
    // extension (public/ assets, robots.txt, sitemap.xml) and the generated icons.
    "/((?!_next/|api/|owner(?:/|$)|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
