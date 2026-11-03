import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

export default function Education({ education, certifications }) {
  const { ui } = useLanguage()
  if (!education.length && !certifications.length) return null
  return (
    <section id="education" className="section-pad section-muted">
      <div className="content-grid education-grid">
        <SectionHeading eyebrow={ui.education.eyebrow} title={ui.education.title} />
        <div className="education-list reveal">
          {education.map((item) => (
            <article className="education-card" key={item.id}>
              <div className="education-card-top">
                {item.logo && (
                  <img src={item.logo.url} alt="" width="40" height="40" loading="lazy" />
                )}
                {item.status && <span className="badge">{item.status}</span>}
              </div>
              <h3>
                {item.degree}
                {item.field_of_study && <span> in {item.field_of_study}</span>}
              </h3>
              <p className="education-institution">{item.institution}</p>
              {item.period_label && <p className="education-period">{item.period_label}</p>}
              {item.description && <p className="education-description">{item.description}</p>}
            </article>
          ))}
          {certifications.length > 0 && (
            <div className="cert-block">
              <span className="eyebrow">{ui.education.certifications}</span>
              <ul className="cert-list">
                {certifications.map((cert) => (
                  <li key={cert.id}>
                    <span aria-hidden="true">&#10003;</span> {cert.name}
                    {cert.issuer && <small> · {cert.issuer}</small>}
                    {cert.issued_label && <small> · {cert.issued_label}</small>}
                    {(cert.credential_url || cert.certificate?.url) && (
                      <a
                        href={cert.credential_url || cert.certificate.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ui.education.credential} <span aria-hidden="true">&#8599;</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
