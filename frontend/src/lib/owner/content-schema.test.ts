import { describe, expect, it } from "vitest";

import { collectionSpec, fieldOf, fromFormValues, PROFILE_SPEC, toFormValues } from "./content-schema";

const projects = collectionSpec("projects")!;

const project = {
  id: 1,
  version: 3,
  position: 1,
  updated_at: "2026-11-16T10:00:00Z",
  status: "draft",
  slug: "demo",
  title: "Demo",
  category: "API",
  summary: "A demonstration project.",
  tech: ["Python", "FastAPI"],
  featured: true,
  repo_url: null,
  live_url: "https://example.com",
  case_study_status: "draft",
  overview: ["First paragraph.", "Second paragraph."],
  problem: null,
  objectives: [],
  approach: "Build it.",
  architecture: [],
  decisions: [{ title: "Tenancy", detail: "Scoped by organisation." }],
  challenges: [],
  outcomes: [],
  scope_implemented: [],
  scope_not_yet: [],
  media: [{ src: "/a.png", alt: "A screen", width: 1200, height: 800, caption: null }],
  sources: ["README"],
};

describe("Studio content forms", () => {
  it("round-trips an item through the form unchanged", () => {
    const payload = fromFormValues(projects, toFormValues(projects, project));
    const fields: Record<string, unknown> = { ...project };
    for (const key of ["id", "version", "position", "updated_at", "status"]) delete fields[key];
    expect(payload).toEqual({
      ...fields,
      media: [{ src: "/a.png", alt: "A screen", width: 1200, height: 800 }],
    });
  });

  it("turns empty optional values into null and drops blank lines", () => {
    const values = toFormValues(projects, null);
    values.title = "  New  ";
    values.tech = "Python\n\n  Go \n";
    values.repo_url = "   ";
    values.overview = "One\n\n\n\nTwo\nstill two";
    const payload = fromFormValues(projects, values);
    expect(payload.title).toBe("New");
    expect(payload.tech).toEqual(["Python", "Go"]);
    expect(payload.repo_url).toBeNull();
    expect(payload.overview).toEqual(["One", "Two\nstill two"]);
    expect(payload.featured).toBe(false);
    expect(payload.case_study_status).toBe("draft");
  });

  it("reads months as YYYY-MM and skill groups as ids", () => {
    const experiences = collectionSpec("experiences")!;
    expect(toFormValues(experiences, { start_month: "2026-01-01" }).start_month).toBe("2026-01");
    const skills = collectionSpec("skills")!;
    expect(fromFormValues(skills, { name: "Go", category_id: "4", visible: true })).toEqual({
      name: "Go",
      category_id: 4,
      visible: true,
    });
  });

  it("maps nested server errors to their form field", () => {
    expect(fieldOf(projects, "media.0.src")).toBe("media");
    expect(fieldOf(projects, "body")).toBeNull();
    expect(fieldOf(PROFILE_SPEC, "social.1.href")).toBe("social");
  });
});
