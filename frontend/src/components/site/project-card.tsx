import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { ExternalIcon, GitHubIcon } from "@/components/ui/icons";
import { cardClasses } from "@/components/ui/section";
import { TagList } from "@/components/ui/tag";
import type { Project } from "@/content/profile";

import { ProjectCover } from "./project-cover";

/** The project's page on this site. */
export function projectHref(slug: string): string {
  return `/projects/${slug}`;
}

/**
 * Project summary card. Its title links to the project's page; source and live links, when the
 * project has them, open the external sites. `headingLevel` fits the card into the page outline.
 */
export function ProjectCard({ project, headingLevel = 3 }: { project: Project; headingLevel?: 2 | 3 }) {
  const titleId = `project-${project.slug}`;
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      aria-labelledby={titleId}
      className={`${cardClasses} group flex h-full flex-col overflow-hidden transition-colors hover:border-border-strong`}
    >
      <ProjectCover project={project} className="border-b border-border" />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{project.category}</p>
          <Heading id={titleId} className="text-lg font-medium text-fg">
            <Link
              href={projectHref(project.slug)}
              className="inline-flex min-h-6 items-center rounded-control underline decoration-transparent underline-offset-4 transition-colors hover:decoration-accent"
            >
              {project.title}
            </Link>
          </Heading>
        </div>
        <p className="text-sm text-muted">{project.summary}</p>
        <TagList items={project.tech} label={`${project.title} technologies`} />

        {project.repoUrl || project.liveUrl ? (
          <div className="mt-auto flex flex-wrap gap-3 pt-1">
            {project.repoUrl ? (
              <ExternalLink
                href={project.repoUrl}
                aria-label={`Source code for ${project.title}`}
                className={buttonClasses("secondary", "sm")}
              >
                <GitHubIcon className="size-4" />
                Code
              </ExternalLink>
            ) : null}
            {project.liveUrl ? (
              <ExternalLink
                href={project.liveUrl}
                aria-label={`Live site for ${project.title}`}
                className={buttonClasses("primary", "sm")}
              >
                <ExternalIcon className="size-4" />
                Live
              </ExternalLink>
            ) : null}
          </div>
        ) : (
          <p className="mt-auto pt-1 text-sm text-muted">No public link available</p>
        )}
      </div>
    </article>
  );
}
