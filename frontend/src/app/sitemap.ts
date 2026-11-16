import type { MetadataRoute } from "next";

import { getPublicContent } from "@/lib/content/portfolio";
import { absoluteUrl } from "@/lib/site";

/**
 * /sitemap.xml: every public, published page and nothing else. Drafts, the Owner Studio and the
 * empty Notes listing are left out. Built from the same content as the pages, so it refreshes with
 * them (the `content` cache tag).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects, articles } = await getPublicContent();
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/projects"), changeFrequency: "monthly", priority: 0.8 },
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      changeFrequency: "monthly" as const,
      priority: project.details ? 0.7 : 0.5,
    })),
  ];
  if (articles.length > 0) {
    entries.push(
      { url: absoluteUrl("/notes"), changeFrequency: "weekly", priority: 0.6 },
      ...articles.map((article) => ({
        url: absoluteUrl(`/notes/${article.slug}`),
        lastModified: article.publishedOn,
        changeFrequency: "yearly" as const,
        priority: 0.6,
      })),
    );
  }
  return entries;
}
