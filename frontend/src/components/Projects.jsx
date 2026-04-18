import { useEffect, useState } from 'react'
import { getProjects } from '../api'
import { useLanguage } from '../context/LanguageContext'

const projectMeta = [
  {
    github_url: null,
    live_url: null,
    tech_stack: ['FastAPI', 'PostgreSQL', 'REST APIs', 'JWT'],
  },
  {
    github_url: null,
    live_url: null,
    tech_stack: ['FastAPI', 'Databases', 'REST APIs'],
  },
  {
    github_url: 'https://github.com/Tech2024ish/SchoolManagementSystem',
    live_url: null,
    tech_stack: ['JSP', 'JSF', 'MySQL', 'ORM'],
  },
]

function ProjectCard({ project, github, liveDemo }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{project.title}</h3>
      <p className="text-gray-500 dark:text-gray-400 flex-grow mb-5 leading-relaxed">{project.description}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {project.tech_stack.map((tech) => (
          <span
            key={tech}
            className="px-2.5 py-1 bg-teal-50 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-full"
          >
            {tech}
          </span>
        ))}
      </div>
      <div className="flex gap-3 mt-auto">
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-sm font-medium hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {github}
          </a>
        )}
        {project.live_url && (
          <a
            href={project.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            {liveDemo}
          </a>
        )}
      </div>
    </div>
  )
}

export default function Projects() {
  const { t } = useLanguage()
  const [apiProjects, setApiProjects] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getProjects()
      .then((res) => {
        if (res.data && res.data.length > 0) setApiProjects(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const projects = (apiProjects ?? t.projects.items).map((item, i) => ({
    ...item,
    ...(projectMeta[i] ?? {}),
  }))

  return (
    <section id="projects" className="py-16 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest text-teal-600 dark:text-teal-400 uppercase mb-3 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-full">
            {t.projects.sectionLabel}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mt-3">
            {t.projects.title}
          </h2>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">{t.projects.loading}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, i) => (
              <ProjectCard
                key={i}
                project={project}
                github={t.projects.github}
                liveDemo={t.projects.liveDemo}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
