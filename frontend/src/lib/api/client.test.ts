import { describe, expect, it, vi } from "vitest";

import { ApiError, buildUrl, createApiClient } from "./client";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    status: init.status ?? 200,
  });

describe("buildUrl", () => {
  it("joins base, path and defined query parameters", () => {
    expect(buildUrl("/api/v1/public/projects", { page: 2, q: "api", tag: undefined }, "https://x.dev")).toBe(
      "https://x.dev/api/v1/public/projects?page=2&q=api",
    );
  });

  it("refuses paths outside the API surface", () => {
    expect(() => buildUrl("https://evil.example/steal", undefined, "")).toThrow(/must start with \/api\//);
  });
});

describe("createApiClient", () => {
  it("returns parsed JSON for successful responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }));
    const client = createApiClient(fetcher, "http://api.test");

    await expect(client.get<{ status: string }>("/health")).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("serialises JSON bodies with the right content type", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }, { status: 201 }));
    const client = createApiClient(fetcher, "");

    await client.post("/api/v1/contact", { name: "Ada" });
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"name":"Ada"}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("returns undefined for 204 No Content", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(createApiClient(fetcher, "").delete("/api/v1/x/1")).resolves.toBeUndefined();
  });

  it("maps the backend error envelope to ApiError with field errors and request id", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "invalid",
            message: "Check the highlighted fields.",
            fields: [{ field: "email", message: "Enter a valid email address." }],
          },
        },
        { status: 422, headers: { "X-Request-ID": "req-123" } },
      ),
    );

    const error = await createApiClient(fetcher, "")
      .post("/api/v1/contact", {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "invalid",
      message: "Check the highlighted fields.",
      fields: [{ field: "email", message: "Enter a valid email address." }],
      requestId: "req-123",
    });
  });

  it("falls back to a generic error for non-JSON failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(createApiClient(fetcher, "").get("/api/v1/x")).rejects.toMatchObject({
      status: 502,
      code: "http_error",
      fields: [],
    });
  });

  it("reports network failures without leaking internals", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED 10.0.0.5:8000"));
    const error = await createApiClient(fetcher, "")
      .get("/api/v1/x")
      .catch((caught: unknown) => caught as ApiError);
    expect(error).toMatchObject({ status: 0, code: "network_error" });
    expect((error as ApiError).message).not.toContain("10.0.0.5");
  });
});
