/* Owner studio building blocks (Figma: "Owner …" screens). */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { adminApi } from './api'

// ------------------------------------------------------------------ data loading

/**
 * Fetch data for a view. Re-runs when `deps` change or `reload()` is called.
 * State only changes in async callbacks, so renders never cascade.
 */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal)
      .then((data) => setState({ data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((current) => ({ ...current, error }))
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const setData = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === 'function' ? updater(current.data) : updater,
    }))
  }, [])

  return { ...state, reload, setData }
}

export function LoadState({ state, children, empty }) {
  if (state.error && !state.data)
    return (
      <div className="studio-alert danger" role="alert">
        <strong>Could not load this page.</strong> {state.error.message}
        <button className="studio-btn small" onClick={state.reload}>
          Try again
        </button>
      </div>
    )
  if (!state.data)
    return (
      <p className="studio-muted" aria-live="polite">
        Loading…
      </p>
    )
  if (empty && empty.when) return <div className="studio-empty">{empty.message}</div>
  return children
}

// ------------------------------------------------------------------ toasts

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(
      () => setToasts((list) => list.filter((toast) => toast.id !== id)),
      tone === 'danger' ? 8000 : 4000,
    )
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="studio-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`studio-toast ${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/**
 * Run an async action with consistent feedback. Never throws:
 * resolves to { ok: true, data } or { ok: false, error }.
 */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, successMessage) => {
      setBusy(true)
      try {
        const data = await fn()
        if (successMessage) toast(successMessage)
        return { ok: true, data }
      } catch (error) {
        if (error.status !== 401) toast(error.message || 'Something went wrong.', 'danger')
        return { ok: false, error }
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )
  return [run, busy]
}

// ------------------------------------------------------------------ layout pieces

export function PageHeader({ crumb, title, description, actions }) {
  return (
    <header className="studio-page-header">
      <div>
        {crumb && <p className="studio-crumb">{crumb}</p>}
        <h1>{title}</h1>
        {description && <p className="studio-muted">{description}</p>}
      </div>
      {actions && <div className="studio-actions">{actions}</div>}
    </header>
  )
}

