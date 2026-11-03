import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

export function ArticleCard({ article }) {
  const { ui, language } = useLanguage()
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString(language === 'rw' ? 'en' : language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''
  return (
    <article className="article-card reveal">
      {article.cover && (
        <img
          src={article.cover.url}
          alt={article.cover.alt_text || ''}
          loading="lazy"
          className="article-cover"
        />
      )}
      <p className="article-meta">
        {article.category && <span>{article.category}</span>}
        {date && <time dateTime={article.published_at}>{date}</time>}
        <span>{ui.writing.minutes(article.reading_minutes)}</span>
      </p>
      <h3>
        <Link to={`/writing/${article.slug}`} className="card-title-link">
          {article.title}
        </Link>
      </h3>
      <p>{article.excerpt}</p>
      <Link className="card-link" to={`/writing/${article.slug}`}>
        {ui.writing.read} <span aria-hidden="true">&rarr;</span>
      </Link>
    </article>
  )
}

export default function WritingTeaser({ articles }) {
  const { ui } = useLanguage()
  if (!articles.length) return null
  return (
    <section id="writing" className="section-pad">
      <SectionHeading
        eyebrow={ui.writing.eyebrow}
        title={ui.writing.title}
        intro={ui.writing.intro}
      />
      <div className="article-grid">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
      <Link className="button secondary section-cta" to="/writing">
        {ui.writing.all} <span aria-hidden="true">&rarr;</span>
      </Link>
    </section>
  )
}
