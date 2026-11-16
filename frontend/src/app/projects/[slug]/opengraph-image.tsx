import { getPublicContent, getPublicProject } from "@/lib/content/portfolio";
import { OG_CONTENT_TYPE, OG_SIZE, socialCard } from "@/lib/og-image";

/** A project's sharing image: its title, category and summary. */
export const alt = "Project overview";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { projects } = await getPublicContent();
  return projects.map((project) => ({ slug: project.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, { profile }] = await Promise.all([getPublicProject(slug), getPublicContent()]);
  // Unpublished or unknown: a neutral card that reveals nothing about drafts.
  return socialCard({
    eyebrow: project?.category ?? "Projects",
    title: project?.title ?? profile.name,
    description: project?.summary ?? profile.headline,
    footer: `${profile.name} · Projects`,
  });
}
