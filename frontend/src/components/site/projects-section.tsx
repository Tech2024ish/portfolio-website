import { TextLink } from "@/components/ui/link";
import { Section } from "@/components/ui/section";
import { homeProjects, type Project } from "@/content/profile";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

import { ProjectCard } from "./project-card";

/** The home page's project highlights: featured projects first, with a link to all of them. */
export function ProjectsSection({
  projects,
  limit = 3,
  lang = DEFAULT_LOCALE,
}: {
  projects: Project[];
  limit?: number;
  lang?: Locale;
}) {
  const t = dictionary(lang).sections;
  const shown = homeProjects(projects, limit);
  return (
    <Section id="projects" title={t.projects} description={t.projectsDescription}>
      <ul className="grid gap-6 md:grid-cols-2">
        {shown.map((project) => (
          <li key={project.slug}>
            <ProjectCard project={project} lang={lang} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center">
        <TextLink href={localePath(lang, "/projects")} className="inline-flex min-h-6 items-center">
          {t.viewAllProjects}
          <span className="sr-only"> ({projects.length})</span>
        </TextLink>
      </p>
    </Section>
  );
}
