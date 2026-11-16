import { revalidateTag } from "next/cache";

import { SIGNATURE_HEADER, verifyRevalidation } from "@/lib/content/revalidate";

/**
 * POST /api/revalidate: FastAPI asks the site to refresh cached content after the owner changes
 * it. Only signed requests are accepted (see src/lib/content/revalidate.ts), and they can only
 * clear the `content` cache tag. Without REVALIDATE_SIGNING_SECRET the route does not exist.
 *
 * This route handler takes precedence over the `/api/*` rewrite to FastAPI in next.config.ts
 * (rewrites returned as an array run after the app's own routes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    return json(404, { error: { code: "not_found", message: "Not found." } });

  const verdict = verifyRevalidation(secret, await request.text(), request.headers.get(SIGNATURE_HEADER));
  if (!verdict.ok) {
    // The reason is for the server log only; the caller learns nothing more than the status.
    console.warn(`revalidation refused: ${verdict.reason}`);
    return json(verdict.status, { error: { code: "refused", message: "Request refused." } });
  }
  for (const tag of verdict.tags) revalidateTag(tag, { expire: 0 });
  return json(200, { revalidated: verdict.tags });
}
