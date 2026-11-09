import type { ReactNode } from "react";

/** A technology or keyword label. Not interactive. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-control border border-border-strong bg-raised px-2.5 py-1 font-mono text-xs text-fg/90">
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

/** Green "available" status pill with a live dot (decorative). */
export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex w-fit items-center gap-2 rounded-pill border border-success/30 bg-success-soft px-3 py-1 text-sm text-success">
      <span aria-hidden="true" className="size-2 rounded-full bg-success" />
      {children}
    </p>
  );
}
