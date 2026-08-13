const socials = [
  { label: 'GitHub', href: 'https://github.com/Tech2024ish' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ishimwe-jean-claude-goslish/' },
  { label: 'Email', href: 'mailto:claudeish88@gmail.com' },
]

export default function Footer({ description }) {
  return (
    <footer className="site-footer">
      <div>
        <strong>
          Jean Claude Ishimwe<span>.</span>
        </strong>
        <p>{description}</p>
      </div>
      <div className="footer-socials">
        {socials.map((social) => (
          <a key={social.label} href={social.href}>
            {social.label}
          </a>
        ))}
      </div>
      <p>&copy; {new Date().getFullYear()} Jean Claude Ishimwe</p>
    </footer>
  )
}
