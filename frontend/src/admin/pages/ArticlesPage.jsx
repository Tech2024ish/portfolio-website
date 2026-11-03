import { useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../api'
import { LoadState, PageHeader, StatusPill, formatDate, useLoad } from '../ui'

export default function ArticlesPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const state = useLoad((signal) => adminApi.articles({ q, status }, signal), [q, status])

  return (
    <>
      <PageHeader
        crumb="Studio / Writing"
        title="Writing"
        description="Draft, edit and publish technical articles. Drafts stay private until you publish them to /writing."
        actions={
          <Link className="studio-btn primary" to="/admin/writing/new">
            New article +
          </Link>
        }
      />
      <section className="studio-panel flush">
        <div className="studio-toolbar">
          <input
            className="studio-search"
            type="search"
            placeholder="Search articles…"
            aria-label="Search articles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <LoadState
          state={state}
          empty={{
            when: state.data?.length === 0,
            message:
              q || status
                ? 'No articles match.'
                : 'No articles yet. Start with one idea you can explain clearly.',
          }}
        >
          <table className="studio-table">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Topic</th>
                <th scope="col">Length</th>
                <th scope="col">SEO</th>
                <th scope="col">Updated</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.data?.map((article) => (
                <tr key={article.id}>
                  <td>
                    <Link className="studio-strong-link" to={`/admin/writing/${article.id}`}>
                      {article.title}
                    </Link>
                    <span className="studio-muted mono">/writing/{article.slug}</span>
                  </td>
                  <td>{article.category || <span className="studio-muted">—</span>}</td>
                  <td className="studio-muted">{article.reading_minutes} min</td>
                  <td>
                    {article.seo_description ? (
                      <span className="studio-pill published">Ready</span>
                    ) : (
                      <span className="studio-flag">Missing description</span>
                    )}
                  </td>
                  <td className="studio-muted">{formatDate(article.updated_at)}</td>
                  <td>
                    <StatusPill status={article.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </LoadState>
      </section>
    </>
  )
}
