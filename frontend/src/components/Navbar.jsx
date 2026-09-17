import ThemeIcon from './common/ThemeIcon'

const languageOptions = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'rw', label: 'RW' },
]

export default function Navbar({
  dark,
  setDark,
  language,
  setLanguage,
  labels,
  menuOpen,
  setMenuOpen,
  active,
  navigate,
}) {
  const navItems = ['home', 'about', 'experience', 'projects', 'skills', 'contact']

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <button className="brand" onClick={() => navigate('home')} aria-label="Go to home">
          <span>JC</span>
          <strong>
            Jean Claude<span>.</span>
          </strong>
        </button>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Primary navigation">
          {navItems.map((id) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}>
              {labels[id]}
            </button>
          ))}

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
            aria-label={dark ? labels.themeLight : labels.themeDark}
          >
            <ThemeIcon dark={dark} />
          </button>
        </nav>
      </div>
    </header>
  )
}
