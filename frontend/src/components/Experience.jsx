import SectionHeading from './common/SectionHeading'

function ExperienceItem({ date, company, role, bullets }) {
  return (
    <article className="timeline-item">
      <div className="timeline-date">{date}</div>
      <div>
        <p className="role-company">{company}</p>
        <h3>{role}</h3>
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default function Experience({ content }) {
  return (
    <section id="experience" className="section-pad">
      <SectionHeading eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
      <div className="timeline reveal">
        <ExperienceItem
          date={content.silverDate}
          company={content.silverland}
          role={content.silverRole}
          bullets={content.silverBullets}
        />
        <ExperienceItem
          date={content.techDate}
          company={content.techinika}
          role={content.techRole}
          bullets={content.techBullets}
        />
      </div>
    </section>
  )
}
