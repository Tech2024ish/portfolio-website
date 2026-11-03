import { useEffect, useState } from 'react'
import { getArticles } from '../api'
import { ArticleCard } from '../components/WritingTeaser'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta, useReveal } from '../hooks/usePageEffects'

export default function WritingPage() {
  const { ui } = useLanguage()
  const [articles, setArticles] = useState(null)
  const [error, setError] = useState(null)
  const [tag, setTag] = useState('all')

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getArticles(controller.signal)
      .then((data) => {
        setArticles(data)
        setError(null)
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message))
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setError(null)
    setAttempt((n) => n + 1)
  }

  useDocumentMeta({ title: ui.nav.writing, description: ui.writing.intro })
  useReveal([articles, tag])

  const tags = [...new Set((articles || []).flatMap((article) => article.tags))]
  const shown = (articles || []).filter((article) => tag === 'all' || article.tags.includes(tag))

  return (
    <section className="section-pad page-top">
      <div className="section-heading">
        <span className="eyebrow">{ui.writing.eyebrow}</span>
        <h1 className="page-title">{ui.writing.title}</h1>
        <p>{ui.writing.intro}</p>
      </div>
      {tags.length > 1 && (
        <div className="filter-row" role="group" aria-label="Filter by tag">
          {['all', ...tags].map((item) => (
            <button
              key={item}
              className={tag === item ? 'filter active' : 'filter'}
              aria-pressed={tag === item}
              onClick={() => setTag(item)}
            >
              {item === 'all' ? ui.projects.all : `#${item}`}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={retry}>
            {ui.common.retry}
          </button>
        </p>
      )}
      {articles === null && !error && <p aria-live="polite">{ui.common.loading}</p>}
      {articles?.length === 0 && <p className="empty-note">{ui.writing.empty}</p>}
      <div className="article-grid">
        {shown.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  )
}
