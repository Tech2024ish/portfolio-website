import SectionHeading from './common/SectionHeading'

export default function About({ content }) {
  return (
    <section id="about" className="section-pad section-muted">
      <div className="content-grid">
        <SectionHeading eyebrow={content.eyebrow} title={content.title} />
        <div className="about-copy reveal">
          <p className="lead">{content.lead}</p>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
