import type { ComponentPropsWithRef } from "react";

import { cx } from "@/lib/cx";

import { cardClasses } from "./section";

/**
 * A bordered surface for grouping related content. `interactive` adds hover feedback for cards
 * that contain a single primary link or action. For other elements (article, li) apply
 * `cardClasses` directly.
 */
export function Card({
  interactive = false,
  className,
  ...props
}: ComponentPropsWithRef<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        cardClasses,
        interactive && "transition-colors hover:border-border-strong hover:bg-raised",
        className,
      )}
      {...props}
    />
  );
}
