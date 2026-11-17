import type { Metadata } from "next";

import { NotesIndex } from "@/components/site/notes";
import { PageHeader } from "@/components/site/page-header";
import { SiteShell } from "@/components/site/site-shell";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicContent } from "@/lib/content/portfolio";

export async function generateMetadata(): Promise<Metadata> {
  const { profile, articles } = await getPublicContent();
  const description = `Engineering Notes by ${profile.name}: write-ups on backend engineering.`;
  return {
    title: "Engineering Notes",
    description,
    alternates: { canonical: "/notes" },
    openGraph: { title: `Engineering Notes · ${profile.name}`, description, url: "/notes" },
    // An empty listing has nothing worth indexing; it is not linked from the site until a note exists.
    robots: articles.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function NotesPage() {
  const content = await getPublicContent();
  return (
    <SiteShell
      page="notes"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
    >
      <PageHeader
        eyebrow="Notes"
        title="Engineering Notes"
        description={
          <p>
            Write-ups on backend engineering: design decisions, trade-offs and lessons from real projects.
          </p>
        }
      />
      <NotesIndex articles={content.articles} />
    </SiteShell>
  );
}
