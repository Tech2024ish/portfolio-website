import { cx } from "@/lib/cx";

import type { Project } from "@/content/profile";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

/**
 * A project's thumbnail. It is typographic and decorative: no project imagery has been verified,
 * so none is invented. The title it shows is repeated in a real heading next to it.
 */
export function ProjectCover({
  project,
  className,
  lang = DEFAULT_LOCALE,
}: {
  project: Pick<Project, "title" | "featured">;
  className?: string;
  lang?: Locale;
}) {
  return (
    <div className={cx("relative flex h-36 items-end overflow-hidden bg-raised p-5", className)}>
      {project.featured ? (
        <span className="absolute top-4 left-4 rounded-pill bg-warning px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
          {dictionary(lang).projects.featured}
        </span>
      ) : null}
      <p
        aria-hidden="true"
        className="relative text-3xl font-semibold tracking-tight text-fg/80 transition-colors group-hover:text-fg"
      >
        {project.title}
      </p>
    </div>
  );
}
