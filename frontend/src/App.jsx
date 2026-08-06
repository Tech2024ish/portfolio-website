import { useEffect, useMemo, useState } from 'react'
import profilePic from './images/profile_picture.png'
import { sendContact } from './api'
import { useTheme } from './context/ThemeContext'
import { useLanguage } from './context/LanguageContext'

const socials = [
  { label: 'GitHub', href: 'https://github.com/Tech2024ish' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ishimwe-jean-claude-goslish/' },
  { label: 'Email', href: 'mailto:claudeish88@gmail.com' },
]
const languageOptions = [{ code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }, { code: 'rw', label: 'RW' }]

function SectionHeading({ eyebrow, title, intro }) {
  return <div className="section-heading reveal"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{intro && <p>{intro}</p>}</div>
}

function ThemeIcon({ dark }) {
  return dark
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" strokeLinecap="round" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M20.7 15.3A8.5 8.5 0 0 1 8.7 3.3 8.5 8.5 0 1 0 20.7 15.3Z" /></svg>
}

export default function App() {
  const { dark, setDark } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('home')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('')
  const navItems = ['home', 'about', 'experience', 'projects', 'skills', 'contact']
  const visibleProjects = useMemo(() => {
    if (filter === 'all') return t.projects.items
    const index = filter === 'web' ? 0 : filter === 'full' ? 1 : 2
    return [t.projects.items[index]]
  }, [filter, t.projects.items])

  useEffect(() => {
    const sections = document.querySelectorAll('main section[id]')
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)), { rootMargin: '-30% 0px -60% 0px' })
    sections.forEach((section) => observer.observe(section))
    const reveals = document.querySelectorAll('.reveal')
    const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')), { threshold: 0.12 })
    reveals.forEach((item) => revealObserver.observe(item))
    return () => { observer.disconnect(); revealObserver.disconnect() }
  }, [language])

  const navigate = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const updateLanguage = (code) => { setLanguage(code); setMenuOpen(false) }
  const submitContact = async (event) => {
    event.preventDefault(); setStatus('loading')
    try { await sendContact(form); setForm({ name: '', email: '', message: '' }); setStatus('success') } catch { setStatus('error') }
  }

  return <div className="site-shell">
    <header className="site-header"><div className="nav-wrap">
      <button className="brand" onClick={() => navigate('home')} aria-label="Go to home"><span>JC</span><strong>Jean Claude<span>.</span></strong></button>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}><span /><span /><span /></button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation">
        {navItems.map((id) => <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}>{t.nav[id]}</button>)}
        <label className="language-select"><span className="sr-only">Language</span><select value={language} onChange={(event) => updateLanguage(event.target.value)} aria-label="Select language">{languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
        <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label={dark ? t.theme.light : t.theme.dark}><ThemeIcon dark={dark} /></button>
      </nav>
    </div></header>

    <main>
      <section id="home" className="hero section-pad"><div className="hero-grid"><div className="hero-copy reveal"><p className="kicker"><span className="status-dot" /> {t.hero.availability}</p><h1>{t.hero.title} <em>{t.hero.titleAccent}</em></h1><p className="hero-summary">{t.hero.summary}</p><div className="hero-actions"><button className="button primary" onClick={() => navigate('projects')}>{t.hero.projects} <span>&rarr;</span></button><a className="button secondary" href="/CV.pdf" download="Jean_Claude_Ishimwe_Resume.pdf">{t.hero.resume} <span>&darr;</span></a><button className="text-link" onClick={() => navigate('contact')}>{t.hero.contact} <span>&rarr;</span></button></div><div className="social-row">{socials.map((social) => <a key={social.label} href={social.href} target={social.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer">{social.label}</a>)}</div></div><div className="hero-visual reveal"><div className="portrait-frame"><img src={profilePic} alt="Jean Claude Ishimwe" /></div></div></div><div className="scroll-cue">{t.hero.scroll} <span>&darr;</span></div></section>
      <section id="about" className="section-pad section-muted"><div className="content-grid"><SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} /><div className="about-copy reveal"><p className="lead">{t.about.lead}</p>{t.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></div></section>
      <section id="experience" className="section-pad"><SectionHeading eyebrow={t.experience.eyebrow} title={t.experience.title} intro={t.experience.intro} /><div className="timeline reveal"><article className="timeline-item"><div className="timeline-date">{t.experience.silverDate}</div><div><p className="role-company">{t.experience.silverland}</p><h3>{t.experience.silverRole}</h3><ul>{t.experience.silverBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div></article><article className="timeline-item"><div className="timeline-date">{t.experience.techDate}</div><div><p className="role-company">{t.experience.techinika}</p><h3>{t.experience.techRole}</h3><ul>{t.experience.techBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div></article></div></section>
      <section id="projects" className="section-pad section-muted"><SectionHeading eyebrow={t.projects.eyebrow} title={t.projects.title} intro={t.projects.intro} /><div className="filter-row" role="group" aria-label="Filter projects">{Object.entries(t.projects.filters).map(([key, label]) => <button key={key} className={filter === key ? 'filter active' : 'filter'} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="project-grid">{visibleProjects.map((project, index) => <article className="project-card reveal" key={project.title}><div className="card-top"><span className="project-index">0{index + 1}</span><span className="project-type">{project.type}</span></div><h3>{project.title}</h3><p>{project.description}</p><div className="tag-list">{project.stack.map((tech) => <span key={tech}>{tech}</span>)}</div>{project.github && <a className="card-link" href={project.github} target="_blank" rel="noreferrer">{t.projects.viewGithub} <span>&rarr;</span></a>}</article>)}</div></section>
      <section id="skills" className="section-pad"><SectionHeading eyebrow={t.skills.eyebrow} title={t.skills.title} /><div className="skills-grid">{t.skills.groups.map((group, index) => <article className="skill-card reveal" key={group.label}><div className="skill-number">0{index + 1}</div><h3>{group.label}</h3><div className="tag-list">{group.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></article>)}</div><div className="cert-row reveal"><div><span className="eyebrow">{t.skills.learning}</span><h3>{t.skills.certifications}</h3></div><div className="cert-list">{t.skills.certificates.map((certificate) => <span key={certificate}>&#10003; {certificate}</span>)}</div></div></section>
      <section id="contact" className="section-pad contact-section"><div className="contact-grid"><div className="reveal"><SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} intro={t.contact.intro} /><div className="contact-links"><a href={`mailto:${t.contact.email}`}>{t.contact.email} <span>&rarr;</span></a><a href={socials[1].href} target="_blank" rel="noreferrer">{t.contact.linkedin} <span>&rarr;</span></a></div></div><form className="contact-form reveal" onSubmit={submitContact}><label>{t.contact.name}<input name="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t.contact.namePlaceholder} /></label><label>{t.contact.emailLabel}<input name="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={t.contact.emailPlaceholder} /></label><label>{t.contact.message}<textarea name="message" required rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={t.contact.messagePlaceholder} /></label><button className="button primary" disabled={status === 'loading'}>{status === 'loading' ? t.contact.sending : t.contact.send}</button>{status === 'success' && <p className="form-status success">{t.contact.success}</p>}{status === 'error' && <p className="form-status error">{t.contact.error}</p>}</form></div></section>
    </main>
    <footer className="site-footer"><div><strong>Jean Claude Ishimwe<span>.</span></strong><p>{t.footer}</p></div><div className="footer-socials">{socials.map((social) => <a key={social.label} href={social.href}>{social.label}</a>)}</div><p>&copy; {new Date().getFullYear()} Jean Claude Ishimwe</p></footer>
  </div>
}
