import About from '../components/About'
import Contact from '../components/Contact'
import Education from '../components/Education'
import Experience from '../components/Experience'
import Hero from '../components/Hero'
import Principles from '../components/Principles'
import Projects from '../components/Projects'
import Skills from '../components/Skills'
import WritingTeaser from '../components/WritingTeaser'
import { useSiteContent } from '../content/SiteContent'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta, useReveal } from '../hooks/usePageEffects'
import { resumeUrl } from '../api'

export default function HomePage() {
  const { language } = useLanguage()
  const content = useSiteContent()
  const { profile, site } = content

  useDocumentMeta({
    title: null,
    description: profile.seo_description || profile.hero_summary,
    image: profile.og_image?.url,
  })
  useReveal([language, site])

  // The bundled fallback links the static PDF; live data uses the managed resume.
  const resumeHref = site.isFallback || !profile.resume_url ? '/Resume.pdf' : resumeUrl

  return (
    <>
      <Hero profile={profile} resumeHref={resumeHref} />
      <Principles principles={profile.engineering_principles} />
      <About profile={profile} />
      <Experience items={content.experience} />
      <Projects projects={content.projects} />
      <Skills groups={content.skills} />
      <Education education={content.education} certifications={content.certifications} />
      <WritingTeaser articles={content.articles} />
      <Contact profile={profile} />
    </>
  )
}
