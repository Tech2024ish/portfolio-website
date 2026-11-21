import "server-only";

import { cache } from "react";

import { articles, isPublished, type Article, type Project } from "@/content/profile";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { ApiError, createApiClient, type RequestOptions } from "@/lib/api/client";

import { articleFromApi, bundledContent, contentFromApi, projectFromApi } from "./map";
import type { ApiArticle, ApiPortfolio, ApiProject, PublicContent } from "./types";

/**
 * Where the public pages get their content:
 *
 * - `bundled` (default): src/content/profile.ts, compiled into the site. Changing content needs a
 *   deploy. It is the default so that a site without a reachable API keeps working.
 * - `api`: the FastAPI public API, which the owner edits in the Studio. Responses are cached under
 *   the `content` tag; the API asks the site to clear that tag (POST /api/revalidate, signed) after
 *   every change, so pages refresh without a deploy.
 *
 * Set PUBLIC_CONTENT_SOURCE on the server. Either way only published content is returned.
 */
export type ContentSource = "bundled" | "api";

export const CONTENT_TAG = "content";

export function contentSource(): ContentSource {
  return process.env.PUBLIC_CONTENT_SOURCE === "api" ? "api" : "bundled";
}

const api = createApiClient();
/**
 * Cached under the `content` tag, which the API clears after every change. The five-minute expiry is
 * a safety net: if an invalidation is ever missed (the site was unreachable, or a self-hosted server
 * restarted and lost it), stale content is served for at most that long.
 */
const cached: RequestOptions = { cache: "force-cache", next: { tags: [CONTENT_TAG], revalidate: 300 } };

/** `?lang=` for French and Kinyarwanda; English keeps the plain addresses (and their cache). */
const inLanguage = (lang: Locale) => (lang === DEFAULT_LOCALE ? "" : `?lang=${lang}`);

/**
 * Everything the public pages render, in a language, once per request. Failures surface as the
 * error page.
 */
export const getPublicContent = cache(async (lang: Locale = DEFAULT_LOCALE): Promise<PublicContent> => {
  if (contentSource() === "bundled") return bundledContent(lang);
  const data = await api.get<ApiPortfolio>(`/api/v1/public/portfolio${inLanguage(lang)}`, cached);
  return contentFromApi(data, lang);
});

const notFoundIs404 = async <T>(request: Promise<T>): Promise<T | undefined> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
};

/** A published project by slug; undefined for drafts and unknown slugs alike. */
export const getPublicProject = cache(
  async (slug: string, lang: Locale = DEFAULT_LOCALE): Promise<Project | undefined> => {
    if (contentSource() === "bundled") {
      return (await getPublicContent(lang)).projects.find((project) => project.slug === slug);
    }
    const project = await notFoundIs404(
      api.get<ApiProject>(`/api/v1/public/projects/${encodeURIComponent(slug)}${inLanguage(lang)}`, cached),
    );
    return project ? projectFromApi(project) : undefined;
  },
);

/** A published note by slug, with its body; undefined for drafts and unknown slugs alike. */
export const getPublicArticle = cache(
  async (slug: string, lang: Locale = DEFAULT_LOCALE): Promise<Article | undefined> => {
    if (contentSource() === "bundled") {
      return articles.find((article) => article.slug === slug && isPublished(article));
    }
    const article = await notFoundIs404(
      api.get<ApiArticle>(`/api/v1/public/articles/${encodeURIComponent(slug)}${inLanguage(lang)}`, cached),
    );
    return (article && articleFromApi(article)) ?? undefined;
  },
);
