import type { ReactNode } from "react";

/** Page-width wrapper shared by the header, every section and the footer. */
export const containerClasses = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

type SectionProps = {
  id: string;
  title: string;
  /** Short mono label above the heading, e.g. "Skills". */
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
};

/**
 * A landmark section labelled by its own heading. `scroll-mt` keeps anchored
 * headings clear of the sticky header.
 */
export function Section({ id, title, eyebrow, description, children }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 py-16 sm:py-20">
      <div className={containerClasses}>
        <div className="mb-8 max-w-2xl sm:mb-10">
          {eyebrow ? <p className="mb-2 font-mono text-sm text-accent">{eyebrow}</p> : null}
          <h2 id={headingId} className="font-display text-2xl font-bold tracking-tight text-fg sm:text-title">
            {title}
          </h2>
          {description ? <p className="mt-3 text-base text-muted sm:text-body">{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Surface card used across sections. */
export const cardClasses = "rounded-card border border-border bg-card";
