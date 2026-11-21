import { getPublicContent } from "@/lib/content/portfolio";
import { OG_CONTENT_TYPE, OG_SIZE, socialCard } from "@/lib/og-image";

// This page sets its own `openGraph` metadata, which replaces the inherited image, so it has its own.
export const alt = "Engineering Notes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { profile } = await getPublicContent();
  return socialCard({
    eyebrow: "Engineering Notes",
    title: "Notes on backend engineering",
    description: "Design decisions, trade-offs and lessons from real projects.",
    footer: profile.name,
  });
}
