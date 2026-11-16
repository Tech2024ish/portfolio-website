import type { Metadata } from "next";

import { NotesIndex } from "@/components/site/notes";
import { PageHeader } from "@/components/site/page-header";
import { SiteShell } from "@/components/site/site-shell";
import { profile, sortedArticles } from "@/content/profile";

const articles = sortedArticles();
const description = `Engineering Notes by ${profile.name}: write-ups on backend engineering.`;

export const metadata: Metadata = {
  title: "Engineering Notes",
  description,
  alternates: { canonical: "/notes" },
  openGraph: { title: `Engineering Notes · ${profile.name}`, description, url: "/notes" },
  // An empty listing has nothing worth indexing; it is not linked from the site until a note exists.
  robots: articles.length === 0 ? { index: false, follow: true } : undefined,
};

export default function NotesPage() {
  return (
    <SiteShell page="notes">
      <PageHeader
        eyebrow="Notes"
        title="Engineering Notes"
        description={
          <p>
            Write-ups on backend engineering: design decisions, trade-offs and lessons from real projects.
          </p>
        }
      />
      <NotesIndex articles={articles} />
    </SiteShell>
  );
}
