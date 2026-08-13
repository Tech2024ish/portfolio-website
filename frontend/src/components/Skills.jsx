import SectionHeading from './common/SectionHeading'

export default function Skills({ content }) {
  return (
    <section id="skills" className="section-pad">
      <SectionHeading eyebrow={content.eyebrow} title={content.title} />
      <div className="skills-grid">
        {content.groups.map((group, index) => (
          <article className="skill-card reveal" key={group.label}>
            <div className="skill-number">0{index + 1}</div>
            <h3>{group.label}</h3>
            <div className="tag-list">
              {group.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="cert-row reveal">
        <div>
          <span className="eyebrow">{content.learning}</span>
          <h3>{content.certifications}</h3>
        </div>
        <div className="cert-list">
          {content.certificates.map((certificate) => (
            <span key={certificate}>&#10003; {certificate}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
