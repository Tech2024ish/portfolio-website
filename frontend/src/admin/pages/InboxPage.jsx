import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { adminApi } from '../api'
import {
  Button,
  Field,
  LoadState,
  PageHeader,
  StatusPill,
  formatDate,
  useAction,
  useLoad,
  useToast,
} from '../ui'

const REPLY_STATUS_TEXT = {
  sent: 'Delivered to the email provider',
  failed: 'Sending failed',
  not_configured: 'Saved but not sent — no email provider configured',
  sending: 'Sending…',
}

function Thread({ id, onChanged, system }) {
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [run, busy] = useAction()
  const toast = useToast()

  useEffect(() => {
    // Thread is keyed by id, so state starts fresh for each message.
    let alive = true
    adminApi
      .message(id)
      .then(async (data) => {
        if (!alive) return
        setMessage(data)
        setSubject(`Re: ${data.subject || 'your message'}`)
        if (!data.is_read) {
          const updated = await adminApi.updateMessage(id, { is_read: true })
          if (alive) {
            setMessage(updated)
            onChanged(updated)
          }
        }
      })
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <div className="studio-alert danger">{error.message}</div>
  if (!message) return <p className="studio-muted">Loading message…</p>

  const update = async (patch, success) => {
    const result = await run(() => adminApi.updateMessage(id, patch), success)
    if (result.ok) {
      setMessage(result.data)
      onChanged(result.data)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()
    const result = await run(() => adminApi.reply(id, { subject, body }))
    if (result.ok) {
      setMessage(result.data.message)
      onChanged(result.data.message)
      const status = result.data.reply.status
      if (status === 'sent') setBody('')
      // Feedback mirrors the real outcome; an unsent reply keeps the text for editing.
      toast(
        status === 'sent' ? 'Reply sent.' : result.data.reply.error || REPLY_STATUS_TEXT[status],
        status === 'sent' ? 'success' : 'danger',
      )
    }
  }

  const retry = async (replyId) => {
    const result = await run(() => adminApi.retryReply(replyId))
    if (result.ok) {
      const { status, error: sendError } = result.data.reply
      toast(
        status === 'sent' ? 'Reply sent.' : sendError || REPLY_STATUS_TEXT[status],
        status === 'sent' ? 'success' : 'danger',
      )
      const updated = await adminApi.message(id)
      setMessage(updated)
      onChanged(updated)
    }
  }

  return (
    <article className="studio-thread" aria-label={`Conversation with ${message.name}`}>
      <header className="studio-thread-head">
        <div>
          <h2>{message.subject || '(no subject)'}</h2>
          <p className="studio-muted">
            <strong>{message.name}</strong> &lt;
            <a href={`mailto:${message.email}`}>{message.email}</a>&gt; ·{' '}
            {formatDate(message.created_at, true)}
            {message.source !== 'website' && ` · imported from ${message.source}`}
          </p>
        </div>
        <div className="studio-row">
          <Button
            size="small"
            busy={busy}
            onClick={() =>
              update(
                { is_read: !message.is_read },
                message.is_read ? 'Marked unread' : 'Marked read',
              )
            }
          >
            Mark {message.is_read ? 'unread' : 'read'}
          </Button>
          <Button
            size="small"
            busy={busy}
            onClick={() =>
              update(
                { archived: !message.archived_at },
                message.archived_at ? 'Moved to inbox' : 'Archived',
              )
            }
          >
            {message.archived_at ? 'Unarchive' : 'Archive'}
          </Button>
        </div>
      </header>

      <ol className="studio-conversation">
        <li className="incoming">
          <p className="studio-bubble-meta">
            {message.name} · {formatDate(message.created_at, true)}
          </p>
          <div className="studio-bubble">{message.message}</div>
        </li>
        {message.replies.map((reply) => (
          <li key={reply.id} className="outgoing">
            <p className="studio-bubble-meta">
              You · {formatDate(reply.created_at, true)} · <StatusPill status={reply.status} />
              {reply.attempts > 1 && ` · ${reply.attempts} attempts`}
            </p>
            <div className="studio-bubble">
              <strong>{reply.subject}</strong>
              {'\n\n'}
              {reply.body}
            </div>
            {reply.status !== 'sent' && (
              <p className={`studio-reply-status ${reply.status}`}>
                {reply.error || REPLY_STATUS_TEXT[reply.status]}{' '}
                {reply.status !== 'sending' && (
                  <Button
                    size="small"
                    busy={busy}
                    onClick={() => retry(reply.id)}
                    disabled={!system?.email.configured}
                  >
                    Retry
                  </Button>
                )}
              </p>
            )}
          </li>
        ))}
      </ol>

      <form className="studio-reply" onSubmit={sendReply}>
        {!system?.email.configured && (
          <p className="studio-alert">
            Email sending is not configured. Replies will be saved here but{' '}
            <strong>not delivered</strong>. You can reply from your own mail app:{' '}
            <a href={`mailto:${message.email}?subject=${encodeURIComponent(subject)}`}>
              open in mail app
            </a>
            .
          </p>
        )}
        <Field
          label="Subject"
          value={subject}
          max={200}
          required
          onChange={(e) => setSubject(e.target.value)}
        />
        <Field
          label={`Reply to ${message.name}`}
          as="textarea"
          rows={6}
          value={body}
          required
          onChange={(e) => setBody(e.target.value)}
          hint="Their original message is quoted below your reply. Their answer arrives in your usual mailbox."
        />
        <Button
          variant="primary"
          type="submit"
          busy={busy}
          disabled={!body.trim() || !subject.trim()}
        >
          {system?.email.configured ? 'Send reply' : 'Save reply (not sent)'}
        </Button>
      </form>
    </article>
  )
}

export default function InboxPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const folder = params.get('folder') || 'inbox'
  const [q, setQ] = useState('')
  const state = useLoad((signal) => adminApi.messages({ folder, q }, signal), [folder, q])
  const system = useLoad(() => adminApi.system()).data

  const onChanged = (updated) => {
    state.setData((data) => {
      if (!data) return data
      const inFolder =
        folder === 'archived'
          ? Boolean(updated.archived_at)
          : !updated.archived_at &&
            (folder !== 'unread' || !updated.is_read || updated.id === Number(id))
      const items = inFolder
        ? data.items.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
        : data.items.filter((m) => m.id !== updated.id)
      return { ...data, items, unread: items.filter((m) => !m.is_read && !m.archived_at).length }
    })
  }

  return (
    <>
      <PageHeader
        crumb="Studio / Inbox"
        title="Inbox"
        description="Messages from the contact form. Replies are sent from your configured address."
      />
      <div className="studio-inbox">
        <section className="studio-panel flush studio-inbox-list">
          <div className="studio-toolbar column">
            <div className="studio-segmented" role="group" aria-label="Folder">
              {[
                ['inbox', 'Inbox'],
                ['unread', `Unread${state.data ? ` (${state.data.unread})` : ''}`],
                ['archived', 'Archived'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={folder === value ? 'active' : ''}
                  aria-pressed={folder === value}
                  onClick={() => {
                    setParams(value === 'inbox' ? {} : { folder: value })
                    if (id) navigate(`/admin/inbox${value === 'inbox' ? '' : `?folder=${value}`}`)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className="studio-search"
              type="search"
              placeholder="Search name, email or text…"
              aria-label="Search messages"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <LoadState
            state={state}
            empty={{ when: state.data?.items.length === 0, message: 'No messages here.' }}
          >
            <ul className="studio-message-list">
              {state.data?.items.map((message) => (
                <li key={message.id}>
                  <Link
                    to={`/admin/inbox/${message.id}${folder === 'inbox' ? '' : `?folder=${folder}`}`}
                    className={`${String(message.id) === id ? 'active' : ''} ${message.is_read ? '' : 'unread'}`}
                    aria-current={String(message.id) === id ? 'true' : undefined}
                  >
                    <span className="studio-message-top">
                      <strong>{message.name}</strong>
                      <time>{formatDate(message.created_at)}</time>
                    </span>
                    <span className="studio-message-subject">
                      {message.subject || message.message.slice(0, 60)}
                    </span>
                    <span className="studio-muted">
                      {message.reply_count > 0
                        ? `${message.reply_count} repl${message.reply_count === 1 ? 'y' : 'ies'}`
                        : 'Not replied'}
                      {message.last_reply_status &&
                        message.last_reply_status !== 'sent' &&
                        ' · last reply not delivered'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </LoadState>
        </section>
        <section className="studio-panel studio-inbox-thread">
          {id ? (
            <Thread key={id} id={id} onChanged={onChanged} system={system} />
          ) : (
            <p className="studio-empty">Select a message to read it.</p>
          )}
        </section>
      </div>
    </>
  )
}
