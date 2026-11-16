import { describe, expect, it, vi } from "vitest";

import { signBody, verifyRevalidation } from "./revalidate";

const SECRET = "s".repeat(40);
const NOW = 1_800_000_000;
let counter = 0;

function request(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const body = JSON.stringify({
    tags: ["content"],
    timestamp: NOW,
    nonce: counter.toString(16).padStart(32, "0"),
    ...overrides,
  });
  return { body, signature: signBody(SECRET, body) };
}

describe("verifyRevalidation", () => {
  it("accepts a fresh, signed request for the content tag", () => {
    const { body, signature } = request();
    expect(verifyRevalidation(SECRET, body, signature, NOW)).toEqual({ ok: true, tags: ["content"] });
  });

  it("refuses a missing or wrong signature", () => {
    const { body } = request();
    expect(verifyRevalidation(SECRET, body, null, NOW)).toMatchObject({ ok: false, status: 401 });
    expect(verifyRevalidation(SECRET, body, signBody("x".repeat(40), body), NOW)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("refuses a body changed after signing", () => {
    const { signature } = request();
    const tampered = JSON.stringify({ tags: ["content"], timestamp: NOW, nonce: "f".repeat(32) });
    expect(verifyRevalidation(SECRET, tampered, signature, NOW)).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses stale requests and replays", () => {
    const stale = request({ timestamp: NOW - 301 });
    expect(verifyRevalidation(SECRET, stale.body, stale.signature, NOW)).toMatchObject({ reason: "stale" });
    const fresh = request();
    expect(verifyRevalidation(SECRET, fresh.body, fresh.signature, NOW).ok).toBe(true);
    expect(verifyRevalidation(SECRET, fresh.body, fresh.signature, NOW)).toMatchObject({ reason: "replay" });
  });

  it("only clears allowed tags", () => {
    for (const tags of [["owner"], [], "content", ["content", "x"]]) {
      const { body, signature } = request({ tags });
      expect(verifyRevalidation(SECRET, body, signature, NOW)).toMatchObject({ ok: false, reason: "tags" });
    }
  });
});

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

describe("POST /api/revalidate", () => {
  it("does not exist without a signing secret, and clears the tag for a valid request", async () => {
    const { revalidateTag } = await import("next/cache");
    const { POST } = await import("@/app/api/revalidate/route");
    vi.stubEnv("REVALIDATE_SIGNING_SECRET", "");
    const { body, signature } = request({ timestamp: Math.floor(Date.now() / 1000) });
    const call = () =>
      POST(
        new Request("http://localhost/api/revalidate", {
          method: "POST",
          body,
          headers: { "X-Revalidate-Signature": signature },
        }),
      );
    expect((await call()).status).toBe(404);

    vi.stubEnv("REVALIDATE_SIGNING_SECRET", SECRET);
    const response = await call();
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("content", { expire: 0 });
    vi.unstubAllEnvs();
  });
});
