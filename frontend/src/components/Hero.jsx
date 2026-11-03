import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'

export default function Hero({ profile, resumeHref }) {
  const { t } = useLanguage()
  const socials = [
    ...profile.social_links,
    ...(profile.email ? [{ label: 'Email', url: `mailto:${profile.email}` }] : []),
  ]
  const photo = profile.photo?.url || '/ishimwe-jean-claude.png'

  return (
    <section id="home" className="hero section-pad">
      <div className="hero-grid">
        <div className="hero-copy reveal">
          <p className="kicker">
            {profile.is_available && <span className="status-dot" aria-hidden="true" />}
            {profile.is_available ? profile.availability_text : profile.professional_title}
          </p>
          <h1>
            {profile.hero_title} <em>{profile.hero_title_accent}</em>
          </h1>
          <p className="hero-summary">{profile.hero_summary}</p>
          <div className="hero-actions">
            <Link className="button primary" to="/projects">
              {t.hero.projects} <span aria-hidden="true">&rarr;</span>
            </Link>
            <a
              className="button secondary"
              href={resumeHref}
              download="Jean_Claude_Ishimwe_Resume.pdf"
            >
              {t.hero.resume} <span aria-hidden="true">&darr;</span>
            </a>
            <a className="text-link" href="#contact">
              {t.hero.contact} <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div className="social-row">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target={social.url.startsWith('mailto') ? undefined : '_blank'}
                rel="noreferrer"
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hero-visual reveal">
          <div className="portrait-frame">
            <img
              src={photo}
              alt={profile.photo?.alt_text || `${profile.full_name} portrait`}
              width="390"
              height="500"
              fetchpriority="high"
            />
          </div>
          <div className="hero-id">
            <strong>{profile.full_name}</strong>
            <span>
              {profile.professional_title} · {profile.location}
            </span>
          </div>
        </div>
      </div>
      <div className="scroll-cue">
        {t.hero.scroll} <span aria-hidden="true">&darr;</span>
      </div>
    </section>
  )
}
