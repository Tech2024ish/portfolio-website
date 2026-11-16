const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parts(isoDate: string): { month: string; year: string } {
  const [year, month] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!year || !name) throw new Error(`Not an ISO date: ${isoDate}`);
  return { month: name, year };
}

/**
 * A role's dates as the site writes them: "January 2026 – Present", "January – September 2026"
 * or "October 2025 – March 2026". Inputs are ISO dates (the first of the month).
 * scripts/export-content.mjs parses exactly these forms back.
 */
export function formatPeriod(start: string, end: string | null, current: boolean): string {
  const from = parts(start);
  if (current || !end) return `${from.month} ${from.year} – Present`;
  const to = parts(end);
  if (from.year === to.year) return `${from.month} – ${to.month} ${to.year}`;
  return `${from.month} ${from.year} – ${to.month} ${to.year}`;
}
