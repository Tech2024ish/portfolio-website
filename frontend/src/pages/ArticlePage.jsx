import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getArticle } from '../api'
import Markdown from '../components/common/Markdown'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta } from '../hooks/usePageEffects'
import NotFoundPage from './NotFoundPage'

export default function ArticlePage() {
  const { slug } = useParams()
  const { ui, language } = useLanguage()
  // Results are tagged with their slug so a previous article never shows for a new URL.
  const [result, setResult] = useState({ slug: null, article: null, error: null })
  const current = result.slug === slug ? result : { article: null, error: null }
  const { article, error } = current

  useEffect(() => {
    const controller = new AbortController()
    getArticle(slug, controller.signal)
      .then((data) => setResult({ slug, article: data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ slug, article: null, error: err }))
    return () => controller.abort()
  }, [slug])

  useDocumentMeta({
    title: article?.seo_title || article?.title,
    description: article?.seo_description || article?.excerpt,
    image: article?.cover?.url,
  })

  if (error?.status === 404) return <NotFoundPage />
  if (error)
    return (
      <p className="section-pad page-top inline-error" role="alert">
        {error.message}
      </p>
    )
  if (!article) return <p className="section-pad page-top">{ui.common.loading}</p>

  const date = new Date(article.published_at).toLocaleDateString(
    language === 'rw' ? 'en' : language,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  )

  return (
    <article className="section-pad page-top article-page">
      <Link className="back-link" to="/writing">
        <span aria-hidden="true">&larr;</span> {ui.writing.back}
      </Link>
      <header className="article-header">
        <p className="article-meta">
          {article.category && <span>{article.category}</span>}
          <time dateTime={article.published_at}>{date}</time>
          <span>{ui.writing.minutes(article.reading_minutes)}</span>
        </p>
        <h1 className="page-title">{article.title}</h1>
        {article.excerpt && <p className="case-summary">{article.excerpt}</p>}
      </header>
      {article.cover && (
        <img
          className="case-hero-image"
          src={article.cover.url}
          alt={article.cover.alt_text || ''}
          width={article.cover.width || undefined}
          height={article.cover.height || undefined}
        />
      )}
      <Markdown className="prose article-body">{article.body}</Markdown>
      {article.tags.length > 0 && (
        <ul className="tag-list article-tags" aria-label="Tags">
          {article.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
