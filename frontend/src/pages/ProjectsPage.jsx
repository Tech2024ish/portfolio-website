import { useState } from 'react'
import ProjectCard from '../components/ProjectCard'
import { CategoryFilter } from '../components/Projects'
import { useSiteContent } from '../content/SiteContent'
import { useLanguage } from '../context/LanguageContext'
import { useDocumentMeta, useReveal } from '../hooks/usePageEffects'

export default function ProjectsPage() {
  const { ui, language } = useLanguage()
  const { projects } = useSiteContent()
  const [filter, setFilter] = useState('all')
  const shown = projects.filter((project) => filter === 'all' || project.category === filter)

  useDocumentMeta({ title: ui.projects.title, description: ui.projects.intro })
  useReveal([language, filter, projects])

  return (
    <section className="section-pad page-top">
      <div className="section-heading">
        <span className="eyebrow">{ui.featured.count(projects.length)}</span>
        <h1 className="page-title">{ui.projects.title}</h1>
        <p>{ui.projects.intro}</p>
      </div>
      <CategoryFilter projects={projects} value={filter} onChange={setFilter} />
      <div className="project-grid">
        {shown.map((project, index) => (
          <ProjectCard key={project.slug} project={project} index={index} />
        ))}
      </div>
    </section>
  )
}
