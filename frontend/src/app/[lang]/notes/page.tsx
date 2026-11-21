import type { Metadata } from "next";

import { NotesIndex } from "@/components/site/notes";
import { PageHeader } from "@/components/site/page-header";
import { SiteShell } from "@/components/site/site-shell";
import { OG_LOCALES } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { alternatesFor } from "@/i18n/seo";
import { localeFrom } from "@/i18n/server";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicContent } from "@/lib/content/portfolio";

// Declared here rather than with Next's generated PageProps<...> (see app/[lang]/layout.tsx).
type NotesPageProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: NotesPageProps): Promise<Metadata> {
  const lang = await localeFrom(params);
  const t = dictionary(lang).meta;
  const { profile, articles } = await getPublicContent(lang);
  const description = t.notesDescription(profile.name);
  const alternates = alternatesFor(lang, "/notes");
  return {
    title: t.notesTitle,
    description,
    alternates,
    openGraph: {
      title: `${t.notesTitle} · ${profile.name}`,
      description,
      url: alternates.canonical,
      locale: OG_LOCALES[lang],
    },
    // An empty listing has nothing worth indexing; it is not linked from the site until a note exists.
    robots: articles.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function NotesPage({ params }: NotesPageProps) {
  const lang = await localeFrom(params);
  const t = dictionary(lang).notes;
  const content = await getPublicContent(lang);
  return (
    <SiteShell
      page="notes"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
      lang={lang}
    >
      <PageHeader eyebrow={t.eyebrow} title={t.pageTitle} description={<p>{t.pageDescription}</p>} />
      <NotesIndex articles={content.articles} lang={lang} />
    </SiteShell>
  );
}
