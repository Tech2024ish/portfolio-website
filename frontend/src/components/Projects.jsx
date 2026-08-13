import SectionHeading from './common/SectionHeading'

export default function Projects({ content, projects, filter, setFilter }) {
  return (
    <section id="projects" className="section-pad section-muted">
      <SectionHeading eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
      <div className="filter-row" role="group" aria-label="Filter projects">
        {Object.entries(content.filters).map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'filter active' : 'filter'}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="project-grid">
        {projects.map((project, index) => (
          <article className="project-card reveal" key={project.title}>
            <div className="card-top">
              <span className="project-index">0{index + 1}</span>
              <span className="project-type">{project.type}</span>
            </div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="tag-list">
              {project.stack.map((tech) => (
                <span key={tech}>{tech}</span>
              ))}
            </div>
            {project.github && (
              <a className="card-link" href={project.github} target="_blank" rel="noreferrer">
                {content.viewGithub} <span>&rarr;</span>
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
