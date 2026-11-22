import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { JsonLd } from "@/components/site/json-ld";
import { SiteShell } from "@/components/site/site-shell";
import { SkillsSection } from "@/components/site/skills-section";
import { localeFrom } from "@/i18n/server";
import { getPublicContent } from "@/lib/content/portfolio";
import { hiddenSections } from "@/lib/content/settings";
import { homeGraph } from "@/lib/structured-data";

// Declared here rather than with Next's generated PageProps<...> (see app/[lang]/layout.tsx).
type HomePageProps = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: HomePageProps) {
  const lang = await localeFrom(params);
  const content = await getPublicContent(lang);
  const { profile, settings } = content;
  return (
    <>
      <SiteShell
        page="home"
        profile={profile}
        articleCount={content.articles.length}
        hidden={hiddenSections(settings)}
        lang={lang}
      >
        <Hero profile={profile} showCv={settings.showCvDownload} lang={lang} />
        <AboutSection profile={profile} principles={content.principles} lang={lang} />
        {settings.showSkills ? <SkillsSection skillGroups={content.skillGroups} lang={lang} /> : null}
        <ProjectsSection projects={content.projects} limit={settings.homeProjectCount} lang={lang} />
        {settings.showExperience ? (
          <ExperienceSection
            experience={content.experience}
            education={content.education}
            certifications={content.certifications}
            lang={lang}
          />
        ) : null}
        <ContactSection
          profile={profile}
          showForm={settings.showContactForm}
          showCv={settings.showCvDownload}
          lang={lang}
        />
      </SiteShell>
      <JsonLd data={homeGraph(profile)} />
    </>
  );
}
