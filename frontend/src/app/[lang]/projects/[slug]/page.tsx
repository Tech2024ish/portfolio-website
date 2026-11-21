import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/site/json-ld";
import { ProjectDetail } from "@/components/site/project-detail";
import { SiteShell } from "@/components/site/site-shell";
import { OG_LOCALES } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { localeFrom } from "@/i18n/server";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicContent, getPublicProject } from "@/lib/content/portfolio";
import { projectGraph } from "@/lib/structured-data";

/**
 * A page per published project, in each language. Published projects are generated at build
 * time; a project published later is rendered on its first visit. Any other slug, including an
 * unpublished project's, is a 404: drafts are never rendered or reachable.
 */
export const dynamicParams = true;

// Declared here rather than with Next's generated PageProps<...>: those types exist only after
// `next dev` or `next build`, and CI type-checks a fresh checkout before building.
type ProjectPageProps = { params: Promise<{ lang: string; slug: string }> };

/** Runs once per language (the parent layout's params); the slugs are the same in each. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { projects } = await getPublicContent();
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const [lang, { slug }] = await Promise.all([localeFrom(params), params]);
  const [project, { profile }] = await Promise.all([getPublicProject(slug, lang), getPublicContent(lang)]);
  if (!project) return {};
  const alternates = alternatesFor(lang, `/projects/${project.slug}`);
  return {
    title: project.title,
    description: project.summary,
    alternates,
    openGraph: {
      title: `${project.title} · ${profile.name}`,
      description: project.summary,
      url: alternates.canonical,
      locale: OG_LOCALES[lang],
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const [lang, { slug }] = await Promise.all([localeFrom(params), params]);
  const [project, content] = await Promise.all([getPublicProject(slug, lang), getPublicContent(lang)]);
  if (!project) notFound();
  const related = content.projects.filter((other) => other.slug !== project.slug);
  return (
    <SiteShell
      page="projects"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
      lang={lang}
    >
      <ProjectDetail project={project} details={project.details} related={related} lang={lang} />
      <JsonLd data={projectGraph(project, content.profile)} />
    </SiteShell>
  );
}
