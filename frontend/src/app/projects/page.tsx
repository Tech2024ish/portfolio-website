import type { Metadata } from "next";

import { PageHeader } from "@/components/site/page-header";
import { ProjectsIndex } from "@/components/site/projects-index";
import { SiteShell } from "@/components/site/site-shell";
import { profile, publicProjects } from "@/content/profile";

const description = `Backend platforms and APIs ${profile.name} has built or contributed to, with their technologies and source code where it is public.`;

export const metadata: Metadata = {
  title: "Projects",
  description,
  alternates: { canonical: "/projects" },
  openGraph: { title: `Projects · ${profile.name}`, description, url: "/projects" },
};

export default function ProjectsPage() {
  return (
    <SiteShell page="projects">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description={<p>Backend platforms and APIs I have built or contributed to.</p>}
      />
      <ProjectsIndex projects={publicProjects} />
    </SiteShell>
  );
}
