import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { ExperienceSection } from "@/components/site/experience-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
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
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of Rwanda" },
  sameAs: profile.social.map((link) => link.href),
};

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <AboutSection />
        <SkillsSection />
        <ProjectsSection />
        <ExperienceSection />
        <ContactSection />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
      />
    </>
  );
}
