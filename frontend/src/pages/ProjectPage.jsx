import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getProject } from '../api'
import Markdown from '../components/common/Markdown'
import { localize, useSiteContent } from '../content/SiteContent'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta } from '../hooks/usePageEffects'
import NotFoundPage from './NotFoundPage'

const SECTIONS = ['problem', 'approach', 'architecture', 'challenges', 'outcome']

export default function ProjectPage() {
  const { slug } = useParams()
  const { ui, language } = useLanguage()
  const { projects, site, status } = useSiteContent()
  const cached = projects.find((project) => project.slug === slug)
  const [fetched, setFetched] = useState(null)
  const [missingSlug, setMissingSlug] = useState(null)
  const missing = missingSlug === slug

  useEffect(() => {
    if (site.isFallback) return undefined
    const controller = new AbortController()
    getProject(slug, controller.signal)
      .then(setFetched)
      .catch((error) => {
        if (error.status === 404) setMissingSlug(slug)
      })
    return () => controller.abort()
  }, [slug, site.isFallback])

  const project = fetched?.slug === slug ? localize(fetched, language) : cached
  useDocumentMeta({
    title: project?.title,
    description: project?.summary,
    image: project?.thumbnail?.url,
  })

  // Not found: the API said so, or the API is unavailable and the bundled copy lacks it.
  if (missing || (status === 'fallback' && !cached)) {
    return <NotFoundPage message={ui.projects.notFound} />
  }
  if (!project) return <div className="section-pad page-top">{ui.common.loading}</div>

  const sections = SECTIONS.filter((key) => project[key]?.trim())

  return (
    <article className="section-pad page-top case-study">
      <Link className="back-link" to="/projects">
        <span aria-hidden="true">&larr;</span> {ui.projects.back}
      </Link>
      <header className="case-header">
        <span className="eyebrow">{project.category}</span>
        <h1 className="page-title">{project.title}</h1>
        <p className="case-summary">{project.summary}</p>
      </header>

      <dl className="case-facts">
        {project.role && (
          <div>
            <dt>{ui.projects.role}</dt>
            <dd>{project.role}</dd>
          </div>
        )}
        <div>
          <dt>{ui.projects.stack}</dt>
          <dd className="tag-list">
            {project.tech_stack.map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </dd>
        </div>
        {(project.github_url || project.live_url) && (
          <div>
            <dt>{ui.projects.links}</dt>
            <dd className="case-links">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noreferrer">
                  {ui.featured.repository} <span aria-hidden="true">&#8599;</span>
                </a>
              )}
              {project.live_url && (
                <a href={project.live_url} target="_blank" rel="noreferrer">
                  {ui.featured.live} <span aria-hidden="true">&#8599;</span>
                </a>
              )}
            </dd>
          </div>
        )}
      </dl>

      {project.thumbnail && (
        <img
          className="case-hero-image"
          src={project.thumbnail.url}
          alt={project.thumbnail.alt_text || ''}
          width={project.thumbnail.width || undefined}
          height={project.thumbnail.height || undefined}
        />
      )}

      {sections.length ? (
        <div className="case-body">
          {sections.map((key) => (
            <section key={key} className="case-section">
              <h2>{ui.projects.sections[key]}</h2>
              <Markdown>{project[key]}</Markdown>
            </section>
          ))}
        </div>
      ) : (
        <p className="case-pending">{ui.projects.noCaseStudy}</p>
      )}

      {project.images?.length > 0 && (
        <div className="case-gallery">
          {project.images.map((image) => (
            <figure key={image.media_id}>
              <img
                src={image.media.url}
                alt={image.media.alt_text || image.caption || ''}
                loading="lazy"
                width={image.media.width || undefined}
                height={image.media.height || undefined}
              />
              {image.caption && <figcaption>{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </article>
  )
}
