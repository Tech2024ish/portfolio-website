import { describe, expect, it, vi } from "vitest";

import { profile, projects } from "@/content/profile";

import { indexable, resolveSiteUrl } from "./site-url";
import { articleGraph, homeGraph, projectGraph } from "./structured-data";

vi.mock("server-only", () => ({}));

describe("canonical origin", () => {
  it("uses NEXT_PUBLIC_SITE_URL, then Vercel's production domain, then localhost", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://jc.example/" })).toBe("https://jc.example");
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "goslish.vercel.app" })).toBe(
      "https://goslish.vercel.app",
    );
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://jc.example",
        VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
      }),
    ).toBe("https://jc.example");
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("never lets a preview deployment be indexed", () => {
    expect(indexable({ VERCEL_ENV: "production" })).toBe(true);
    expect(indexable({ VERCEL_ENV: "preview" })).toBe(false);
    expect(indexable({})).toBe(true);
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("lets crawlers in, keeps them out of the Studio and the API, and points at the sitemap", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots();
    expect(rules.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/owner", "/api/", "/styleguide"] });
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("lists every published page and nothing unpublished", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(urls).toEqual(["/", "/projects", "/projects/mosaic", "/projects/buzhub-platform"]);
    for (const draft of projects.filter((project) => project.visibility === "draft")) {
      expect(urls).not.toContain(`/projects/${draft.slug}`);
    }
    expect(urls).not.toContain("/notes"); // no published note yet
  });
});

describe("structured data", () => {
  it("describes the person and the website on the home page", () => {
    const graph = homeGraph(profile)["@graph"] as Record<string, unknown>[];
    expect(graph.map((node) => node["@type"])).toEqual(["Person", "WebSite"]);
    expect(graph[1]?.publisher).toEqual({ "@id": graph[0]?.["@id"] });
  });

  it("describes a project with its source code and breadcrumbs", () => {
    const mosaic = projects.find((project) => project.slug === "mosaic")!;
    const [work, crumbs] = projectGraph(mosaic, profile)["@graph"] as Record<string, unknown>[];
    expect(work?.["@type"]).toBe("SoftwareSourceCode");
    expect(work?.codeRepository).toBe(mosaic.repoUrl);
    expect((crumbs?.itemListElement as { name: string }[]).map((item) => item.name)).toEqual([
      "Home",
      "Projects",
      "MOSAIC",
    ]);
  });

  it("describes a note as a dated blog post", () => {
    const note = {
      slug: "n",
      title: "A note",
      summary: "About something.",
      category: "API",
      publishedOn: "2026-11-16",
      body: [],
      visibility: "published" as const,
    };
    const [post] = articleGraph(note, profile)["@graph"] as Record<string, unknown>[];
    expect(post?.["@type"]).toBe("BlogPosting");
    expect(post?.datePublished).toBe("2026-11-16");
  });
});
