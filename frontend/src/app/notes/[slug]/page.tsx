import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/site/json-ld";
import { ArticleView } from "@/components/site/notes";
import { SiteShell } from "@/components/site/site-shell";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicArticle, getPublicContent } from "@/lib/content/portfolio";
import { articleGraph } from "@/lib/structured-data";

/**
 * A page per published note. Notes published at build time are generated then; later ones on
 * their first visit. Every other slug, drafts included, is a 404.
 */
export const dynamicParams = true;

// Declared here rather than with Next's generated PageProps<...>: those types exist only after
// `next dev` or `next build`, and CI type-checks a fresh checkout before building.
type NotePageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { articles } = await getPublicContent();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [article, { profile }] = await Promise.all([getPublicArticle(slug), getPublicContent()]);
  if (!article) return {};
  const path = `/notes/${article.slug}`;
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: `${article.title} · ${profile.name}`,
      description: article.summary,
      url: path,
      publishedTime: article.publishedOn,
    },
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params;
  const [article, content] = await Promise.all([getPublicArticle(slug), getPublicContent()]);
  if (!article) notFound();
  return (
    <SiteShell
      page="notes"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
    >
      <ArticleView article={article} />
      <JsonLd data={articleGraph(article, content.profile)} />
    </SiteShell>
  );
}
