import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { cardClasses } from "@/components/ui/section";
import { Badge } from "@/components/ui/tag";

/** Shown instead of a Studio page when FastAPI cannot answer: nothing private is rendered. */
export function StudioUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <h1 className="font-mono text-sm text-accent">Owner Studio</h1>
      <ErrorState
        headingLevel={2}
        title="The Studio is unavailable"
        description="The server could not be reached, so nothing can be shown or changed right now. Try again in a moment."
        action={
          <Link href={retryHref} className={buttonClasses("primary", "sm")}>
            Try again
          </Link>
        }
      />
    </div>
  );
}

export function StudioHeading({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-fg">{title}</h1>
        {description ? <div className="max-w-prose text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function StudioCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${cardClasses} flex flex-col gap-5 p-5 sm:p-6`}>
      <h2 id={id} className="font-display text-xl font-bold tracking-tight text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StatusLabel({ status }: { status: "draft" | "published" | undefined }) {
  if (!status) return null;
  return status === "published" ? (
    <Badge tone="success" dot>
      Published
    </Badge>
  ) : (
    <Badge tone="neutral">Draft</Badge>
  );
}
