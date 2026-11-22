import "server-only";

import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * The page's language, for Server Components that do not receive `params` (not-found and loading
 * files). Reads the root parameter of app/[lang]; falls back to English outside it.
 */
export async function currentLocale(): Promise<Locale> {
  let value: string | undefined;
  try {
    value = await lang();
  } catch {
    return DEFAULT_LOCALE;
  }
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The language from a page's `params`; any other value is a 404. */
export async function localeFrom(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang: value } = await params;
  if (!isLocale(value)) notFound();
  return value;
}
