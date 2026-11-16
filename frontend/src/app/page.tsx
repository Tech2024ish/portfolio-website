import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { SiteShell } from "@/components/site/site-shell";
import { SkillsSection } from "@/components/site/skills-section";
import type { Profile } from "@/content/profile";
import { getPublicContent } from "@/lib/content/portfolio";
import { serializeJsonLd } from "@/lib/json-ld";
import { siteDescription, siteUrl } from "@/lib/site";

/** schema.org Person data for search engines, built only from the published profile. */
function personJsonLd(profile: Profile) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.title,
    description: siteDescription,
    url: siteUrl.toString(),
    image: new URL(profile.portraitSrc, siteUrl).toString(),
    email: `mailto:${profile.email}`,
    address: { "@type": "PostalAddress", addressLocality: "Kigali", addressCountry: "RW" },
    sameAs: profile.social.map((link) => link.href),
  };
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd(profile)) }}
      />
    </>
  );
}
