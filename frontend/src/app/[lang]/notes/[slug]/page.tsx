import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/site/json-ld";
import { ArticleView } from "@/components/site/notes";
import { SiteShell } from "@/components/site/site-shell";
import { OG_LOCALES } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { localeFrom } from "@/i18n/server";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicArticle, getPublicContent } from "@/lib/content/portfolio";
import { articleGraph } from "@/lib/structured-data";

/**
 * A page per published note, in each language. Notes published at build time are generated then;
 * later ones on their first visit. Every other slug, drafts included, is a 404.
 */
export const dynamicParams = true;

// Declared here rather than with Next's generated PageProps<...>: those types exist only after
// `next dev` or `next build`, and CI type-checks a fresh checkout before building.
type NotePageProps = { params: Promise<{ lang: string; slug: string }> };

/** Runs once per language (the parent layout's params); the slugs are the same in each. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { articles } = await getPublicContent();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const [lang, { slug }] = await Promise.all([localeFrom(params), params]);
  const [article, { profile }] = await Promise.all([getPublicArticle(slug, lang), getPublicContent(lang)]);
  if (!article) return {};
  const alternates = alternatesFor(lang, `/notes/${article.slug}`);
  return {
    title: article.title,
    description: article.summary,
    alternates,
    openGraph: {
      type: "article",
      title: `${article.title} · ${profile.name}`,
      description: article.summary,
      url: alternates.canonical,
      locale: OG_LOCALES[lang],
      publishedTime: article.publishedOn,
    },
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const [lang, { slug }] = await Promise.all([localeFrom(params), params]);
  const [article, content] = await Promise.all([getPublicArticle(slug, lang), getPublicContent(lang)]);
  if (!article) notFound();
  return (
    <SiteShell
      page="notes"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
      lang={lang}
    >
      <ArticleView article={article} lang={lang} />
      <JsonLd data={articleGraph(article, content.profile)} />
    </SiteShell>
  );
}
