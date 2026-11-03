import { useState } from 'react'
import { adminApi } from '../api'
import { useAuth } from '../AdminApp'
import {
  Button,
  Field,
  LoadState,
  MediaPicker,
  PageHeader,
  Panel,
  formatDate,
  useAction,
  useLoad,
} from '../ui'

function SeoPanel() {
  const state = useLoad((signal) => adminApi.profile(signal))
  return (
    <Panel
      title="Search & social appearance"
      description="Used for the home page title, description and link previews."
    >
      <LoadState state={state}>{state.data && <SeoForm profile={state.data} />}</LoadState>
    </Panel>
  )
}

function SeoForm({ profile }) {
  const [form, setForm] = useState(() => ({
    seo_title: profile.seo_title,
    seo_description: profile.seo_description,
    og_image: profile.og_image,
    default_theme: profile.default_theme,
  }))
  const [run, busy] = useAction()

  return (
    <form
      className="studio-form"
      onSubmit={async (event) => {
        event.preventDefault()
        await run(
          () =>
            adminApi.updateProfile({
              seo_title: form.seo_title,
              seo_description: form.seo_description,
              og_image_id: form.og_image?.id ?? null,
              default_theme: form.default_theme,
            }),
          'Site settings saved',
        )
      }}
    >
      <Field
        label="Site title"
        value={form.seo_title}
        max={70}
        onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
      />
      <Field
        label="Meta description"
        as="textarea"
        rows={3}
        value={form.seo_description}
        max={170}
        onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
      />
      <MediaPicker
        label="Social share image"
        value={form.og_image}
        onChange={(media) => setForm({ ...form, og_image: media })}
        hint="1200 × 630 recommended. Note: crawlers that don't run JavaScript read the default image in index.html."
      />
      <fieldset className="studio-radio">
        <legend>Default theme for new visitors</legend>
        {['dark', 'light'].map((theme) => (
          <label key={theme}>
            <input
              type="radio"
              name="default_theme"
              value={theme}
              checked={form.default_theme === theme}
              onChange={() => setForm({ ...form, default_theme: theme })}
            />
            {theme === 'dark' ? 'Dark' : 'Light'}
          </label>
        ))}
        <p className="studio-hint">Visitors who pick a theme keep their own choice.</p>
      </fieldset>
      <div className="studio-serp" aria-label="Search result preview">
        <span className="studio-serp-title">{form.seo_title || 'Jean Claude Ishimwe'}</span>
        <span className="studio-serp-url">goslish.vercel.app</span>
        <span className="studio-serp-desc">{form.seo_description || 'Add a description.'}</span>
      </div>
      <Button variant="primary" type="submit" busy={busy}>
        Save site settings
      </Button>
    </form>
  )
}

function PasswordPanel() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [error, setError] = useState('')
  const [run, busy] = useAction()
  const mismatch = form.confirm && form.confirm !== form.new_password

  return (
    <Panel
      title="Password"
      description="At least 12 characters mixing three of: lowercase, uppercase, digits, symbols."
    >
      <form
        className="studio-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          if (mismatch) return
          const result = await run(
            () =>
              adminApi.changePassword({
                current_password: form.current_password,
                new_password: form.new_password,
              }),
            'Password changed. Other sessions were signed out.',
          )
          if (result.ok) setForm({ current_password: '', new_password: '', confirm: '' })
          else setError(result.error.message)
        }}
      >
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={form.current_password}
          onChange={(e) => setForm({ ...form, current_password: e.target.value })}
        />
        <div className="studio-grid two">
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          />
          <Field
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            error={mismatch ? 'Passwords do not match.' : undefined}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        {error && (
          <p className="studio-alert danger" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" type="submit" busy={busy} disabled={mismatch}>
          Change password
        </Button>
      </form>
    </Panel>
  )
}

function SessionsPanel() {
  const state = useLoad(() => adminApi.sessions())
  const { signOut } = useAuth()
  const [run, busy] = useAction()
  return (
    <Panel
      title="Active sessions"
      description="Sessions expire after 12 hours, or 2 hours without activity."
    >
      <LoadState state={state}>
        <ul className="studio-list">
          {state.data?.map((session) => (
            <li key={session.id} className="studio-collection-row">
              <div>
                <strong>
                  {session.current
                    ? 'This browser'
                    : session.user_agent?.slice(0, 70) || 'Unknown device'}
                </strong>
                <span className="studio-muted">
                  {session.ip_address} · signed in {formatDate(session.created_at, true)} · last
                  active {formatDate(session.last_seen_at, true)}
                </span>
              </div>
              {session.current ? (
                <Button size="small" onClick={signOut}>
                  Sign out
                </Button>
              ) : (
                <Button
                  size="small"
                  busy={busy}
                  onClick={async () => {
                    const result = await run(
                      () => adminApi.revokeSession(session.id),
                      'Session signed out',
                    )
                    if (result.ok) state.reload()
                  }}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </LoadState>
    </Panel>
  )
}

function ActivityPanel() {
  const [limit, setLimit] = useState(25)
  const state = useLoad(() => adminApi.activity(limit), [limit])
  return (
    <Panel title="Activity history" description="Sign-ins and every change made in the studio.">
      <LoadState
        state={state}
        empty={{ when: state.data?.length === 0, message: 'No activity yet.' }}
      >
        <table className="studio-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Details</th>
              <th scope="col">IP</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.map((entry) => (
              <tr key={entry.id}>
                <td className="studio-muted nowrap">{formatDate(entry.created_at, true)}</td>
                <td>
                  <span className="studio-pill">{entry.action.replace('_', ' ')}</span>
                </td>
                <td>{entry.summary}</td>
                <td className="studio-muted">{entry.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.data?.length === limit && limit < 200 && (
          <Button size="small" onClick={() => setLimit(Math.min(200, limit + 50))}>
            Show more
          </Button>
        )}
      </LoadState>
    </Panel>
  )
}

function SystemPanel() {
  const state = useLoad(() => adminApi.system())
  const data = state.data
  return (
    <Panel
      title="Integrations"
      description="Configured on the server through environment variables."
    >
      <LoadState state={state}>
        {data && (
          <dl className="studio-meta">
            <dt>Environment</dt>
            <dd>{data.environment}</dd>
            <dt>Email replies</dt>
            <dd>
              {data.email.configured ? (
                <span className="studio-pill published">Connected · {data.email.provider}</span>
              ) : (
                <span className="studio-pill draft">
                  Not configured — set RESEND_API_KEY and MAIL_FROM
                </span>
              )}
            </dd>
            <dt>File storage</dt>
            <dd>
              {data.storage.backend === 'supabase'
                ? 'Supabase Storage'
                : 'Local disk (development only)'}
            </dd>
          </dl>
        )}
      </LoadState>
    </Panel>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader crumb="Studio / Settings" title="Settings & security" />
      <SeoPanel />
      <div className="studio-grid two">
        <PasswordPanel />
        <SystemPanel />
      </div>
      <SessionsPanel />
      <ActivityPanel />
    </>
  )
}
