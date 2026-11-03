import { Link } from 'react-router'
import { adminApi } from '../api'
import { LoadState, PageHeader, Panel, formatDate, useLoad } from '../ui'

function Stat({ label, value, note, to }) {
  return (
    <Link className="studio-stat" to={to}>
      <span className="studio-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="studio-muted">{note}</span>
    </Link>
  )
}

export default function OverviewPage() {
  const state = useLoad((signal) => adminApi.overview(signal))
  const data = state.data

  return (
    <>
      <PageHeader
        crumb="Studio / Overview"
        title="A clear view of your portfolio."
        description="Review the content, resolve the gaps, and publish when you're ready."
        actions={
          <a className="studio-btn primary" href="/" target="_blank" rel="noreferrer">
            Preview portfolio ↗
          </a>
        }
      />
      <LoadState state={state}>
        {data && (
          <>
            <div className="studio-stats">
              <Stat
                label="Unread messages"
                value={data.messages.unread}
                note="In your inbox"
                to="/admin/inbox?folder=unread"
              />
              <Stat
                label="Published projects"
                value={data.projects.published}
                note={`${data.projects.draft} draft${data.projects.draft === 1 ? '' : 's'}`}
                to="/admin/projects"
              />
              <Stat
                label="Draft articles"
                value={data.articles.draft}
                note={`${data.articles.published} published`}
                to="/admin/writing"
              />
              <div className="studio-stat static">
                <span className="studio-stat-label">Site visits</span>
                <strong>{data.visits.total ?? '—'}</strong>
                <span className="studio-muted">
                  {data.visits.total === null ? 'Visit counter unavailable' : data.visits.source}
                </span>
              </div>
            </div>

            <div className="studio-grid two-one">
              <Panel
                title="Recent messages"
                actions={
                  <Link className="studio-btn small" to="/admin/inbox">
                    Open inbox →
                  </Link>
                }
              >
                {data.recent_messages.length === 0 ? (
                  <p className="studio-empty">
                    No messages yet. New contact-form submissions appear here.
                  </p>
                ) : (
                  <ul className="studio-list">
                    {data.recent_messages.map((message) => (
                      <li key={message.id}>
                        <Link to={`/admin/inbox/${message.id}`} className="studio-list-link">
                          <span>
                            {!message.is_read && (
                              <span className="studio-unread-dot" aria-label="Unread" />
                            )}
                            <strong>{message.name}</strong> ·{' '}
                            {message.subject || message.message.slice(0, 70)}
                          </span>
                          <time className="studio-muted">{formatDate(message.created_at)}</time>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Quick actions">
                <div className="studio-quick">
                  <Link className="studio-btn" to="/admin/projects/new">
                    Add project +
                  </Link>
                  <Link className="studio-btn" to="/admin/writing/new">
                    New article +
                  </Link>
                  <Link className="studio-btn" to="/admin/profile">
                    Edit profile
                  </Link>
                  <Link className="studio-btn" to="/admin/profile/resume">
                    Update resume
                  </Link>
                  <Link className="studio-btn" to="/admin/media">
                    Upload media
                  </Link>
                </div>
              </Panel>
            </div>

            <Panel
              title="Recent content updates"
              description="Every change made in the studio is recorded."
            >
              {data.recent_activity.length === 0 ? (
                <p className="studio-empty">No activity recorded yet.</p>
              ) : (
                <ul className="studio-list">
                  {data.recent_activity.map((entry) => (
                    <li key={entry.id} className="studio-activity">
                      <span>{entry.summary}</span>
                      <time className="studio-muted">{formatDate(entry.created_at, true)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </LoadState>
    </>
  )
}
