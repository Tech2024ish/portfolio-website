import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { ProjectsIndex } from "@/components/site/projects-index";
import { SiteShell } from "@/components/site/site-shell";
import { getPublicContent } from "@/lib/content/portfolio";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getPublicContent();
  const description = `Backend platforms and APIs ${profile.name} has built or contributed to, with their technologies and source code where it is public.`;
  return {
    title: "Projects",
    description,
    alternates: { canonical: "/projects" },
    openGraph: { title: `Projects · ${profile.name}`, description, url: "/projects" },
  };
}

export default async function ProjectsPage() {
  const content = await getPublicContent();
  return (
    <SiteShell page="projects" profile={content.profile} articleCount={content.articles.length}>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description={<p>Backend platforms and APIs I have built or contributed to.</p>}
      />
      <ProjectsIndex projects={content.projects} />
    </SiteShell>
  );
}
