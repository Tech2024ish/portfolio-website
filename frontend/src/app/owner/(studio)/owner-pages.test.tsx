import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROJECT_FIXTURE } from "@/lib/owner/fixtures";
import type { OwnerSessionResult } from "@/lib/owner/session";

const state: { session: OwnerSessionResult; data: Record<string, unknown> | Error } = {
  session: { status: "signed-out" },
  data: {},
};

class OwnerApiUnavailableError extends Error {}

function loginUrl(path: string) {
  return `/owner/login?next=${encodeURIComponent(path)}`;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/owner/session", () => ({
  OwnerApiUnavailableError,
  getOwnerSession: async () => state.session,
  studioSession: async (path: string) => {
    if (state.session.status === "signed-out") throw new Error(`NEXT_REDIRECT:${loginUrl(path)}`);
    return state.session.status === "signed-in" ? state.session.session : null;
  },
  ownerGet: async (path: string) => {
    if (state.data instanceof Error) throw state.data;
    return state.data[path];
  },
  ownerFind: async (path: string) => {
    if (state.data instanceof Error) throw state.data;
    return state.data[path] ?? null;
  },
}));
const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
  useRouter: () => router,
  usePathname: () => "/owner/content/projects",
}));

const { default: OwnerStudioPage } = await import("./page");
const { default: SecurityPage } = await import("./security/page");
const { default: CollectionPage } = await import("./content/[collection]/page");
const { default: EditItemPage } = await import("./content/[collection]/[id]/page");
const { default: PreviewPage } = await import("./content/[collection]/[id]/preview/page");
const { default: LoginPage } = await import("../login/page");

const SESSION = {
  user: { email: "owner@example.com", display_name: "Jean Claude" },
  csrf_token: "csrf",
  expires_at: "2026-11-16T20:00:00Z",
};

const params = (collection: string, id?: string) => ({
  params: Promise.resolve({ collection, id: id ?? "" }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  state.session = { status: "signed-out" };
  state.data = {
    "/api/v1/owner/dashboard": {
      messages: { new: 3, read: 1, archived: 0 },
      content: { projects: { draft: 2, published: 2 }, articles: { draft: 0, published: 0 } },
      recent_messages: [],
      recent_activity: [
        {
          id: 1,
          created_at: "2026-11-16T09:00:00Z",
          action: "import",
          entity_type: "content",
          entity_id: null,
          summary: "Imported the verified portfolio content",
          changed_fields: [],
        },
      ],
    },
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
    "/api/v1/owner/projects": [PROJECT_FIXTURE],
    "/api/v1/owner/projects/7": PROJECT_FIXTURE,
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
  });

  it("shows the unavailable state when owner data cannot be loaded", async () => {
    state.session = { status: "signed-in", session: SESSION };
    state.data = new OwnerApiUnavailableError();
    render(await OwnerStudioPage());
    expect(screen.getByRole("heading", { name: "The Studio is unavailable" })).toBeInTheDocument();
  });

  it("renders the dashboard for the verified owner", async () => {
    state.session = { status: "signed-in", session: SESSION };
    render(await OwnerStudioPage());
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Jean Claude" })).toBeInTheDocument();
    const messages = screen.getByRole("region", { name: "Contact messages" });
    expect(within(messages).getByText("New").nextElementSibling).toHaveTextContent("3");
    const content = screen.getByRole("region", { name: "Content" });
    expect(within(content).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/owner/content/projects",
    );
    expect(within(content).getByText("2 published · 2 drafts")).toBeInTheDocument();
    expect(screen.getByText("Imported the verified portfolio content")).toBeInTheDocument();
  });
});

describe("Studio pages", () => {
  it("keeps sessions and the password form on the security page", async () => {
    state.session = { status: "signed-in", session: SESSION };
    render(await SecurityPage());
    expect(screen.getByRole("region", { name: "Active sessions" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Change password" })).toBeInTheDocument();
  });

  it("redirects every content page to sign in, back to the same page", async () => {
    await expect(CollectionPage(params("projects"))).rejects.toThrow(
      `NEXT_REDIRECT:${loginUrl("/owner/content/projects")}`,
    );
    await expect(EditItemPage(params("projects", "7"))).rejects.toThrow(
      `NEXT_REDIRECT:${loginUrl("/owner/content/projects/7")}`,
    );
  });

  it("answers 404 for unknown collections and malformed ids, before loading anything", async () => {
    state.session = { status: "signed-in", session: SESSION };
    await expect(CollectionPage(params("users"))).rejects.toThrow("404");
    await expect(EditItemPage(params("projects", "../profile"))).rejects.toThrow("404");
    await expect(EditItemPage(params("projects", "999"))).rejects.toThrow("404");
    await expect(PreviewPage(params("certifications", "7"))).rejects.toThrow("404");
  });

  it("lists every item with its status and links to its editor", async () => {
    state.session = { status: "signed-in", session: SESSION };
    render(await CollectionPage(params("projects")));
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Projects in display order" });
    expect(within(list).getByRole("link", { name: "Demo API" })).toHaveAttribute(
      "href",
      "/owner/content/projects/7",
    );
    expect(within(list).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/owner/content/projects/new",
    );
  });

  it("edits an item and sends the loaded version, so stale saves are refused", async () => {
    state.session = { status: "signed-in", session: SESSION };
    const fetch = vi.fn(async () =>
      Response.json(
        { error: { code: "conflict", message: "This item was changed after you opened it." } },
        { status: 409 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(await EditItemPage(params("projects", "7")));
    const form = screen.getByRole("form", { name: "Edit project" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByText(/changed after you opened it/)).toBeInTheDocument());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/owner/projects/7");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("csrf");
    expect(JSON.parse(String(init.body))).toMatchObject({ title: "Renamed", version: 4 });
    expect(within(form).getByRole("button", { name: "Load the latest version" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("previews a draft case study only for the owner, marked as a preview", async () => {
    state.session = { status: "signed-in", session: SESSION };
    render(await PreviewPage(params("projects", "7")));
    expect(screen.getByText(/It is a draft: nobody else can see it/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Demo API" })).toBeInTheDocument();
    expect(screen.getByText("A private problem statement.")).toBeInTheDocument();
  });
});

describe("/owner/login", () => {
  const props = (search: Record<string, string>) => ({ searchParams: Promise.resolve(search) });

  it("shows the sign-in form to a signed-out visitor", async () => {
    render(await LoginPage(props({})));
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends a signed-in owner on to the Studio, never to another site", async () => {
    state.session = { status: "signed-in", session: SESSION };
    await expect(LoginPage(props({ next: "/owner/content/projects" }))).rejects.toThrow(
      "NEXT_REDIRECT:/owner/content/projects",
    );
    await expect(LoginPage(props({ next: "https://evil.example" }))).rejects.toThrow("NEXT_REDIRECT:/owner");
  });

  it("says when the previous session has ended", async () => {
    render(await LoginPage(props({ reason: "expired" })));
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended");
  });
});
