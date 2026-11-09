/**
 * Serialises structured data for a `<script type="application/ld+json">` element.
 * "<" is escaped as the JSON unicode escape for U+003C, so no value can close the script tag early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
