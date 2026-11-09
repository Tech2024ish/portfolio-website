/**
 * Public, non-secret site configuration. Safe in both server and client bundles.
 * NEXT_PUBLIC_SITE_URL is the canonical origin used for metadata and canonical URLs.
 */
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const siteName = "Jean Claude Ishimwe";
export const siteTitle = "Jean Claude Ishimwe — Backend Software Engineer";
export const siteDescription =
  "Backend Software Engineer in Kigali, Rwanda, building reliable APIs, database-driven applications and maintainable software systems with Python, FastAPI and PostgreSQL.";
