import { afterEach, describe, expect, it, vi } from "vitest";

import { describeDevice, formatUtc, ownerActions, signIn } from "./actions";
import { loginUrl, safeNext } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("safeNext (open-redirect protection)", () => {
  it("keeps Owner Studio paths", () => {
    expect(safeNext("/owner")).toBe("/owner");
    expect(safeNext("/owner/projects?draft=1")).toBe("/owner/projects?draft=1");
  });

  it("falls back to the Studio for anything else", () => {
    for (const next of [
      undefined,
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/owner//evil.example",
      "/\\evil.example",
      "/ownerevil",
      "/owner\\..\\evil",
      "/",
      "/projects",
      "/owner/login",
      "javascript:alert(1)",
      "/owner\n/evil",
    ]) {
      expect(safeNext(next), String(next)).toBe("/owner");
    }
    expect(safeNext(["/owner/a", "/owner/b"])).toBe("/owner/a");
  });

  it("builds sign-in URLs that return to a safe page", () => {
    expect(loginUrl()).toBe("/owner/login?next=%2Fowner");
    expect(loginUrl("https://evil.example", "expired")).toBe("/owner/login?next=%2Fowner&reason=expired");
  });
});

describe("owner requests", () => {
  function stubFetch(status = 204, body: unknown = null) {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("send the CSRF token with every state-changing request", async () => {
    const fetchMock = stubFetch();
    const actions = ownerActions("csrf-123");
    await actions.signOut();
    await actions.revokeSession(7);
    await actions.changePassword("old", "new");
    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url,
      method: init.method,
      csrf: new Headers(init.headers).get("X-CSRF-Token"),
    }));
    expect(calls).toEqual([
      { url: "/api/v1/auth/logout", method: "POST", csrf: "csrf-123" },
      { url: "/api/v1/auth/sessions/7", method: "DELETE", csrf: "csrf-123" },
      { url: "/api/v1/auth/password", method: "POST", csrf: "csrf-123" },
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toEqual({
      current_password: "old",
      new_password: "new",
    });
  });

  it("revoke other sessions with the CSRF token", async () => {
    const fetchMock = stubFetch(200, { revoked: 2 });
    expect(await ownerActions("t").revokeOtherSessions()).toEqual({ revoked: 2 });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("X-CSRF-Token")).toBe("t");
  });

  it("sign in with a same-origin JSON request", async () => {
    const fetchMock = stubFetch(200, {
      user: { email: "o@example.com", display_name: "O" },
      csrf_token: "x",
      expires_at: "2026-01-01T00:00:00Z",
    });
    await signIn("o@example.com", "secret");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/login");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "o@example.com", password: "secret" });
  });
});

describe("display helpers", () => {
  it("describes common browsers and systems", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(describeDevice("curl/8.0")).toBe("Unknown device");
  });

  it("formats timestamps in UTC so server and browser render the same text", () => {
    expect(formatUtc("2026-11-16T09:05:00Z")).toBe("16 Nov 2026, 09:05 UTC");
  });
});
