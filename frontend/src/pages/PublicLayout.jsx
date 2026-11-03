import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { useSiteContent } from '../content/SiteContent'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

export default function PublicLayout() {
  const { ui } = useLanguage()
  const { site, status } = useSiteContent()
  const { applyDefault } = useTheme()
  const location = useLocation()

  useEffect(() => {
    if (status === 'ready') applyDefault(site.profile.default_theme)
  }, [status, site.profile.default_theme, applyDefault])

  // Scroll handling for client-side navigation: hash targets or top of page.
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        {ui.common.skip}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
