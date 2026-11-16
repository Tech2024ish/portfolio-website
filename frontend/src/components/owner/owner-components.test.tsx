import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionSummary } from "@/lib/owner/types";
import { axeViolations } from "@/test/axe";

import { LoginForm } from "./login-form";
import { PasswordForm } from "./password-form";
import { SessionsPanel } from "./sessions-panel";

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function stubFetch(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const apiError = (status: number, code: string, message: string, fields?: unknown) =>
  json(status, { error: { code, message, ...(fields ? { fields } : {}) } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

async function submit(form: HTMLElement) {
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("LoginForm", () => {
  function fill(email: string, password: string) {
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
  }

  it("is a labelled POST form whose password field never autocompletes as a new password", () => {
    render(<LoginForm next="/owner" />);
    const form = screen.getByRole("form", { name: "Sign in" });
    expect(form).toHaveAttribute("method", "post");
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("type", "password");
  });

  it("checks for missing fields before contacting the server", async () => {
    const fetchMock = stubFetch();
    render(<LoginForm next="/owner" />);
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(screen.getByLabelText(/^email/i)).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText(/^password/i)).toHaveAccessibleDescription("Enter your password.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("goes to the requested Studio page after signing in", async () => {
    stubFetch(
      json(200, {
        user: { email: "o@example.com", display_name: "O" },
        csrf_token: "x",
        expires_at: "2026-11-16T20:00:00Z",
      }),
    );
    render(<LoginForm next="/owner/projects" />);
    fill(" o@example.com ", "Correct-Horse-9-battery");
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(router.replace).toHaveBeenCalledWith("/owner/projects");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the server's generic message, clears the password and stays on the page", async () => {
    stubFetch(apiError(401, "invalid_credentials", "The email or password is incorrect."));
    render(<LoginForm next="/owner" />);
    fill("o@example.com", "wrong");
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The email or password is incorrect.");
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("explains rate limiting and network failures", async () => {
    stubFetch(apiError(429, "rate_limited", "Too many sign-in attempts. Please wait and try again later."));
    render(<LoginForm next="/owner" />);
    fill("o@example.com", "x");
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Too many sign-in attempts");

    stubFetch(new TypeError("Failed to fetch"));
    fill("o@example.com", "x");
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/did not work|could not be reached/i);
  });

  it("tells the owner when a session has ended", () => {
    render(<LoginForm next="/owner" expired />);
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended");
  });

  it("has no accessibility violations, also with errors shown", async () => {
    const { container } = render(<LoginForm next="/owner" />);
    await submit(screen.getByRole("form", { name: "Sign in" }));
    expect(await axeViolations(container)).toEqual([]);
  });
});

const SESSIONS: SessionSummary[] = [
  {
    id: 1,
    created_at: "2026-11-16T08:00:00Z",
    last_seen_at: "2026-11-16T09:00:00Z",
    expires_at: "2026-11-16T20:00:00Z",
    ip_address: "127.0.0.1",
    user_agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36",
    current: true,
  },
  {
    id: 2,
    created_at: "2026-11-15T08:00:00Z",
    last_seen_at: "2026-11-15T09:00:00Z",
    expires_at: "2026-11-15T20:00:00Z",
    ip_address: "10.0.0.2",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/132.0",
    current: false,
  },
];

describe("SessionsPanel", () => {
  it("lists every session and marks this browser, which cannot end itself here", () => {
    render(<SessionsPanel sessions={SESSIONS} csrfToken="csrf" />);
    const items = within(screen.getByRole("list", { name: "Active sessions" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("This browser")).toBeInTheDocument();
    expect(within(items[0]!).queryByRole("button")).not.toBeInTheDocument();
    expect(
      within(items[1]!).getByRole("button", { name: /end the session on firefox on macos/i }),
    ).toBeInTheDocument();
  });

  it("ends another session with the CSRF token and refreshes", async () => {
    const fetchMock = stubFetch(json(204, null));
    render(<SessionsPanel sessions={SESSIONS} csrfToken="csrf-1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /end the session/i }));
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/sessions/2");
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("csrf-1");
    expect(screen.getByRole("status")).toHaveTextContent("The session was ended.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("sends the owner to sign in when the session has already ended", async () => {
    stubFetch(apiError(401, "unauthorized", "Sign in to continue."));
    render(<SessionsPanel sessions={SESSIONS} csrfToken="csrf" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /end the session/i }));
    });
    expect(router.replace).toHaveBeenCalledWith("/owner/login?next=%2Fowner&reason=expired");
  });

  it("asks before signing out every other session", async () => {
    const fetchMock = stubFetch(json(200, { revoked: 1 }));
    render(<SessionsPanel sessions={SESSIONS} csrfToken="csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out all other sessions" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign them out", hidden: true }));
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/auth/sessions/revoke-others");
    expect(screen.getByRole("status")).toHaveTextContent("1 other session(s) ended.");
  });

  it("says when no other session is active", () => {
    render(<SessionsPanel sessions={[SESSIONS[0]!]} csrfToken="csrf" />);
    expect(screen.getByText("No other session is active.")).toBeInTheDocument();
  });
});

describe("PasswordForm", () => {
  function fill(current: string, next: string, confirm = next) {
    fireEvent.change(screen.getByLabelText(/^current password/i), { target: { value: current } });
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/^repeat the new password/i), { target: { value: confirm } });
  }

  it("catches obvious mistakes before contacting the server", async () => {
    const fetchMock = stubFetch();
    render(<PasswordForm csrfToken="csrf" />);
    fill("", "short", "different");
    await submit(screen.getByRole("form", { name: "Change password" }));
    expect(screen.getByLabelText(/^current password/i)).toHaveAccessibleDescription(
      "Enter your current password.",
    );
    expect(screen.getByLabelText(/^repeat the new password/i)).toHaveAccessibleDescription(
      "The new passwords do not match.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's verdict on the right field", async () => {
    stubFetch(
      apiError(400, "invalid_password", "The current password is incorrect.", [
        { field: "current_password", message: "The current password is incorrect." },
      ]),
    );
    render(<PasswordForm csrfToken="csrf" />);
    fill("wrong-current-1", "Another-Strong-7-phrase");
    await submit(screen.getByRole("form", { name: "Change password" }));
    expect(screen.getByLabelText(/^current password/i)).toHaveAccessibleDescription(
      "The current password is incorrect.",
    );
  });

  it("confirms the change, clears the fields and sends the CSRF token", async () => {
    const fetchMock = stubFetch(json(204, null));
    render(<PasswordForm csrfToken="csrf-9" />);
    fill("Correct-Horse-9-battery", "Another-Strong-7-phrase");
    await submit(screen.getByRole("form", { name: "Change password" }));
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("X-CSRF-Token")).toBe("csrf-9");
    expect(screen.getByRole("status")).toHaveTextContent("Every other session was signed out.");
    expect(screen.getByLabelText(/^current password/i)).toHaveValue("");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PasswordForm csrfToken="csrf" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
