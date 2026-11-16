import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OwnerSessionResult } from "@/lib/owner/session";

const state: { session: OwnerSessionResult; data: Record<string, unknown> | Error } = {
  session: { status: "signed-out" },
  data: {},
};

class OwnerApiUnavailableError extends Error {}

vi.mock("@/lib/owner/session", () => ({
  OwnerApiUnavailableError,
  getOwnerSession: async () => state.session,
  ownerGet: async (path: string) => {
    if (state.data instanceof Error) throw state.data;
    return state.data[path];
  },
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

const { default: OwnerStudioPage } = await import("./page");
const { default: LoginPage } = await import("./login/page");

const SESSION = {
  user: { email: "owner@example.com", display_name: "Jean Claude" },
  csrf_token: "csrf",
  expires_at: "2026-11-16T20:00:00Z",
};

beforeEach(() => {
  state.session = { status: "signed-out" };
  state.data = {
    "/api/v1/owner/overview": { messages: { new: 3, read: 1, archived: 0 } },
    "/api/v1/auth/sessions": [
      {
        id: 1,
        created_at: "2026-11-16T08:00:00Z",
        last_seen_at: "2026-11-16T09:00:00Z",
        expires_at: "2026-11-16T20:00:00Z",
        ip_address: "127.0.0.1",
        user_agent: null,
        current: true,
      },
    ],
  };
});

describe("/owner", () => {
  it("sends a visitor without a verified session to sign in", async () => {
    await expect(OwnerStudioPage()).rejects.toThrow("NEXT_REDIRECT:/owner/login?next=%2Fowner");
  });

  it("shows an error, never the Studio, when the API cannot verify the session", async () => {
    state.session = { status: "unavailable" };
    render(await OwnerStudioPage());
    expect(screen.getByRole("heading", { level: 2, name: "The Studio is unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/owner@example.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("shows the unavailable state when owner data cannot be loaded", async () => {
    state.session = { status: "signed-in", session: SESSION };
    state.data = new OwnerApiUnavailableError();
    render(await OwnerStudioPage());
    expect(screen.getByRole("heading", { name: "The Studio is unavailable" })).toBeInTheDocument();
  });

  it("renders the Studio for the verified owner", async () => {
    state.session = { status: "signed-in", session: SESSION };
    render(await OwnerStudioPage());
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Jean Claude" })).toBeInTheDocument();
    const messages = screen.getByRole("region", { name: "Contact messages" });
    expect(within(messages).getByText("New").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByRole("region", { name: "Active sessions" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("/owner/login", () => {
  const props = (params: Record<string, string>) => ({ searchParams: Promise.resolve(params) });

  it("shows the sign-in form to a signed-out visitor", async () => {
    render(await LoginPage(props({})));
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends a signed-in owner on to the Studio, never to another site", async () => {
    state.session = { status: "signed-in", session: SESSION };
    await expect(LoginPage(props({ next: "/owner/projects" }))).rejects.toThrow(
      "NEXT_REDIRECT:/owner/projects",
    );
    await expect(LoginPage(props({ next: "https://evil.example" }))).rejects.toThrow("NEXT_REDIRECT:/owner");
  });

  it("says when the previous session has ended", async () => {
    render(await LoginPage(props({ reason: "expired" })));
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended");
  });
});
