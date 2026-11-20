import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";
import type { Project } from "@/content/profile";

import { ProjectCard } from "./project-card";

/** The projects listing: every published project as a card, or an empty state. */
export function ProjectsIndex({ projects }: { projects: readonly Project[] }) {
  return (
    <section aria-label="All projects" className={`${containerClasses} py-10 sm:py-12`}>
      {projects.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No projects published yet"
          description="Projects appear here once they are reviewed and published."
          action={
            <Link href="/" className={buttonClasses("secondary", "sm")}>
              Back to the home page
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.slug}>
              <ProjectCard project={project} headingLevel={2} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
