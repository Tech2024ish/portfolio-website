import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/site/project-detail";
import { SiteShell } from "@/components/site/site-shell";
import { getPublicProject, profile, publicDetails, publicProjects } from "@/content/profile";

/**
 * A page per published project, generated at build time. Any other slug, including an
 * unpublished project's, is a 404: drafts are never rendered or reachable.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return publicProjects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getPublicProject(slug);
  if (!project) return {};
  const path = `/projects/${project.slug}`;
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: path },
    openGraph: { title: `${project.title} · ${profile.name}`, description: project.summary, url: path },
  };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = getPublicProject(slug);
  if (!project) notFound();
  const related = publicProjects.filter((other) => other.slug !== project.slug);
  return (
    <SiteShell page="projects">
      <ProjectDetail project={project} details={publicDetails(project)} related={related} />
    </SiteShell>
  );
}
