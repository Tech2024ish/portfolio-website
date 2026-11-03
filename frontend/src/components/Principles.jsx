import { useLanguage } from '../context/LanguageContext'

export default function Principles({ principles }) {
  const { ui } = useLanguage()
  if (!principles?.length) return null
  return (
    <section className="principles section-pad" aria-labelledby="principles-title">
      <div className="section-heading reveal">
        <span className="eyebrow">{ui.principles.eyebrow}</span>
        <h2 id="principles-title">{ui.principles.title}</h2>
      </div>
      <div className="principles-grid">
        {principles.map((principle, index) => (
          <article className="principle reveal" key={principle.title}>
            <span className="principle-index">0{index + 1}</span>
            <h3>{principle.title}</h3>
            <p>{principle.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
