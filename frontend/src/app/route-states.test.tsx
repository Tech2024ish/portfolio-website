import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";
import NotesPage, { generateMetadata as notesMetadata } from "./notes/page";
import NotePage, {
  dynamicParams as noteDynamicParams,
  generateStaticParams as noteParams,
} from "./notes/[slug]/page";
import NotFound from "./not-found";
import ProjectsLoading from "./projects/loading";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

describe("not found", () => {
  it("says the page is not available without revealing whether a draft exists", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("This page does not exist or is not public.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });
});

describe("error boundary", () => {
  it("offers a retry and a way home, and never shows the error", () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error("database password is hunter2")} retry={retry} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "This page could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });
});

describe("loading state", () => {
  it("announces that projects are loading", () => {
    render(<ProjectsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
  });
});

describe("Engineering Notes routes", () => {
  it("shows an empty state, is not indexed and is not linked while nothing is published", async () => {
    render(await NotesPage());
    expect(screen.getByRole("heading", { level: 2, name: "No notes published yet" })).toBeInTheDocument();
    expect((await notesMetadata()).robots).toEqual({ index: false, follow: true });
    expect(screen.queryByRole("link", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("generates no note page and answers 404 for any slug", async () => {
    expect(await noteParams()).toEqual([]);
    expect(noteDynamicParams).toBe(true);
    await expect(NotePage({ params: Promise.resolve({ slug: "anything" }) })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});
