/**
 * Public, non-secret site configuration. Safe in both server and client bundles.
 * NEXT_PUBLIC_SITE_URL is the canonical origin used for metadata, canonical URLs, structured data
 * and the sitemap. next.config.ts always sets it at build time (src/lib/site-url.ts).
 */
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

/** False on preview deployments: robots.txt then disallows everything. */
export const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "false";

/** An absolute URL on the canonical origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export const siteName = "Jean Claude Ishimwe";
export const siteTitle = "Jean Claude Ishimwe — Backend Software Engineer";
export const siteDescription =
  "Backend Software Engineer in Kigali, Rwanda, building reliable APIs, database-driven applications and maintainable software systems with Python, FastAPI and PostgreSQL.";
