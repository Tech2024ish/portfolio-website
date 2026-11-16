import type { ReactNode } from "react";

import { containerClasses } from "@/components/ui/section";

/** The top of an inner page: optional eyebrow, the page's single h1 and an introduction. */
export function PageHeader({
  eyebrow,
  title,
  titleId,
  description,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  /** Lets an enclosing landmark (e.g. an article) be labelled by the page title. */
  titleId?: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className={`${containerClasses} flex flex-col gap-4 py-12 sm:py-16`}>
        {eyebrow ? <div className="font-mono text-sm text-accent">{eyebrow}</div> : null}
        <h1
          id={titleId}
          className="font-display text-3xl font-extrabold tracking-tight text-fg sm:text-display"
        >
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-base text-muted sm:text-body">{description}</div>
        ) : null}
        {children}
      </div>
    </header>
  );
}
