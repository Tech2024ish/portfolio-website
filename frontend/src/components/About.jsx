import { paragraphs } from '../content/SiteContent'
import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

export default function About({ profile }) {
  const { t } = useLanguage()
  return (
    <section id="about" className="section-pad section-muted">
      <div className="content-grid">
        <SectionHeading eyebrow={t.about.eyebrow} title={profile.about_title} />
        <div className="about-copy reveal">
          <p className="lead">{profile.about_lead}</p>
          {paragraphs(profile.about_body).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
