import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification of the signed request FastAPI sends after a content change
 * (backend: app/integrations/revalidate.py). The body is
 * `{"tags": [...], "timestamp": <unix seconds>, "nonce": "<hex>"}` and the header
 * `X-Revalidate-Signature: sha256=<HMAC-SHA256 of the raw body>` with REVALIDATE_SIGNING_SECRET.
 *
 * A request is accepted only when the signature matches, the timestamp is within five minutes,
 * the nonce has not been seen in that window (on this server instance) and every tag is allowed.
 * The worst a replay can do is clear the content cache once more.
 */
export const SIGNATURE_HEADER = "x-revalidate-signature";
export const ALLOWED_TAGS = new Set(["content"]);
export const MAX_AGE_SECONDS = 300;
const MAX_BODY_BYTES = 1024;

export type Verdict = { ok: true; tags: string[] } | { ok: false; status: 400 | 401; reason: string };

const seen = new Map<string, number>();

function rememberNonce(nonce: string, now: number): boolean {
  for (const [key, expires] of seen) if (expires <= now) seen.delete(key);
  if (seen.has(nonce)) return false;
  seen.set(nonce, now + MAX_AGE_SECONDS);
  return true;
}

export function signBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function signatureMatches(secret: string, body: string, header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(signBody(secret, body));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function verifyRevalidation(
  secret: string,
  body: string,
  signature: string | null,
  now = Math.floor(Date.now() / 1000),
): Verdict {
  if (body.length > MAX_BODY_BYTES) return { ok: false, status: 400, reason: "too large" };
  // The signature is checked before the body is trusted for anything.
  if (!signatureMatches(secret, body, signature)) return { ok: false, status: 401, reason: "signature" };

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, reason: "json" };
  }
  const { tags, timestamp, nonce } = (data ?? {}) as Record<string, unknown>;
  if (typeof timestamp !== "number" || Math.abs(now - timestamp) > MAX_AGE_SECONDS) {
    return { ok: false, status: 401, reason: "stale" };
  }
  if (typeof nonce !== "string" || !/^[0-9a-f]{16,64}$/.test(nonce)) {
    return { ok: false, status: 400, reason: "nonce" };
  }
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    !tags.every((tag): tag is string => typeof tag === "string" && ALLOWED_TAGS.has(tag))
  ) {
    return { ok: false, status: 400, reason: "tags" };
  }
  if (!rememberNonce(nonce, now)) return { ok: false, status: 401, reason: "replay" };
  return { ok: true, tags };
}
