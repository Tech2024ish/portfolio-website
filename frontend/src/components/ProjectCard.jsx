import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'

export default function ProjectCard({ project, index }) {
  const { ui } = useLanguage()
  return (
    <article className="project-card reveal">
      {project.thumbnail && (
        <img
          className="project-thumb"
          src={project.thumbnail.url}
          alt={project.thumbnail.alt_text || ''}
          loading="lazy"
          width={project.thumbnail.width || undefined}
          height={project.thumbnail.height || undefined}
        />
      )}
      <div className="card-top">
        <span className="project-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="project-type">{project.category}</span>
      </div>
      <h3>
        <Link to={`/projects/${project.slug}`} className="card-title-link">
          {project.title}
        </Link>
      </h3>
      <p>{project.summary}</p>
      <div className="tag-list">
        {project.tech_stack.map((tech) => (
          <span key={tech}>{tech}</span>
        ))}
      </div>
      <div className="card-actions">
        <Link className="card-link" to={`/projects/${project.slug}`}>
          {ui.featured.caseStudy} <span aria-hidden="true">&rarr;</span>
        </Link>
        {project.github_url && (
          <a
            className="card-link subtle"
            href={project.github_url}
            target="_blank"
            rel="noreferrer"
          >
            {ui.featured.repository} <span aria-hidden="true">&#8599;</span>
          </a>
        )}
      </div>
    </article>
  )
}
