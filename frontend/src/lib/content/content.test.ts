import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { articles as bundledArticles, profile } from "@/content/profile";

import { parseArticleBody, serializeArticleBody } from "./body";
import { bundledContent, contentFromApi } from "./map";
import { formatPeriod } from "./period";
import type { ApiPortfolio } from "./types";

type SeedRecord = Record<string, unknown> & { status: string };
type Seed = {
  profile: ApiPortfolio["profile"];
  skill_groups: ApiPortfolio["skill_groups"];
  experiences: SeedRecord[];
  education: SeedRecord[];
  certifications: SeedRecord[];
  projects: SeedRecord[];
  articles: SeedRecord[];
};

/** The backend import file, served the way /api/v1/public/portfolio would serve it. */
function seedAsApi(): ApiPortfolio {
  const seed = JSON.parse(
    // Vitest runs from frontend/; jsdom replaces import.meta.url.
    readFileSync(resolve(process.cwd(), "../backend/app/cli/verified-content.json"), "utf8"),
  ) as Seed;
  const published = (rows: SeedRecord[]) => rows.filter((row) => row.status === "published");
  return {
    profile: seed.profile,
    skill_groups: seed.skill_groups,
    experience: published(seed.experiences).map((row) => ({
      location: null,
      ...row,
    })) as unknown as ApiPortfolio["experience"],
    education: published(seed.education).map((row) => ({
      start_month: null,
      end_month: null,
      ...row,
    })) as unknown as ApiPortfolio["education"],
    certifications: published(seed.certifications).map((row) => ({
      issued_month: null,
      credential_url: null,
      ...row,
    })) as unknown as ApiPortfolio["certifications"],
    projects: published(seed.projects).map((row) => ({
      ...row,
      case_study:
        row.case_study_status === "published"
          ? { ...row, media: (row.media as { caption?: string }[]).map((m) => ({ caption: null, ...m })) }
          : null,
    })) as unknown as ApiPortfolio["projects"],
    articles: published(seed.articles) as unknown as ApiPortfolio["articles"],
  };
}

describe("public content", () => {
  it("renders the same site from the API as from the bundled content", () => {
    const fromApi = contentFromApi(seedAsApi());
    const bundled = bundledContent();
    // Sources are editorial notes, never published; everything shown must be identical.
    const withoutSources = (content: typeof bundled) => ({
      ...content,
      projects: content.projects.map((project) => ({
        ...project,
        details: project.details && { ...project.details, sources: [] },
      })),
    });
    expect(JSON.parse(JSON.stringify(withoutSources(fromApi)))).toEqual(
      JSON.parse(JSON.stringify(withoutSources(bundled))),
    );
  });

  it("only ever contains published records", () => {
    const content = bundledContent();
    for (const list of [content.projects, content.experience, content.education, content.certifications]) {
      for (const item of list) expect(item.visibility).toBe("published");
    }
    for (const project of content.projects) {
      if (project.details) expect(project.details.visibility).toBe("published");
    }
    expect(content.profile).toBe(profile);
  });

  it("keeps only known social links and principle icons from the API", () => {
    const api = seedAsApi();
    api.profile.social.push({ label: "Unknown", href: "https://example.com" });
    api.profile.principles.push({ title: "X", body: "Y", icon: "unknown" });
    const content = contentFromApi(api);
    expect(content.profile.social.map((link) => link.label)).toEqual(["GitHub", "LinkedIn"]);
    expect(content.principles.every((item) => item.icon !== ("unknown" as never))).toBe(true);
  });

  it("lists notes newest first and never an undated one", () => {
    const api = seedAsApi();
    api.articles = [
      { slug: "a", title: "A", summary: "a", category: "c", published_on: "2026-01-05" },
      { slug: "b", title: "B", summary: "b", category: "c", published_on: "2026-03-01" },
      { slug: "c", title: "C", summary: "c", category: "c", published_on: null },
    ];
    expect(contentFromApi(api).articles.map((article) => article.slug)).toEqual(["b", "a"]);
  });
});

describe("formatPeriod", () => {
  it("writes the forms the site uses", () => {
    expect(formatPeriod("2026-01-01", null, true)).toBe("January 2026 – Present");
    expect(formatPeriod("2026-01-01", "2026-09-01", false)).toBe("January – September 2026");
    expect(formatPeriod("2025-10-01", "2026-03-01", false)).toBe("October 2025 – March 2026");
  });
});

describe("article body markup", () => {
  it("parses headings, paragraphs, lists and code as text", () => {
    const blocks = parseArticleBody(
      "Intro line one\nline two\n\n## Design\n- first\n- second\n\n```python\nprint('<b>')\n\n```\n<script>x</script>",
    );
    expect(blocks).toEqual([
      { type: "paragraph", text: "Intro line one line two" },
      { type: "heading", text: "Design" },
      { type: "list", items: ["first", "second"] },
      { type: "code", language: "python", code: "print('<b>')\n" },
      { type: "paragraph", text: "<script>x</script>" },
    ]);
  });

  it("round-trips the bundled notes", () => {
    for (const article of bundledArticles) {
      expect(parseArticleBody(serializeArticleBody(article.body))).toEqual(article.body);
    }
  });

  it("closes an unterminated code fence at the end", () => {
    expect(parseArticleBody("```\ncode")).toEqual([{ type: "code", language: "text", code: "code" }]);
  });
});
