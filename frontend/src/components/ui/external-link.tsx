import type { AnchorHTMLAttributes, ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> & {
  href: string;
  children: ReactNode;
  /** Language of the "(opens in a new tab)" notice. */
  lang?: Locale;
};

/**
 * Link to another site. Opens in a new tab without giving it access to this window,
 * and tells screen-reader users that it will. An `aria-label`, when given, replaces the
 * visible text as the accessible name and must start with that visible text (WCAG 2.5.3).
 */
export function ExternalLink({
  children,
  "aria-label": ariaLabel,
  lang = DEFAULT_LOCALE,
  ...rest
}: ExternalLinkProps) {
  const notice = dictionary(lang).shell.opensInNewTab;
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ? `${ariaLabel} ${notice}` : undefined}
      {...rest}
    >
      {children}
      {ariaLabel ? null : <span className="sr-only">{` ${notice}`}</span>}
    </a>
  );
}
