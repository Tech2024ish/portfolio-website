import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { SiteShell } from "@/components/site/site-shell";
import { SkillsSection } from "@/components/site/skills-section";
import { profile } from "@/content/profile";
import { serializeJsonLd } from "@/lib/json-ld";
import { siteDescription, siteUrl } from "@/lib/site";

/** schema.org Person data for search engines, built only from the verified profile. */
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.title,
  description: siteDescription,
  url: siteUrl.toString(),
  image: new URL("/ishimwe-jean-claude.png", siteUrl).toString(),
  email: `mailto:${profile.email}`,
  address: { "@type": "PostalAddress", addressLocality: "Kigali", addressCountry: "RW" },
  sameAs: profile.social.map((link) => link.href),
};

export default function HomePage() {
  return (
    <>
      <SiteShell page="home">
        <Hero />
        <AboutSection />
        <SkillsSection />
        <ProjectsSection />
        <ExperienceSection />
        <ContactSection />
      </SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
      />
    </>
  );
}
