import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

export default function Skills({ groups }) {
  const { t } = useLanguage()
  return (
    <section id="skills" className="section-pad">
      <SectionHeading eyebrow={t.skills.eyebrow} title={t.skills.title} />
      <div className="skills-grid">
        {groups.map((group, index) => (
          <article className="skill-card reveal" key={group.id ?? group.name}>
            <div className="skill-number">{String(index + 1).padStart(2, '0')}</div>
            <h3>{group.name}</h3>
            {group.description && <p className="skill-description">{group.description}</p>}
            <ul className="tag-list" aria-label={group.name}>
              {group.skills.map((skill) => (
                <li key={skill.id ?? skill.name} title={skill.description || undefined}>
                  {skill.name}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
