import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

const monthYear = (value, language) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(language === 'rw' ? 'en' : language, {
        month: 'short',
        year: 'numeric',
      })
    : ''

export function periodOf(item, language, presentLabel = 'Present') {
  if (item.period_label) return item.period_label
  const start = monthYear(item.start_date, language)
  const end = item.is_current ? presentLabel : monthYear(item.end_date, language)
  return [start, end].filter(Boolean).join(' — ')
}

export default function Experience({ items }) {
  const { t, language } = useLanguage()
  return (
    <section id="experience" className="section-pad">
      <SectionHeading
        eyebrow={t.experience.eyebrow}
        title={t.experience.title}
        intro={t.experience.intro}
      />
      <div className="timeline reveal">
        {items.map((item) => (
          <article className="timeline-item" key={item.id}>
            <div className="timeline-date">{periodOf(item, language)}</div>
            <div>
              <p className="role-company">
                {item.organization}
                {item.employment_type && (
                  <span className="role-type"> · {item.employment_type}</span>
                )}
              </p>
              <h3>{item.role}</h3>
              {item.summary && <p className="timeline-summary">{item.summary}</p>}
              {item.highlights?.length > 0 && (
                <ul>
                  {item.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}
              {item.skills?.length > 0 && (
                <div className="tag-list timeline-tags">
                  {item.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
