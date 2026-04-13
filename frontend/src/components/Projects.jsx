import React, { useEffect, useState } from 'react'
import { getProjects } from '../api'

const fallbackProjects = [
  {
    id: 1,
    title: 'REST API Service',
    description:
      'A high-performance REST API built with FastAPI and Supabase for managing user data and authentication.',
    tech_stack: ['Python', 'FastAPI', 'Supabase', 'Docker'],
    github_url: '#',
    live_url: '#',
  },
  {
    id: 2,
    title: 'Task Management API',
    description:
      'Backend service for a task management app with real-time updates, user roles, and full CRUD operations.',
    tech_stack: ['FastAPI', 'PostgreSQL', 'Redis', 'Pydantic'],
    github_url: '#',
    live_url: null,
  },
  {
    id: 3,
    title: 'Auth Microservice',
    description:
      'Secure authentication microservice with JWT tokens, refresh tokens, and OAuth2 support.',
    tech_stack: ['Python', 'FastAPI', 'Supabase', 'JWT'],
    github_url: '#',
    live_url: '#',
  },
]

function ProjectCard({ project }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col">
      <h3 className="text-xl font-bold text-white mb-3">{project.title}</h3>
      <p className="text-gray-400 flex-grow mb-5 leading-relaxed">{project.description}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {project.tech_stack.map((tech) => (
          <span
            key={tech}
            className="px-2.5 py-1 bg-indigo-900 text-indigo-300 text-xs font-semibold rounded-full"
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
            className="flex-1 text-center px-4 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm font-medium hover:border-indigo-400 hover:text-indigo-400 transition-colors"
          >
            GitHub
          </a>
        )}
        {project.live_url && (
          <a
            href={project.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Live Demo
          </a>
        )}
      </div>
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getProjects()
      .then((res) => {
        if (res.data && res.data.length > 0) setProjects(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="projects" className="py-24 bg-gray-950">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-indigo-400 font-semibold uppercase tracking-widest text-sm mb-2">
            Portfolio
          </p>
          <h2 className="text-4xl font-extrabold text-white">My Projects</h2>
          <div className="mt-4 w-16 h-1 bg-indigo-600 mx-auto rounded-full" />
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-10">Loading projects...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
