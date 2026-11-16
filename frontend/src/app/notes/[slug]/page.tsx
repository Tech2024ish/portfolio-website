import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/site/notes";
import { SiteShell } from "@/components/site/site-shell";
import { getPublicArticle, profile, publicArticles } from "@/content/profile";

/** A page per published note, generated at build time; every other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return publicArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps<"/notes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublicArticle(slug);
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

export default async function NotePage({ params }: PageProps<"/notes/[slug]">) {
  const { slug } = await params;
  const article = getPublicArticle(slug);
  if (!article) notFound();
  return (
    <SiteShell page="notes">
      <ArticleView article={article} />
    </SiteShell>
  );
}
