import { ExternalLink } from "@/components/ui/external-link";
import { ExternalIcon, GitHubIcon } from "@/components/ui/icons";
import { cardClasses } from "@/components/ui/section";
import { TagList } from "@/components/ui/tag";
import type { Project } from "@/content/profile";

const linkClasses =
  "inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-medium text-accent transition-colors hover:text-accent-hover";

/**
 * Project summary card. The cover is typographic: no project imagery has been
 * verified yet, so none is invented.
 */
export function ProjectCard({ project }: { project: Project }) {
  const titleId = `project-${project.slug}`;
  return (
    <article
      aria-labelledby={titleId}
      className={`${cardClasses} group flex h-full flex-col overflow-hidden transition-colors hover:border-border-strong`}
    >
      <div className="relative flex h-36 items-end overflow-hidden border-b border-border bg-surface p-5">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,var(--color-accent-soft),transparent_60%)]"
        />
        {project.featured ? (
          <span className="absolute top-4 left-4 rounded-pill bg-warning px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
            Featured
          </span>
        ) : null}
        <p
          aria-hidden="true"
          className="relative font-display text-3xl font-extrabold tracking-tight text-fg/90 transition-colors group-hover:text-fg"
        >
          {project.title}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="mb-1 font-mono text-xs text-accent">{project.category}</p>
          <h3 id={titleId} className="font-display text-lg font-semibold text-fg">
            {project.title}
          </h3>
        </div>
        <p className="text-sm text-muted">{project.summary}</p>
        <TagList items={project.tech} label={`${project.title} technologies`} />

        {project.repoUrl || project.liveUrl ? (
          <div className="mt-auto flex flex-wrap gap-x-5 border-t border-border pt-3">
            {project.repoUrl ? (
              <ExternalLink
                href={project.repoUrl}
                aria-label={`Source code for ${project.title}`}
                className={linkClasses}
              >
                <GitHubIcon className="size-4" />
                Source
              </ExternalLink>
            ) : null}
            {project.liveUrl ? (
              <ExternalLink
                href={project.liveUrl}
                aria-label={`Live site for ${project.title}`}
                className={linkClasses}
              >
                <ExternalIcon className="size-4" />
                Live site
              </ExternalLink>
            ) : null}
          </div>
        ) : (
          <p className="mt-auto border-t border-border pt-3 text-sm text-muted">No public link available</p>
        )}
      </div>
    </article>
  );
}
