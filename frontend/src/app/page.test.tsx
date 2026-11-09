import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigation, profile, projects } from "@/content/profile";

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

  it("renders every verified project", () => {
    render(<HomePage />);
    for (const project of projects) {
      expect(screen.getByRole("article", { name: project.title })).toBeInTheDocument();
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

  it("does not render a contact form without a backend to receive it", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("form")).toBeNull();
  });

  it("embeds Person structured data built from the profile", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? "{}") as Record<string, unknown>;
    expect(data["@type"]).toBe("Person");
    expect(data.name).toBe(profile.name);
    expect(data.sameAs).toEqual(profile.social.map((link) => link.href));
  });

  it("escapes '<' in structured data so it can never close the script tag", async () => {
    const { serializeJsonLd } = await import("@/lib/json-ld");
    expect(serializeJsonLd({ x: "</script><b>" })).toBe('{"x":"\\u003c/script>\\u003cb>"}');
  });
});
