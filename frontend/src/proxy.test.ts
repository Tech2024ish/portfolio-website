// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "./proxy";

const HEADER = "x-trusted-proxy-secret";
const FORWARDED = `x-middleware-request-${HEADER}`;

function run(headers: Record<string, string> = {}) {
  return proxy(new NextRequest("https://site.test/api/v1/contact", { method: "POST", headers }));
}

afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("adds the configured secret to the request sent to the API", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", "server-side-secret");
    expect(run().headers.get(FORWARDED)).toBe("server-side-secret");
  });

  it("replaces a value sent by the visitor", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", "server-side-secret");
    expect(run({ [HEADER]: "forged" }).headers.get(FORWARDED)).toBe("server-side-secret");
  });

  it("removes a visitor's value when no secret is configured", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", "");
    const response = run({ [HEADER]: "forged" });
    expect(response.headers.get(FORWARDED)).toBeNull();
    expect(response.headers.get("x-middleware-override-headers")).not.toContain(HEADER);
  });

  it("runs only on the routes that use the visitor's address", () => {
    expect(config.matcher).toEqual([
      "/api/v1/contact",
      "/api/v1/auth/login",
      "/api/v1/analytics/pageview",
      "/api/v1/owner/diagnostics/client-address",
    ]);
  });
});
