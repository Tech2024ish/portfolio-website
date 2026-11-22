import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";
import type { Project } from "@/content/profile";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

import { ProjectCard } from "./project-card";

/** The projects listing: every published project as a card, or an empty state. */
export function ProjectsIndex({
  projects,
  lang = DEFAULT_LOCALE,
}: {
  projects: readonly Project[];
  lang?: Locale;
}) {
  const t = dictionary(lang).projects;
  return (
    <section aria-label={t.allProjects} className={`${containerClasses} py-10 sm:py-12`}>
      {projects.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <Link href={localePath(lang, "/")} className={buttonClasses("secondary", "sm")}>
              {t.backHome}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.slug}>
              <ProjectCard project={project} headingLevel={2} lang={lang} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
