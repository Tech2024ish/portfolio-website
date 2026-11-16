import { describe, expect, it } from "vitest";

import { navigation } from "@/content/profile";

import { siteNavigation } from "./navigation";

describe("siteNavigation", () => {
  it("scrolls to the home page's own sections on the home page", () => {
    expect(siteNavigation("home", 0)).toEqual(
      navigation.map(({ label, href }) => ({ label, href, current: false })),
    );
  });

  it("leads back to the home sections from other pages, and Projects to the listing", () => {
    const links = siteNavigation("other", 0);
    expect(links.map((link) => link.href)).toEqual([
      "/#about",
      "/#skills",
      "/projects",
      "/#experience",
      "/#contact",
    ]);
    expect(links.every((link) => !link.current)).toBe(true);
  });

  it("marks Projects as the current page on project pages", () => {
    const current = siteNavigation("projects", 0).filter((link) => link.current);
    expect(current).toEqual([{ label: "Projects", href: "/projects", current: true }]);
  });

  it("links to Notes only once a note is published, before Contact", () => {
    expect(siteNavigation("other", 0).map((link) => link.label)).not.toContain("Notes");
    const labels = siteNavigation("notes", 1).map((link) => link.label);
    expect(labels.slice(-2)).toEqual(["Notes", "Contact"]);
    expect(siteNavigation("notes", 1).find((link) => link.label === "Notes")?.current).toBe(true);
  });
});
