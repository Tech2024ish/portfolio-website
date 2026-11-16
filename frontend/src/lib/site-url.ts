// The canonical site origin, resolved once at build time (used by next.config.ts).
//
// 1. NEXT_PUBLIC_SITE_URL, when set (the custom domain, for example).
// 2. On Vercel, the project's production domain (VERCEL_PROJECT_PRODUCTION_URL, set by Vercel for
//    every build). Preview deployments use it too, so their canonical URLs point at production.
// 3. http://localhost:3000 for local development.
//
// Without this, a production build with no NEXT_PUBLIC_SITE_URL would publish localhost canonical
// and Open Graph URLs.

type Env = Record<string, string | undefined>;

export function resolveSiteUrl(env: Env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit).origin;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel.replace(/^https?:\/\//, "")}`).origin;
  return "http://localhost:3000";
}

/**
 * Whether search engines may index this deployment: only the production deployment (and local
 * production builds, which are not reachable from the web). Vercel previews are never indexed.
 */
export function indexable(env: Env): boolean {
  return !env.VERCEL_ENV || env.VERCEL_ENV === "production";
}
