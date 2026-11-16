import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project, ProjectDetails } from "@/content/profile";
import { axeViolations } from "@/test/axe";

import { ProjectDetail } from "./project-detail";

const project: Project = {
  slug: "demo",
  title: "Demo API",
  category: "Backend API",
  summary: "A short description of the demo.",
  tech: ["Python", "FastAPI"],
  featured: false,
  repoUrl: "https://github.com/x/demo",
  visibility: "published",
};

const details: ProjectDetails = {
  sources: ["test fixture"],
  overview: ["First paragraph.", "Second paragraph."],
  problem: "The problem.",
  objectives: ["Objective one."],
  approach: "The approach.",
  architecture: ["Layer one."],
  decisions: [{ title: "Decision", detail: "Why it was made." }],
  challenges: [{ challenge: "A challenge.", solution: "Its solution." }],
  outcomes: ["A verified outcome."],
  scope: { implemented: ["Built."], notYetImplemented: ["Not built."] },
  media: [{ src: "/shot.png", alt: "The dashboard", caption: "Dashboard", width: 1200, height: 800 }],
  visibility: "published",
};

const other: Project = { ...project, slug: "other", title: "Other Project" };

describe("ProjectDetail", () => {
  it("is an article titled by the project, with a breadcrumb back to the listing", () => {
    render(<ProjectDetail project={project} related={[]} />);
    expect(screen.getByRole("article", { name: "Demo API" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Demo API" })).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(within(crumbs).getByText("Demo API")).toHaveAttribute("aria-current", "page");
  });

  it("shows the verified essentials: summary, category, technologies and links", () => {
    render(<ProjectDetail project={project} related={[]} />);
    expect(screen.getByText("A short description of the demo.")).toBeInTheDocument();
    const facts = screen.getByRole("complementary", { name: "Project facts" });
    expect(within(facts).getByText("Backend API")).toBeInTheDocument();
    expect(within(facts).getByRole("list", { name: "Demo API technologies" })).toHaveTextContent("FastAPI");
    expect(within(facts).getByRole("link", { name: /source code on github/i })).toHaveAttribute(
      "href",
      "https://github.com/x/demo",
    );
  });

  it("renders no case-study section without published details", () => {
    render(<ProjectDetail project={project} related={[]} />);
    for (const name of ["Overview", "Problem", "Engineering decisions", "Outcomes", "Screenshots"]) {
      expect(screen.queryByRole("heading", { level: 2, name })).not.toBeInTheDocument();
    }
  });

  it("renders every case-study section that has content, in order", () => {
    render(<ProjectDetail project={project} details={details} related={[]} />);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
      .filter((text) => !["Category", "Technologies", "Links"].includes(text ?? ""));
    expect(headings).toEqual([
      "Overview",
      "Problem",
      "Motivation and objectives",
      "Technical approach",
      "Architecture overview",
      "Engineering decisions",
      "Challenges and solutions",
      "Outcomes",
      "Current scope",
      "Screenshots",
    ]);
    expect(screen.getByRole("img", { name: "The dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Why it was made.")).toBeInTheDocument();
  });

  it("omits the sections a case study does not have", () => {
    render(
      <ProjectDetail
        project={project}
        details={{ sources: ["x"], problem: "Only this.", visibility: "published" }}
        related={[]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Problem" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Outcomes" })).not.toBeInTheDocument();
  });

  it("says plainly when there is no public link", () => {
    render(<ProjectDetail project={{ ...project, repoUrl: undefined }} related={[]} />);
    expect(screen.getByText("No public link available")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /source code/i })).not.toBeInTheDocument();
  });

  it("links to the other projects", () => {
    render(<ProjectDetail project={project} related={[other]} />);
    const more = screen.getByRole("navigation", { name: "More projects" });
    expect(within(more).getByRole("link", { name: "Other Project" })).toHaveAttribute(
      "href",
      "/projects/other",
    );
  });

  it("has no accessibility violations with every section", async () => {
    const { container } = render(<ProjectDetail project={project} details={details} related={[other]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
