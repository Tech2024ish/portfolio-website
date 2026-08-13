import { useEffect, useMemo, useState } from 'react'
import { useTheme } from './context/ThemeContext'
import { useLanguage } from './context/LanguageContext'
import About from './components/About'
import Contact from './components/Contact'
import Experience from './components/Experience'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Navbar from './components/Navbar'
import Projects from './components/Projects'
import Skills from './components/Skills'

const LINKEDIN_URL = 'https://www.linkedin.com/in/ishimwe-jean-claude-goslish/'

export default function App() {
  const { dark, setDark } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('home')
  const [filter, setFilter] = useState('all')

  const visibleProjects = useMemo(() => {
    if (filter === 'all') return t.projects.items
    const index = filter === 'web' ? 0 : filter === 'full' ? 1 : 2
    return [t.projects.items[index]]
  }, [filter, t.projects.items])

  useEffect(() => {
    const sections = document.querySelectorAll('main section[id]')
    const sectionObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: '-30% 0px -60% 0px' },
    )

    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) => entry.isIntersecting && entry.target.classList.add('is-visible'),
        ),
      { threshold: 0.12 },
    )

    sections.forEach((section) => sectionObserver.observe(section))
    document.querySelectorAll('.reveal').forEach((item) => revealObserver.observe(item))

    return () => {
      sectionObserver.disconnect()
      revealObserver.disconnect()
    }
  }, [language])

  const navigate = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const updateLanguage = (code) => {
    setLanguage(code)
    setMenuOpen(false)
  }

  return (
    <div className="site-shell">
      <Navbar
        dark={dark}
        setDark={setDark}
        language={language}
        setLanguage={updateLanguage}
        labels={{ ...t.nav, themeLight: t.theme.light, themeDark: t.theme.dark }}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        active={active}
        navigate={navigate}
      />

      <main>
        <Hero content={t.hero} navigate={navigate} />
        <About content={t.about} />
        <Experience content={t.experience} />
        <Projects
          content={t.projects}
          projects={visibleProjects}
          filter={filter}
          setFilter={setFilter}
        />
        <Skills content={t.skills} />
        <Contact content={t.contact} linkedin={LINKEDIN_URL} />
      </main>

      <Footer description={t.footer} />
    </div>
  )
}
