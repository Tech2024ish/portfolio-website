import type { ReactNode } from "react";

/** Page-width wrapper shared by the header, every section and the footer. */
export const containerClasses = "mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8";

type SectionProps = {
  id: string;
  title: string;
  description?: ReactNode;
  /** "band": a light background that sets the section apart from its neighbours. */
  tone?: "plain" | "band";
  children: ReactNode;
};

/**
 * A landmark section labelled by its own centred heading. `scroll-mt` keeps anchored
 * headings clear of the sticky header.
 */
export function Section({ id, title, description, tone = "plain", children }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-16 py-8 sm:py-10 ${tone === "band" ? "bg-surface" : ""}`}
    >
      <div className={containerClasses}>
        <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
          <h2 id={headingId} className="font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl">
            {title}
          </h2>
          {description ? <p className="mt-3 text-base text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Surface card used across sections. */
export const cardClasses = "rounded-card border border-border bg-card";
