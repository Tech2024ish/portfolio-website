import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { JsonLd } from "@/components/site/json-ld";
import { SiteShell } from "@/components/site/site-shell";
import { SkillsSection } from "@/components/site/skills-section";
import { getPublicContent } from "@/lib/content/portfolio";
import { hiddenSections } from "@/lib/content/settings";
import { homeGraph } from "@/lib/structured-data";

export default async function HomePage() {
  const content = await getPublicContent();
  const { profile, settings } = content;
  return (
    <>
      <SiteShell
        page="home"
        profile={profile}
        articleCount={content.articles.length}
        hidden={hiddenSections(settings)}
      >
        <Hero profile={profile} showCv={settings.showCvDownload} />
        <AboutSection profile={profile} principles={content.principles} />
        {settings.showSkills ? <SkillsSection skillGroups={content.skillGroups} /> : null}
        <ProjectsSection projects={content.projects} limit={settings.homeProjectCount} />
        {settings.showExperience ? (
          <ExperienceSection
            experience={content.experience}
            education={content.education}
            certifications={content.certifications}
          />
        ) : null}
        <ContactSection
          profile={profile}
          showForm={settings.showContactForm}
          showCv={settings.showCvDownload}
        />
      </SiteShell>
      <JsonLd data={homeGraph(profile)} />
    </>
  );
}
