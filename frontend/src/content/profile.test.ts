// @vitest-environment node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  certifications,
  education,
  experience,
  isPublished,
  navigation,
  profile,
  projects,
  publicCertifications,
  publicEducation,
  publicExperience,
  publicProjects,
  skillGroups,
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
