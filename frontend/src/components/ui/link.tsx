import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

/** Inline text link style; always underlined so links are not distinguished by colour alone. */
export const textLinkClasses =
  "text-accent underline underline-offset-4 decoration-accent/50 transition-colors hover:text-accent-hover hover:decoration-accent-hover";

/**
 * A link inside running text or a list. Uses next/link, so in-site routes are prefetched and
 * navigate client-side; hash, mailto and other hrefs render as ordinary anchors.
 * For links to other sites use ExternalLink (it opens a new tab safely and says so).
 */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cx(textLinkClasses, className)} {...props} />;
}
