import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { JsonLd } from "@/components/site/json-ld";
import { SiteShell } from "@/components/site/site-shell";
import { SkillsSection } from "@/components/site/skills-section";
import { getPublicContent } from "@/lib/content/portfolio";
import { homeGraph } from "@/lib/structured-data";

export default async function HomePage() {
  const content = await getPublicContent();
  const { profile } = content;
  return (
    <>
      <SiteShell page="home" profile={profile} articleCount={content.articles.length}>
        <Hero profile={profile} />
        <AboutSection profile={profile} principles={content.principles} />
        <SkillsSection skillGroups={content.skillGroups} />
        <ProjectsSection projects={content.projects} />
        <ExperienceSection
          experience={content.experience}
          education={content.education}
          certifications={content.certifications}
        />
        <ContactSection profile={profile} />
      </SiteShell>
      <JsonLd data={homeGraph(profile)} />
    </>
  );
}
