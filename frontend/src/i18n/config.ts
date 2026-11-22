/**
 * The site's languages. Every language uses the same addresses (`/projects`): the visitor picks a
 * language in the header menu, which stores it in the `lang` cookie, and the proxy serves the
 * matching pre-rendered page (`src/proxy.ts`). English without a choice. Safe in server and
 * client code.
 */
export const LOCALES = ["en", "fr", "rw"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The cookie that remembers the visitor's language (set by the language menu). */
export const LOCALE_COOKIE = "lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Short labels for the language menu and the names announced by screen readers. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  fr: { short: "FR", name: "Français" },
  rw: { short: "RW", name: "Ikinyarwanda" },
};

/** Open Graph locales (language_TERRITORY). */
export const OG_LOCALES: Record<Locale, string> = { en: "en_US", fr: "fr_FR", rw: "rw_RW" };

/**
 * A site path in a language. Addresses are the same in every language (the language comes from
 * the visitor's choice), so this returns the path unchanged; links call it so that the address
 * scheme lives in one place.
 */
export function localePath(_lang: Locale, path: string): string {
  return path;
}

/**
 * The same pathname without a language prefix. Next reports the internal, rewritten path
 * (`/fr/projects`) to client code, so analytics and links use this to get the visible address.
 */
export function parsePath(pathname: string): { lang: Locale; path: string } {
  const segment = pathname.split("/")[1];
  if (isLocale(segment)) {
    const path = pathname.slice(segment.length + 1);
    return { lang: segment, path: path === "" ? "/" : path };
  }
  return { lang: DEFAULT_LOCALE, path: pathname || "/" };
}
