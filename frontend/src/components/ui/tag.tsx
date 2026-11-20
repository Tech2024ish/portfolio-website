import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/** A technology or keyword label. Not interactive. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-control bg-raised px-2.5 py-1 text-xs font-medium text-fg">
      {children}
    </span>
  );
}

export function TagList({ items, label }: { items: readonly string[]; label: string }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((item) => (
        <li key={item}>
          <Tag>{item}</Tag>
        </li>
      ))}
    </ul>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-border-strong bg-raised text-fg",
  accent: "border-accent/40 bg-accent-soft text-accent",
  success: "border-success/30 bg-success-soft text-success-fg",
  warning: "border-warning/40 bg-warning-soft text-warning",
  danger: "border-danger-fg/40 bg-danger-soft text-danger-fg",
};

/**
 * A compact status label (e.g. "Published", "Draft"). The text carries the meaning; colour only
 * reinforces it, and the optional dot is decorative.
 */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Green "available" status pill with a live dot (decorative). */
export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex w-fit items-center gap-2 rounded-pill border border-success/30 bg-success-soft px-3 py-1 text-sm text-success-fg">
      <span aria-hidden="true" className="size-2 rounded-full bg-success" />
      {children}
    </p>
  );
}
