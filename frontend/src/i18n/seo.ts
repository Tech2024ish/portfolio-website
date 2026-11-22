import type { Locale } from "./config";

/**
 * Canonical URL of a page. Every language shares the same address (the language is the
 * visitor's choice), so the canonical URL is the path itself in every language.
 */
export function alternatesFor(_lang: Locale, path: string) {
  return { canonical: path };
}
