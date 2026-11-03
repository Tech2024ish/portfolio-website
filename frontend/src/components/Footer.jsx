import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'
import { useSiteContent } from '../content/SiteContent'

export default function Footer() {
  const { t, ui } = useLanguage()
  const { profile, articles } = useSiteContent()
  const socials = [
    ...profile.social_links,
    ...(profile.email ? [{ label: 'Email', url: `mailto:${profile.email}` }] : []),
  ]
  return (
    <footer className="site-footer">
      <div>
        <strong>
          {profile.full_name}
          <span>.</span>
        </strong>
        <p>
          {profile.professional_title} · {profile.location}
        </p>
      </div>
      <nav className="footer-socials" aria-label="Footer">
        <Link to="/projects">{t.nav.projects}</Link>
        {articles.length > 0 && <Link to="/writing">{ui.nav.writing}</Link>}
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
      </nav>
      <p>
        &copy; {new Date().getFullYear()} {profile.full_name}
      </p>
    </footer>
  )
}
