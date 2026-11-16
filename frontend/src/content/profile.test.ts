// @vitest-environment node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  type Article,
  articles,
  certifications,
  education,
  experience,
  getPublicArticle,
  getPublicProject,
  homeProjects,
  isPublished,
  navigation,
  profile,
  type Project,
  projects,
  publicArticles,
  publicCertifications,
  publicDetails,
  publicEducation,
  publicExperience,
  publicProjects,
  skillGroups,
  sortedArticles,
} from "./profile";

const publicFile = (path: string) => fileURLToPath(new URL(`../../public${path}`, import.meta.url));

describe("verified profile content", () => {
  it("links the CV and portrait to files that ship in public/", () => {
    expect(profile.cvHref).toBe("/Resume.pdf");
    expect(existsSync(publicFile(profile.cvHref))).toBe(true);
    expect(existsSync(publicFile("/ishimwe-jean-claude.png"))).toBe(true);
  });

  it("uses only absolute https URLs for external links", () => {
    const urls = [
      ...profile.social.map((link) => link.href),
      ...projects.flatMap((project) => [project.repoUrl, project.liveUrl]).filter(Boolean),
    ];
    for (const url of urls) expect(url).toMatch(/^https:\/\/\S+$/);
  });

  it("has a valid email address", () => {
    expect(profile.email).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/);
  });

  it("gives every project a unique slug, a summary and at least one technology", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const project of projects) {
      expect(project.slug).toMatch(/^[a-z0-9-]+$/);
      expect(project.summary.length).toBeGreaterThan(40);
      expect(project.tech.length).toBeGreaterThan(0);
    }
  });

  it("contains no empty entries", () => {
    const strings = [
      ...skillGroups.flatMap((group) => [group.name, ...group.skills]),
      ...experience.flatMap((job) => [job.organization, job.role, job.period, ...job.highlights]),
      ...education.flatMap((entry) => [entry.institution, entry.degree, entry.status, ...entry.coursework]),
      ...certifications.flatMap((cert) => [cert.name, cert.issuer]),
    ];
    for (const value of strings) expect(value.trim()).not.toBe("");
  });

  it("has exactly one current public role, listed first", () => {
    expect(publicExperience.filter((job) => job.current)).toHaveLength(1);
    expect(publicExperience[0]?.current).toBe(true);
  });

  it("keeps the confirmed SilverLandTech dates", () => {
    const silverland = publicExperience.find((job) => job.organization === "SilverLandTech");
    expect(silverland?.role).toBe("Backend Developer");
    expect(silverland?.period).toBe("January 2026 – Present");
    expect(silverland?.current).toBe(true);
  });

  it("uses unique in-page anchors for navigation", () => {
    const hrefs = navigation.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^#[a-z]+$/);
  });
});

