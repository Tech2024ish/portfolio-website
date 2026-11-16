import { getPublicContent } from "@/lib/content/portfolio";
import { OG_CONTENT_TYPE, OG_SIZE, socialCard } from "@/lib/og-image";

// This page sets its own `openGraph` metadata, which replaces the inherited image, so it has its own.
export const alt = "Projects";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { profile, projects } = await getPublicContent();
  return socialCard({
    eyebrow: "Projects",
    title: "Backend platforms and APIs",
    description: projects.map((project) => project.title).join(" · "),
    footer: profile.name,
  });
}
