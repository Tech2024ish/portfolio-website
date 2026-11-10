import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/content/profile";

import { ProjectCard } from "./project-card";

const base: Project = {
  slug: "demo",
  title: "Demo API",
  category: "Backend API",
  summary: "A summary that is long enough to describe the project properly.",
  tech: ["Python", "FastAPI"],
  featured: true,
  visibility: "published",
};

describe("ProjectCard", () => {
  it("is an article named by its title, with technologies as a labelled list", () => {
    render(<ProjectCard project={base} />);
    expect(screen.getByRole("article", { name: "Demo API" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Demo API technologies" })).toHaveTextContent("FastAPI");
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("renders safe external links with project-specific accessible names", () => {
    render(
      <ProjectCard
        project={{ ...base, repoUrl: "https://github.com/x/demo", liveUrl: "https://demo.example" }}
      />,
    );
    const source = screen.getByRole("link", { name: /source code for demo api/i });
    expect(source).toHaveAttribute("href", "https://github.com/x/demo");
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /live site for demo api/i })).toHaveAttribute(
      "href",
      "https://demo.example",
    );
  });

  it("says plainly when there is no public link instead of rendering a dead one", () => {
    render(<ProjectCard project={{ ...base, featured: false }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("No public link available")).toBeInTheDocument();
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
  });
});
