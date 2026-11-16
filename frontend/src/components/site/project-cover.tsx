import { cx } from "@/lib/cx";

import type { Project } from "@/content/profile";

/**
 * A project's thumbnail. It is typographic and decorative: no project imagery has been verified,
 * so none is invented. The title it shows is repeated in a real heading next to it.
 */
export function ProjectCover({
  project,
  className,
}: {
  project: Pick<Project, "title" | "featured">;
  className?: string;
}) {
  return (
    <div className={cx("relative flex h-36 items-end overflow-hidden bg-surface p-5", className)}>
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
  );
}