describe("publication status", () => {
  it("exposes only published records through the public lists", () => {
    for (const list of [publicProjects, publicExperience, publicEducation, publicCertifications]) {
      for (const record of list) expect(record.visibility).toBe("published");
    }
    expect(publicProjects).toHaveLength(projects.filter(isPublished).length);
    expect(publicExperience).toHaveLength(experience.filter(isPublished).length);
    expect(publicEducation).toHaveLength(education.filter(isPublished).length);
    expect(publicCertifications).toHaveLength(certifications.filter(isPublished).length);
  });

  it("keeps Techinika as an unpublished draft", () => {
    expect(experience.find((job) => job.organization === "Techinika")?.visibility).toBe("draft");
    expect(publicExperience.map((job) => job.organization)).not.toContain("Techinika");
  });

  it("keeps School Management System and Portfolio Website out of the public projects", () => {
    for (const slug of ["school-management-system", "portfolio-website"]) {
      expect(projects.find((project) => project.slug === slug)?.visibility).toBe("draft");
      expect(publicProjects.map((project) => project.slug)).not.toContain(slug);
    }
  });

  it("publishes exactly the approved projects", () => {
    expect(publicProjects.map((project) => project.slug)).toEqual(["mosaic", "buzhub-platform"]);
  });

  it("publishes certifications only in the CV's wording", () => {
    expect(publicCertifications.map((cert) => cert.name)).toEqual([
      "Python programming",
      "Data Structures and Algorithms",
    ]);
    for (const name of ["Python Essentials", "HTML Essentials"]) {
      expect(certifications.find((cert) => cert.name === name)?.visibility).toBe("draft");
    }
  });

  it("shows no unverified graduation date", () => {
    for (const entry of publicEducation) expect(entry.status).not.toMatch(/\d{4}/);
  });

  it("retains draft records instead of deleting them", () => {
    expect(projects.filter((project) => !isPublished(project)).length).toBeGreaterThanOrEqual(2);
    expect(experience.filter((job) => !isPublished(job)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("project pages", () => {
  it("finds published projects by slug and never drafts or unknown slugs", () => {
    expect(getPublicProject("mosaic")?.title).toBe("MOSAIC");
    for (const slug of ["school-management-system", "portfolio-website", "no-such-project"]) {
      expect(getPublicProject(slug)).toBeUndefined();
    }
  });

  it("keeps MOSAIC's case study unpublished until the owner approves it", () => {
    const mosaic = projects.find((project) => project.slug === "mosaic");
    expect(mosaic?.details?.visibility).toBe("draft");
    expect(publicDetails(mosaic as Project)).toBeUndefined();
  });

  it("returns details only when both the project and its details are published", () => {
    const details = { sources: ["test"], problem: "p", visibility: "published" as const };
    const published: Project = { ...publicProjects[0]!, details };
    expect(publicDetails(published)).toBe(details);
    expect(publicDetails({ ...published, visibility: "draft" })).toBeUndefined();
    expect(publicDetails({ ...published, details: { ...details, visibility: "draft" } })).toBeUndefined();
  });

  it("records where every case study comes from", () => {
    for (const project of projects) {
      if (project.details) expect(project.details.sources.length).toBeGreaterThan(0);
    }
  });

  it("claims no outcome that has not been verified", () => {
    // Outcomes need evidence the owner has confirmed; none has been provided yet.
    for (const project of projects) expect(project.details?.outcomes ?? []).toEqual([]);
  });

  it("puts featured projects first on the home page, and only published ones", () => {
    const draft: Project = { ...publicProjects[0]!, slug: "draft", featured: true, visibility: "draft" };
    const plain: Project = { ...publicProjects[0]!, slug: "plain", featured: false };
    const star: Project = { ...publicProjects[0]!, slug: "star", featured: true };
    expect(homeProjects([plain, draft, star]).map((project) => project.slug)).toEqual(["star", "plain"]);
    expect(homeProjects([plain, star], 1).map((project) => project.slug)).toEqual(["star"]);
    expect(homeProjects().map((project) => project.slug)).toEqual(["mosaic", "buzhub-platform"]);
  });
});

describe("Engineering Notes", () => {
  const note = (slug: string, publishedOn: string, visibility: Article["visibility"]): Article => ({
    slug,
    title: slug,
    summary: "s",
    category: "c",
    publishedOn,
    body: [{ type: "paragraph", text: "t" }],
    visibility,
  });

  it("publishes no note yet: none has been written or approved", () => {
    expect(articles).toEqual([]);
    expect(publicArticles).toEqual([]);
  });

  it("finds published notes only, newest first", () => {
    const list = [
      note("old", "2026-01-02", "published"),
      note("draft", "2026-03-01", "draft"),
      note("new", "2026-02-01", "published"),
    ];
    expect(sortedArticles(list).map((article) => article.slug)).toEqual(["new", "old"]);
    expect(getPublicArticle("draft", list)).toBeUndefined();
    expect(getPublicArticle("new", list)?.slug).toBe("new");
  });

  it("uses ISO dates", () => {
    for (const article of articles) expect(article.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
