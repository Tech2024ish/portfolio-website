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

  it("marks only the API routes that use the visitor's address", () => {
    const api = config.matcher.filter((pattern) => pattern.startsWith("/api/"));
    expect(api).toEqual([
      "/api/v1/contact",
      "/api/v1/auth/login",
      "/api/v1/analytics/pageview",
      "/api/v1/owner/diagnostics/client-address",
    ]);
  });
});

describe("languages", () => {
  const page = (path: string, lang?: string) =>
    proxy(
      new NextRequest(`https://site.test${path}`, {
        headers: lang ? { cookie: `lang=${lang}` } : {},
      }),
    );
  const rewrite = (path: string, lang?: string) => page(path, lang).headers.get("x-middleware-rewrite");
  const pagesPattern = new RegExp(`^${config.matcher.at(-1)!}$`);

  it("serves English without a choice, at the same address", () => {
    expect(rewrite("/")).toBe("https://site.test/en");
    expect(rewrite("/projects/mosaic?x=1")).toBe("https://site.test/en/projects/mosaic?x=1");
  });

  it("serves the chosen language at the same address", () => {
    expect(rewrite("/", "fr")).toBe("https://site.test/fr");
    expect(rewrite("/projects", "rw")).toBe("https://site.test/rw/projects");
    for (const path of ["/", "/projects"]) expect(page(path, "fr").headers.get("location")).toBeNull();
  });

  it("ignores an unknown or forged language choice", () => {
    expect(rewrite("/", "de")).toBe("https://site.test/en");
    expect(rewrite("/", "../owner")).toBe("https://site.test/en");
  });

  it("leaves paths that already carry a language alone (Next runs the proxy again on its rewrite)", () => {
    for (const path of ["/en", "/fr/projects", "/rw"]) {
      const response = page(path, "fr");
      expect(response.headers.get("x-middleware-rewrite"), path).toBeNull();
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("leaves Next's files, the API, the Studio and static files alone", () => {
    for (const path of [
      "/_next/static/x.js",
      "/api/v1/public/portfolio",
      "/owner",
      "/owner/messages",
      "/robots.txt",
      "/sitemap.xml",
      "/Resume.pdf",
      "/ishimwe-jean-claude.png",
    ]) {
      expect(pagesPattern.test(path), path).toBe(false);
    }
    for (const path of ["/", "/projects", "/projects/mosaic", "/owners-guide", "/opengraph-image"]) {
      expect(pagesPattern.test(path), path).toBe(true);
    }
  });
});
