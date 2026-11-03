import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useSiteContent } from '../content/SiteContent'
import ThemeIcon from './common/ThemeIcon'

const languageOptions = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'rw', label: 'RW' },
]
const sectionIds = ['home', 'about', 'experience', 'projects', 'skills', 'contact']

export default function Navbar() {
  const { dark, setDark } = useTheme()
  const { language, setLanguage, t, ui } = useLanguage()
  const { articles } = useSiteContent()
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('home')
  const location = useLocation()
  const navigate = useNavigate()
  const onHome = location.pathname === '/'

  useEffect(() => {
    if (!onHome) return undefined
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: '-30% 0px -60% 0px' },
    )
    sectionIds.forEach((id) => {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [onHome, language])

  const goToSection = (id) => {
    setMenuOpen(false)
    if (onHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', id === 'home' ? '/' : `/#${id}`)
    } else {
      navigate(id === 'home' ? '/' : `/#${id}`)
    }
  }

  const routeActive = (prefix) => location.pathname.startsWith(prefix)

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" to="/" aria-label="Jean Claude Ishimwe — home">
          <span aria-hidden="true">JC</span>
          <strong>
            Jean Claude<span>.</span>
          </strong>
        </Link>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-navigation"
          className={menuOpen ? 'nav-links open' : 'nav-links'}
          aria-label="Primary navigation"
          onClick={(event) => event.target.closest('a') && setMenuOpen(false)}
        >
          {sectionIds.map((id) =>
            id === 'projects' ? (
              <Link
                key={id}
                to="/projects"
                className={routeActive('/projects') || (onHome && active === id) ? 'active' : ''}
                aria-current={routeActive('/projects') ? 'page' : undefined}
              >
                {t.nav.projects}
              </Link>
            ) : (
              <button
                key={id}
                className={onHome && active === id ? 'active' : ''}
                onClick={() => goToSection(id)}
              >
                {t.nav[id]}
              </button>
            ),
          )}
          {articles.length > 0 && (
            <Link
              to="/writing"
              className={routeActive('/writing') ? 'active' : ''}
              aria-current={routeActive('/writing') ? 'page' : undefined}
            >
              {ui.nav.writing}
            </Link>
          )}

          <label className="language-select">
            <span className="sr-only">Language</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label="Select language"
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="theme-toggle"
            onClick={() => setDark(!dark)}
            aria-label={dark ? t.theme.light : t.theme.dark}
          >
            <ThemeIcon dark={dark} />
          </button>
        </nav>
      </div>
    </header>
  )
}
