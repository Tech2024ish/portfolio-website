import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const { getOwnerSession, ownerGet, OwnerApiUnavailableError } = await import("./session");

const SESSION = {
  user: { email: "owner@example.com", display_name: "Owner" },
  csrf_token: "csrf",
  expires_at: "2026-11-16T20:00:00Z",
};

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response.clone()),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => cookieJar.clear());
afterEach(() => vi.unstubAllGlobals());

describe("getOwnerSession", () => {
  it("is signed out without a session cookie, and never calls the API", async () => {
    const fetchMock = stubFetch(json(200, SESSION));
    cookieJar.set("unrelated", "x");
    expect(await getOwnerSession()).toEqual({ status: "signed-out" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only the session cookie and returns the verified session", async () => {
    const fetchMock = stubFetch(json(200, SESSION));
    cookieJar.set("owner_session", "token-1");
    cookieJar.set("tracking", "should-not-be-forwarded");
    expect(await getOwnerSession()).toEqual({ status: "signed-in", session: SESSION });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/session$/);
    expect(new Headers(init.headers).get("Cookie")).toBe("owner_session=token-1");
    expect(init.cache).toBe("no-store");
  });

  it("prefers the production __Host- cookie", async () => {
    const fetchMock = stubFetch(json(200, SESSION));
    cookieJar.set("__Host-owner_session", "secure-token");
    await getOwnerSession();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Cookie")).toBe("__Host-owner_session=secure-token");
  });

  it("is signed out when FastAPI rejects the session", async () => {
    stubFetch(json(401, { error: { code: "unauthorized", message: "Sign in to continue." } }));
    cookieJar.set("owner_session", "expired");
    expect(await getOwnerSession()).toEqual({ status: "signed-out" });
  });

  it("is unavailable, never signed in, when FastAPI fails or cannot be reached", async () => {
    cookieJar.set("owner_session", "token");
    stubFetch(json(503, { error: { code: "service_unavailable", message: "Down." } }));
    expect(await getOwnerSession()).toEqual({ status: "unavailable" });
    stubFetch(new TypeError("fetch failed"));
    expect(await getOwnerSession()).toEqual({ status: "unavailable" });
  });
});

describe("ownerGet", () => {
  it("redirects to sign-in when the session ended between checks", async () => {
    cookieJar.set("owner_session", "token");
    stubFetch(json(401, { error: { code: "unauthorized", message: "Sign in to continue." } }));
    await expect(ownerGet("/api/v1/owner/overview", "/owner")).rejects.toThrow(
      "NEXT_REDIRECT:/owner/login?next=%2Fowner&reason=expired",
    );
  });

  it("reports an unavailable API as such", async () => {
    cookieJar.set("owner_session", "token");
    stubFetch(json(500, {}));
    await expect(ownerGet("/api/v1/owner/overview", "/owner")).rejects.toBeInstanceOf(
      OwnerApiUnavailableError,
    );
  });

  it("returns the data with the session cookie forwarded", async () => {
    cookieJar.set("owner_session", "token");
    const fetchMock = stubFetch(json(200, { messages: { new: 1, read: 0, archived: 0 } }));
    expect(await ownerGet("/api/v1/owner/overview", "/owner")).toEqual({
      messages: { new: 1, read: 0, archived: 0 },
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Cookie")).toBe("owner_session=token");
  });
});
