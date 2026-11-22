import { PERIOD_WORDS, type TranslatedLanguage } from "@/content/translations";

type PeriodLanguage = "en" | TranslatedLanguage;

function parts(isoDate: string, lang: PeriodLanguage): { month: string; year: string } {
  const [year, month] = isoDate.split("-");
  const name = PERIOD_WORDS[lang].months[Number(month) - 1];
  if (!year || !name) throw new Error(`Not an ISO date: ${isoDate}`);
  return { month: name, year };
}

/**
 * A role's dates as the site writes them, in the page's language: "January 2026 – Present",
 * "January – September 2026" or "October 2025 – March 2026" ("janvier 2026 – aujourd'hui"...).
 * Inputs are ISO dates (the first of the month). scripts/export-content.mjs parses the English
 * forms back.
 */
export function formatPeriod(
  start: string,
  end: string | null,
  current: boolean,
  lang: PeriodLanguage = "en",
): string {
  const from = parts(start, lang);
  if (current || !end) return `${from.month} ${from.year} – ${PERIOD_WORDS[lang].present}`;
  const to = parts(end, lang);
  if (from.year === to.year) return `${from.month} – ${to.month} ${to.year}`;
  return `${from.month} ${from.year} – ${to.month} ${to.year}`;
}
