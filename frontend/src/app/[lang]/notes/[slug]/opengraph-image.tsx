import { getPublicArticle, getPublicContent } from "@/lib/content/portfolio";
import { OG_CONTENT_TYPE, OG_SIZE, socialCard } from "@/lib/og-image";

/** A note's sharing image: its title, category and summary. */
export const alt = "Engineering Note";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { articles } = await getPublicContent();
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, { profile }] = await Promise.all([getPublicArticle(slug), getPublicContent()]);
  return socialCard({
    eyebrow: article ? `Engineering Notes · ${article.category}` : "Engineering Notes",
    title: article?.title ?? profile.name,
    description: article?.summary ?? profile.headline,
    footer: profile.name,
  });
}
