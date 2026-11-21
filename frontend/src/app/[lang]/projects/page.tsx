import type { Metadata } from "next";

import { JsonLd } from "@/components/site/json-ld";
import { PageHeader } from "@/components/site/page-header";
import { ProjectsIndex } from "@/components/site/projects-index";
import { SiteShell } from "@/components/site/site-shell";
import { OG_LOCALES } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { alternatesFor } from "@/i18n/seo";
import { localeFrom } from "@/i18n/server";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicContent } from "@/lib/content/portfolio";
import { projectsGraph } from "@/lib/structured-data";

// Declared here rather than with Next's generated PageProps<...> (see app/[lang]/layout.tsx).
type ProjectsPageProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: ProjectsPageProps): Promise<Metadata> {
  const lang = await localeFrom(params);
  const t = dictionary(lang).meta;
  const { profile } = await getPublicContent(lang);
  const description = t.projectsDescription(profile.name);
  const alternates = alternatesFor(lang, "/projects");
  return {
    title: t.projectsTitle,
    description,
    alternates,
    openGraph: {
      title: `${t.projectsTitle} · ${profile.name}`,
      description,
      url: alternates.canonical,
      locale: OG_LOCALES[lang],
    },
  };
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const lang = await localeFrom(params);
  const t = dictionary(lang).projects;
  const content = await getPublicContent(lang);
  return (
    <SiteShell
      page="projects"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
      lang={lang}
    >
      <PageHeader eyebrow={t.pageTitle} title={t.pageTitle} description={<p>{t.pageDescription}</p>} />
      <ProjectsIndex projects={content.projects} lang={lang} />
      <JsonLd data={projectsGraph(content.projects)} />
    </SiteShell>
  );
}
