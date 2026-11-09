// @vitest-environment node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { certifications, education, experience, navigation, profile, projects, skillGroups } from "./profile";

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

  it("has exactly one current role, listed first", () => {
    expect(experience.filter((job) => job.current)).toHaveLength(1);
    expect(experience[0]?.current).toBe(true);
  });

  it("uses unique in-page anchors for navigation", () => {
    const hrefs = navigation.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^#[a-z]+$/);
  });
});
