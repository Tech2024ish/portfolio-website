import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'
import ProjectCard from './ProjectCard'

export function CategoryFilter({ projects, value, onChange }) {
  const { ui } = useLanguage()
  const categories = useMemo(
    () => [...new Set(projects.map((project) => project.category).filter(Boolean))],
    [projects],
  )
  if (categories.length < 2) return null
  return (
    <div className="filter-row" role="group" aria-label="Filter projects">
      {['all', ...categories].map((category) => (
        <button
          key={category}
          className={value === category ? 'filter active' : 'filter'}
          aria-pressed={value === category}
          onClick={() => onChange(category)}
        >
          {category === 'all' ? ui.projects.all : category}
        </button>
      ))}
    </div>
  )
}

export default function Projects({ projects }) {
  const { ui } = useLanguage()
  const [filter, setFilter] = useState('all')
  const featured = projects.filter((project) => project.is_featured)
  const shown = (featured.length ? featured : projects).filter(
    (project) => filter === 'all' || project.category === filter,
  )

  return (
    <section id="projects" className="section-pad section-muted">
      <SectionHeading
        eyebrow={ui.featured.eyebrow}
        title={ui.featured.title}
        intro={ui.featured.intro}
      />
      <CategoryFilter
        projects={featured.length ? featured : projects}
        value={filter}
        onChange={setFilter}
      />
      <div className="project-grid">
        {shown.map((project, index) => (
          <ProjectCard key={project.slug} project={project} index={index} />
        ))}
      </div>
      {projects.length > shown.length && (
        <Link className="button secondary section-cta" to="/projects">
          {ui.featured.viewAll} ({ui.featured.count(projects.length)}){' '}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </section>
  )
}
