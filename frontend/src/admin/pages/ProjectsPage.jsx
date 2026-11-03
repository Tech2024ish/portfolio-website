import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../api'
import { LoadState, MoveButtons, PageHeader, StatusPill, move, useAction, useLoad } from '../ui'

export default function ProjectsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const state = useLoad((signal) => adminApi.projects({ q, status }, signal), [q, status])
  const [run] = useAction()
  const filtered = Boolean(q || status)

  const reorder = async (from, to) => {
    const list = move(state.data, from, to)
    state.setData(list)
    const result = await run(() => adminApi.reorderProjects(list.map((p) => p.id)))
    if (!result.ok) state.reload()
  }

  return (
    <>
      <PageHeader
        crumb="Studio / Projects"
        title="Projects"
        description="Shape the work and the story around it. Drafts stay private; featured projects lead the home page."
        actions={
          <Link className="studio-btn primary" to="/admin/projects/new">
            Add project +
          </Link>
        }
      />
      <section className="studio-panel flush">
        <div className="studio-toolbar">
          <input
            className="studio-search"
            type="search"
            placeholder="Search projects…"
            aria-label="Search projects"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filter by state"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All states</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <LoadState
          state={state}
          empty={{ when: state.data?.length === 0, message: 'No projects match.' }}
        >
          <table className="studio-table">
            <thead>
              <tr>
                <th scope="col" className="narrow">
                  <span className="sr-only">Order</span>
                </th>
                <th scope="col">Project</th>
                <th scope="col">Category</th>
                <th scope="col">Stack</th>
                <th scope="col">Links</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {state.data?.map((project, index) => (
                <tr key={project.id}>
                  <td className="narrow">
                    {!filtered && (
                      <MoveButtons
                        index={index}
                        length={state.data.length}
                        onMove={reorder}
                        label={project.title}
                      />
                    )}
                  </td>
                  <td>
                    <Link to={`/admin/projects/${project.id}`} className="studio-strong-link">
                      {project.title}
                    </Link>
                    <span className="studio-muted mono">/projects/{project.slug}</span>
                    {!project.summary && <span className="studio-flag">Needs summary</span>}
                  </td>
                  <td>{project.category || <span className="studio-muted">—</span>}</td>
                  <td className="studio-muted">{project.tech_stack.join(' · ') || '—'}</td>
                  <td className="studio-muted">
                    {[project.github_url && 'GitHub', project.live_url && 'Live']
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    <StatusPill status={project.status} />
                    {project.is_featured && <span className="studio-pill featured">Featured</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered && <p className="studio-hint pad">Clear search and filters to reorder.</p>}
        </LoadState>
      </section>
    </>
  )
}
