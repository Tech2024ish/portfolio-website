import { serializeJsonLd } from "@/lib/json-ld";

/** Structured data for search engines; `<` is escaped so no value can close the script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
