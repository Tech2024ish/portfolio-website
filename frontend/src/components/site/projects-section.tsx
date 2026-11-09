import { Section } from "@/components/ui/section";
import { projects } from "@/content/profile";

import { ProjectCard } from "./project-card";

export function ProjectsSection() {
  return (
    <Section
      id="projects"
      eyebrow="Projects"
      title="Selected work"
      description="Backend platforms, APIs and full-stack applications I have built or contributed to."
    >
      <ul className="grid gap-5 md:grid-cols-2">
        {projects.map((project) => (
          <li key={project.slug}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
