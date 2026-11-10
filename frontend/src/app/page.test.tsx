import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  certifications,
  experience,
  isPublished,
  navigation,
  profile,
  projects,
  publicProjects,
} from "@/content/profile";

import HomePage from "./page";

describe("home page", () => {
  it("has exactly one h1 that names the owner", () => {
    render(<HomePage />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(profile.name);
  });

  it("has banner, main and contentinfo landmarks and a skip link to main", () => {
    const { container } = render(<HomePage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(container.querySelectorAll("main section[aria-labelledby]").length).toBeGreaterThanOrEqual(6);
  });

  it("points every navigation link at a section that exists", () => {
    const { container } = render(<HomePage />);
    const primary = screen.getByRole("navigation", { name: "Primary" });
    for (const item of navigation) {
      expect(within(primary).getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
      expect(container.querySelector(item.href)).not.toBeNull();
    }
  });

  it("renders every published project", () => {
    render(<HomePage />);
    for (const project of publicProjects) {
      expect(screen.getByRole("article", { name: project.title })).toBeInTheDocument();
    }
  });

  it("never renders draft records, their text or their links", () => {
    const { container } = render(<HomePage />);
    const html = container.innerHTML;
    const drafts = [
      ...projects.filter((p) => !isPublished(p)).flatMap((p) => [p.title, p.summary, p.repoUrl, p.liveUrl]),
      ...experience.filter((j) => !isPublished(j)).flatMap((j) => [j.organization, ...j.highlights]),
      ...certifications.filter((c) => !isPublished(c)).map((c) => c.name),
    ].filter((value): value is string => Boolean(value));
    expect(drafts.length).toBeGreaterThan(0);
    for (const value of drafts) expect(html).not.toContain(value);
  });

  it("does not show the records the owner has withheld", () => {
    render(<HomePage />);
    for (const name of ["Techinika", "School Management System", "Portfolio Website", "HTML Essentials"]) {
      expect(screen.queryByText(name, { exact: false })).not.toBeInTheDocument();
    }
  });

  it("offers the CV as a download and email as a mailto link", () => {
    render(<HomePage />);
    const cvLinks = screen.getAllByRole("link", { name: /download cv/i });
    expect(cvLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of cvLinks) {
      expect(link).toHaveAttribute("href", "/Resume.pdf");
      expect(link).toHaveAttribute("download");
    }
    expect(screen.getByRole("link", { name: "Email me" })).toHaveAttribute("href", `mailto:${profile.email}`);
  });

  it("opens every new-tab link without giving it window.opener", () => {
    const { container } = render(<HomePage />);
    const newTab = container.querySelectorAll('a[target="_blank"]');
    expect(newTab.length).toBeGreaterThan(0);
    for (const link of newTab) expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("uses the owner's portrait with descriptive alt text", () => {
    render(<HomePage />);
    const portrait = screen.getByRole("img", { name: `Portrait of ${profile.name}` });
    expect(portrait.getAttribute("src")).toContain("ishimwe-jean-claude.png");
  });

  it("offers the contact form inside the contact section, with direct channels kept", () => {
    const { container } = render(<HomePage />);
    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]?.closest("section#contact")).not.toBeNull();
    expect(screen.getByRole("form", { name: "Send a message" })).toBeInTheDocument();
    const channels = screen.getByRole("list", { name: "Other ways to reach me" });
    expect(within(channels).getByRole("link", { name: /email/i })).toHaveAttribute(
      "href",
      `mailto:${profile.email}`,
    );
    expect(within(channels).getByRole("link", { name: /github/i })).toBeInTheDocument();
    expect(within(channels).getByRole("link", { name: /linkedin/i })).toBeInTheDocument();
  });

  it("embeds Person structured data built from the profile", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? "{}") as Record<string, unknown>;
    expect(data["@type"]).toBe("Person");
    expect(data.name).toBe(profile.name);
    expect(data.sameAs).toEqual(profile.social.map((link) => link.href));
    // The owner is a current student: "alumniOf" would claim a completed degree.
    expect(data).not.toHaveProperty("alumniOf");
  });

  it("escapes '<' in structured data so it can never close the script tag", async () => {
    const { serializeJsonLd } = await import("@/lib/json-ld");
    expect(serializeJsonLd({ x: "</script><b>" })).toBe('{"x":"\\u003c/script>\\u003cb>"}');
  });
});
