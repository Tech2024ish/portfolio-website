import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectsIndex } from "@/components/site/projects-index";
import { projects, publicProjects } from "@/content/profile";

import ProjectPage, { dynamicParams, generateMetadata, generateStaticParams } from "./[slug]/page";
import ProjectsPage, { generateMetadata as projectsMetadata } from "./page";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const drafts = projects.filter((project) => project.visibility === "draft");

describe("/projects", () => {
  it("lists every published project, each linking to its page", async () => {
    render(await ProjectsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "All projects" });
    for (const project of publicProjects) {
      const heading = within(list).getByRole("heading", { level: 2, name: project.title });
      expect(within(heading).getByRole("link")).toHaveAttribute("href", `/projects/${project.slug}`);
    }
  });

  it("never shows a draft project", async () => {
    render(await ProjectsPage());
    for (const draft of drafts) expect(screen.queryByText(draft.title)).not.toBeInTheDocument();
  });

  it("marks Projects as the current page and has its own canonical URL", async () => {
    render(await ProjectsPage());
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primary).getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect((await projectsMetadata()).alternates?.canonical).toBe("/projects");
  });

  it("shows an empty state when nothing is published", () => {
    render(<ProjectsIndex projects={[]} />);
    expect(screen.getByRole("heading", { level: 2, name: "No projects published yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the home page" })).toHaveAttribute("href", "/");
  });
});

describe("/projects/[slug]", () => {
  it("is generated for published projects; later ones render on demand, other slugs are 404", async () => {
    expect(await generateStaticParams()).toEqual(publicProjects.map((project) => ({ slug: project.slug })));
    expect(dynamicParams).toBe(true);
  });

  it("renders a published project", async () => {
    render(await ProjectPage(params("mosaic")));
    expect(screen.getByRole("heading", { level: 1, name: "MOSAIC" })).toBeInTheDocument();
  });

  it("renders MOSAIC's published case study", async () => {
    render(await ProjectPage(params("mosaic")));
    expect(screen.getByRole("heading", { level: 2, name: "Engineering decisions" })).toBeInTheDocument();
    expect(screen.getByText("Tenant-scoped data access")).toBeInTheDocument();
  });

  it("renders no case study for a project without published details", async () => {
    render(await ProjectPage(params("buzhub-platform")));
    expect(screen.queryByRole("heading", { level: 2, name: "Overview" })).not.toBeInTheDocument();
  });

  it("answers 404 for drafts and unknown slugs", async () => {
    for (const slug of [...drafts.map((draft) => draft.slug), "no-such-project"]) {
      await expect(ProjectPage(params(slug))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    }
  });

  it("describes each project with its own title, summary and canonical URL", async () => {
    const meta = await generateMetadata(params("mosaic"));
    expect(meta.title).toBe("MOSAIC");
    expect(meta.description).toBe(publicProjects.find((project) => project.slug === "mosaic")?.summary);
    expect(meta.alternates?.canonical).toBe("/projects/mosaic");
    expect(await generateMetadata(params(drafts[0]!.slug))).toEqual({});
  });
});
