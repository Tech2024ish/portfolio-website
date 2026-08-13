import profilePic from '../images/profile_picture.png'

const socials = [
  { label: 'GitHub', href: 'https://github.com/Tech2024ish' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ishimwe-jean-claude-goslish/' },
  { label: 'Email', href: 'mailto:claudeish88@gmail.com' },
]

export default function Hero({ content, navigate }) {
  return (
    <section id="home" className="hero section-pad">
      <div className="hero-grid">
        <div className="hero-copy reveal">
          <p className="kicker">
            <span className="status-dot" /> {content.availability}
          </p>
          <h1>
            {content.title} <em>{content.titleAccent}</em>
          </h1>
          <p className="hero-summary">{content.summary}</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => navigate('projects')}>
              {content.projects} <span>&rarr;</span>
            </button>
            <a
              className="button secondary"
              href="/Resume.pdf"
              download="Jean_Claude_Ishimwe_Resume.pdf"
            >
              {content.resume} <span>&darr;</span>
            </a>
            <button className="text-link" onClick={() => navigate('contact')}>
              {content.contact} <span>&rarr;</span>
            </button>
          </div>
          <div className="social-row">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target={social.href.startsWith('mailto') ? undefined : '_blank'}
                rel="noreferrer"
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hero-visual reveal">
          <div className="portrait-frame">
            <img src={profilePic} alt="Jean Claude Ishimwe" />
          </div>
        </div>
      </div>
      <div className="scroll-cue">
        {content.scroll} <span>&darr;</span>
      </div>
    </section>
  )
}