export function Panel({ title, description, children, actions, className = '' }) {
  return (
    <section className={`studio-panel ${className}`}>
      {(title || actions) && (
        <div className="studio-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="studio-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatusPill({ status }) {
  const labels = {
    published: 'Published',
    draft: 'Draft',
    sent: 'Sent',
    failed: 'Failed',
    not_configured: 'Not sent',
    sending: 'Sending',
    hidden: 'Hidden',
    visible: 'Visible',
  }
  return <span className={`studio-pill ${status}`}>{labels[status] || status}</span>
}

export function Button({ variant = 'default', size, busy, children, ...props }) {
  return (
    <button
      className={`studio-btn ${variant} ${size || ''}`}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? 'Working…' : children}
    </button>
  )
}

export function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirm delete', ...props }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <Button
      variant={armed ? 'danger' : 'ghost'}
      {...props}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}

// ------------------------------------------------------------------ form fields

export function Field({
  label,
  hint,
  error,
  max,
  value,
  as = 'input',
  children,
  className = '',
  ...props
}) {
  const id = useId()
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const Tag = as
  const length = typeof value === 'string' ? value.length : 0
  return (
    <div className={`studio-field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id}>
        {label}
        {max && (
          <span className={`studio-counter ${length > max ? 'over' : ''}`} aria-hidden="true">
            {length}/{max}
          </span>
        )}
      </label>
      {children || (
        <Tag
          id={id}
          value={value ?? ''}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          maxLength={max}
          {...props}
        />
      )}
      {hint && (
        <p className="studio-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="studio-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }) {
  const id = useId()
  return (
    <div className="studio-toggle">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>
        {label}
        {hint && <span className="studio-hint">{hint}</span>}
      </label>
    </div>
  )
}

/** Comma/Enter separated chips, e.g. tech stacks and tags. */
export function TagInput({
  label,
  value = [],
  onChange,
  hint,
  placeholder = 'Type and press Enter',
}) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const add = () => {
    const parts = draft
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((part) => !value.includes(part))])
    setDraft('')
  }
  return (
    <div className="studio-field">
      <label htmlFor={id}>{label}</label>
      <div className="studio-tags">
        {value.map((tag, index) => (
          <span key={tag} className="studio-tag">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={add}
        />
      </div>
      {hint && <p className="studio-hint">{hint}</p>}
    </div>
  )
}

/** Editable list of strings (bullets/highlights). */
export function ListEditor({ label, value = [], onChange, placeholder, max = 12 }) {
  return (
    <fieldset className="studio-list-editor">
      <legend>{label}</legend>
      {value.map((item, index) => (
        <div className="studio-list-row" key={index}>
          <input
            aria-label={`${label} ${index + 1}`}
            value={item}
            placeholder={placeholder}
            onChange={(event) =>
              onChange(value.map((v, i) => (i === index ? event.target.value : v)))
            }
          />
          <MoveButtons
            index={index}
            length={value.length}
            onMove={(from, to) => onChange(move(value, from, to))}
          />
          <button
            type="button"
            className="studio-icon-btn"
            aria-label={`Remove item ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          className="studio-btn small ghost"
          onClick={() => onChange([...value, ''])}
        >
          + Add item
        </button>
      )}
    </fieldset>
  )
}

export function move(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export function MoveButtons({ index, length, onMove, label = 'item' }) {
  return (
    <span className="studio-move">
      <button
        type="button"
        className="studio-icon-btn"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="studio-icon-btn"
        aria-label={`Move ${label} down`}
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
    </span>
  )
}

/** Optional French / Kinyarwanda overrides stored in an entity's `translations`. */
export function TranslationFields({ value = {}, onChange, fields }) {
  const [open, setOpen] = useState(false)
  const update = (lang, key, text, kind) => {
    const stored = kind === 'list' ? text.split('\n') : text
    const next = { ...value, [lang]: { ...(value[lang] || {}), [key]: stored } }
    if (!text.trim()) delete next[lang][key]
    onChange(next)
  }
  return (
    <details
      className="studio-translations"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Translations (French, Kinyarwanda) — optional</summary>
      <p className="studio-hint">
        Leave empty to show the English text. Review these after changing the English.
      </p>
      {['fr', 'rw'].map((lang) => (
        <div key={lang} className="studio-grid two">
          {fields.map(([key, label, multiline]) => (
            <Field
              key={key}
              label={`${label} (${lang.toUpperCase()})`}
              as={multiline ? 'textarea' : 'input'}
              rows={multiline ? 3 : undefined}
              value={
                Array.isArray(value[lang]?.[key])
                  ? value[lang][key].join('\n')
                  : value[lang]?.[key] || ''
              }
              hint={multiline === 'list' ? 'One item per line.' : undefined}
              onChange={(event) => update(lang, key, event.target.value, multiline)}
            />
          ))}
        </div>
      ))}
    </details>
  )
}

/** Trim translation values before saving; drop empty lines and empty entries. */
export function cleanTranslations(translations = {}) {
  const out = {}
  Object.entries(translations).forEach(([lang, fields]) => {
    const cleaned = {}
    Object.entries(fields || {}).forEach(([key, value]) => {
      const v = Array.isArray(value)
        ? value.map((line) => line.trim()).filter(Boolean)
        : String(value).trim()
      if (Array.isArray(v) ? v.length : v) cleaned[key] = v
    })
    if (Object.keys(cleaned).length) out[lang] = cleaned
  })
  return out
}

/** Warn before leaving with unsaved edits. */
export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

export const formatBytes = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`

export const formatDate = (value, withTime = false) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'

export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

// ------------------------------------------------------------------ media picker

const ACCEPT = {
  image: 'image/png,image/jpeg,image/webp,image/gif',
  document: 'application/pdf',
  any: 'image/png,image/jpeg,image/webp,image/gif,application/pdf',
}

export function UploadButton({ kind = 'any', onUploaded, label = 'Upload file' }) {
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const toast = useToast()
  const handle = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProgress(0)
    try {
      const media = await adminApi.uploadMedia(file, setProgress)
      toast(`Uploaded ${media.filename}`)
      onUploaded?.(media)
    } catch (error) {
      toast(error.message, 'danger')
    } finally {
      setProgress(null)
    }
  }
  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPT[kind]} hidden onChange={handle} />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
        {progress !== null ? `Uploading ${progress}%` : label}
      </Button>
      {progress !== null && (
        <progress
          className="studio-progress"
          max="100"
          value={progress}
          aria-label="Upload progress"
        />
      )}
    </>
  )
}

export function MediaPicker({ label, value, onChange, kind = 'image', hint }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="studio-field">
      <span className="studio-label">{label}</span>
      <div className="studio-media-slot">
        {value ? (
          value.kind === 'image' ? (
            <img src={value.url} alt={value.alt_text || ''} />
          ) : (
            <span className="studio-doc-icon">PDF</span>
          )
        ) : (
          <span className="studio-muted">None selected</span>
        )}
        <div className="studio-media-slot-actions">
          {value && <span className="studio-filename">{value.filename}</span>}
          <Button type="button" size="small" onClick={() => setOpen(true)}>
            {value ? 'Change' : 'Choose'}
          </Button>
          {value && (
            <Button type="button" size="small" variant="ghost" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="studio-hint">{hint}</p>}
      {open && (
        <MediaDialog
          kind={kind}
          onClose={() => setOpen(false)}
          onSelect={(media) => (onChange(media), setOpen(false))}
        />
      )}
    </div>
  )
}

export function MediaDialog({ kind, onClose, onSelect }) {
  const dialogRef = useRef(null)
  const [q, setQ] = useState('')
  const state = useLoad((signal) => adminApi.media({ kind, q, page_size: 60 }, signal), [kind, q])
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className="studio-dialog"
      onClose={onClose}
      aria-labelledby="media-dialog-title"
    >
      <div className="studio-dialog-head">
        <h2 id="media-dialog-title">Choose {kind === 'document' ? 'a document' : 'an image'}</h2>
        <button className="studio-icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="studio-row">
        <input
          className="studio-search"
          type="search"
          placeholder="Search files…"
          aria-label="Search files"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <UploadButton kind={kind} onUploaded={onSelect} label="Upload new" />
      </div>
      <LoadState
        state={state}
        empty={{
          when: state.data?.items.length === 0,
          message: 'No matching files yet. Upload one.',
        }}
      >
        <div className="studio-media-grid compact">
          {state.data?.items.map((media) => (
            <button
              key={media.id}
              type="button"
              className="studio-media-tile"
              onClick={() => onSelect(media)}
            >
              {media.kind === 'image' ? (
                <img src={media.url} alt="" loading="lazy" />
              ) : (
                <span className="studio-doc-icon">PDF</span>
              )}
              <span>{media.filename}</span>
            </button>
          ))}
        </div>
      </LoadState>
    </dialog>
  )
}
