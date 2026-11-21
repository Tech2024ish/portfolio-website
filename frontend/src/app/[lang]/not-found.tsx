import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/site/page-header";
import { SiteShell } from "@/components/site/site-shell";
import { buttonClasses } from "@/components/ui/button";
import { containerClasses } from "@/components/ui/section";
import { localePath } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";
import { hiddenSections } from "@/lib/content/settings";
import { getPublicContent } from "@/lib/content/portfolio";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dictionary(await currentLocale()).meta.notFoundTitle };
}

/**
 * Shown for unknown URLs and for anything unpublished (Next.js answers 404 and adds noindex), in
 * the language of the address. It says nothing about whether the page exists as a draft.
 */
export default async function NotFound() {
  const lang = await currentLocale();
  const t = dictionary(lang).errors;
  const content = await getPublicContent(lang);
  return (
    <SiteShell
      page="other"
      profile={content.profile}
      articleCount={content.articles.length}
      hidden={hiddenSections(content.settings)}
      track={false}
      lang={lang}
    >
      <PageHeader eyebrow={t.notFoundEyebrow} title={t.notFoundTitle} description={<p>{t.notFoundBody}</p>} />
      <div className={`${containerClasses} flex flex-wrap gap-3 py-12`}>
        <Link href={localePath(lang, "/")} className={buttonClasses("primary", "sm")}>
          {t.goHome}
        </Link>
        <Link href={localePath(lang, "/projects")} className={buttonClasses("secondary", "sm")}>
          {t.seeProjects}
        </Link>
      </div>
    </SiteShell>
  );
}
