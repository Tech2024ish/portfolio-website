import { TextLink } from "@/components/ui/link";
import { Section } from "@/components/ui/section";
import { homeProjects, publicProjects } from "@/content/profile";

import { ProjectCard } from "./project-card";

/** The home page's project highlights: featured projects first, with a link to all of them. */
export function ProjectsSection() {
  const shown = homeProjects();
  return (
    <Section
      id="projects"
      eyebrow="Projects"
      title="Selected work"
      description="Backend platforms and APIs I have built or contributed to."
    >
      <ul className="grid gap-5 md:grid-cols-2">
        {shown.map((project) => (
          <li key={project.slug}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <TextLink href="/projects" className="inline-flex min-h-6 items-center">
          View all projects
          <span className="sr-only"> ({publicProjects.length})</span>
        </TextLink>
      </p>
    </Section>
  );
}
