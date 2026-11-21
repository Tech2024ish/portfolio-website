import { getPublicContent } from "@/lib/content/portfolio";
import { OG_CONTENT_TYPE, OG_SIZE, socialCard } from "@/lib/og-image";
import { siteName } from "@/lib/site";

/** The default sharing image for every page without its own (home, projects, notes, 404). */
export const alt = `${siteName}, Backend Software Engineer`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const { profile } = await getPublicContent();
  return socialCard({
    eyebrow: profile.title,
    title: profile.name,
    description: profile.headline,
    footer: profile.location,
  });
}
