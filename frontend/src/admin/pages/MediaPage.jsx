import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../api'
import {
  Button,
  ConfirmButton,
  Field,
  LoadState,
  PageHeader,
  Panel,
  formatBytes,
  formatDate,
  useAction,
  useLoad,
  useToast,
} from '../ui'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'
const MAX = { image: 8, document: 10 }

function precheck(file) {
  const isPdf = file.type === 'application/pdf'
  const isImage = /^image\/(png|jpeg|webp|gif)$/.test(file.type)
  if (!isPdf && !isImage)
    return `${file.name}: only PNG, JPEG, WebP, GIF or PDF files are accepted.`
  const limit = isPdf ? MAX.document : MAX.image
  if (file.size > limit * 1024 * 1024) return `${file.name}: larger than ${limit} MB.`
  return null
}

function Uploader({ onUploaded }) {
  const inputRef = useRef(null)
  const [queue, setQueue] = useState([])
  const [dragging, setDragging] = useState(false)
  const toast = useToast()

  const start = async (files) => {
    for (const file of files) {
      const problem = precheck(file)
      const key = `${file.name}-${file.size}-${Math.random()}`
      if (problem) {
        toast(problem, 'danger')
        continue
      }
      setQueue((q) => [...q, { key, name: file.name, progress: 0 }])
      try {
        const media = await adminApi.uploadMedia(file, (progress) =>
          setQueue((q) => q.map((item) => (item.key === key ? { ...item, progress } : item))),
        )
        onUploaded(media)
        toast(`Uploaded ${media.filename}`)
      } catch (error) {
        toast(`${file.name}: ${error.message}`, 'danger')
      } finally {
        setQueue((q) => q.filter((item) => item.key !== key))
      }
    }
  }

  return (
    <div
      className={`studio-dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        start([...event.dataTransfer.files])
      }}
    >
      <p>
        <strong>Drop files here</strong> or{' '}
        <button type="button" className="studio-link-btn" onClick={() => inputRef.current?.click()}>
          browse
        </button>
      </p>
      <p className="studio-hint">
        Images (PNG, JPEG, WebP, GIF) up to 8 MB · PDF up to 10 MB. SVG is not accepted for
        security.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          start([...event.target.files])
          event.target.value = ''
        }}
      />
      {queue.map((item) => (
        <div key={item.key} className="studio-upload-row">
          <span>{item.name}</span>
          <progress max="100" value={item.progress} aria-label={`Uploading ${item.name}`} />
          <span>{item.progress}%</span>
        </div>
      ))}
    </div>
  )
}

function Detail({ mediaId, onChanged, onDeleted, onClose }) {
  const [item, setItem] = useState(null)
  const [alt, setAlt] = useState('')
  const [name, setName] = useState('')
  const [run, busy] = useAction()
  const replaceRef = useRef(null)
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    let alive = true
    adminApi.mediaItem(mediaId).then((data) => {
      if (!alive) return
      setItem(data)
      setAlt(data.alt_text)
      setName(data.filename)
    })
    return () => {
      alive = false
    }
  }, [mediaId])

  if (!item) return <Panel className="studio-media-detail">Loading…</Panel>

  const replace = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = precheck(file)
    if (problem) {
      await run(() => Promise.reject(new Error(problem)))
      return
    }
    setProgress(0)
    const result = await run(
      () => adminApi.replaceMedia(item.id, file, setProgress),
      'File replaced everywhere it is used',
    )
    setProgress(null)
    if (result.ok) {
      setItem(result.data)
      onChanged(result.data)
    }
  }

  return (
    <Panel
      className="studio-media-detail"
      title="File details"
      actions={
        <button className="studio-icon-btn" aria-label="Close details" onClick={onClose}>
          ×
        </button>
      }
    >
      {item.kind === 'image' ? (
        <img className="studio-media-preview" src={item.url} alt={item.alt_text || ''} />
      ) : (
        <iframe
          className="studio-pdf-preview small"
          src={item.url}
          title={`Preview of ${item.filename}`}
        />
      )}
      <dl className="studio-meta">
        <dt>Type</dt>
        <dd>{item.content_type}</dd>
        <dt>Size</dt>
        <dd>{formatBytes(item.size_bytes)}</dd>
        {item.width && (
          <>
            <dt>Dimensions</dt>
            <dd>
              {item.width} × {item.height}
            </dd>
          </>
        )}
        <dt>Uploaded</dt>
        <dd>{formatDate(item.created_at, true)}</dd>
        <dt>Used in</dt>
        <dd>{item.usage.length ? item.usage.join('; ') : 'Not used yet'}</dd>
      </dl>
      <Field
        label="Display name"
        value={name}
        max={200}
        onChange={(e) => setName(e.target.value)}
      />
      {item.kind === 'image' && (
        <Field
          label="Alt text"
          value={alt}
          max={300}
          hint="Describe the image for screen-reader users."
          onChange={(e) => setAlt(e.target.value)}
        />
      )}
      <div className="studio-row wrap">
        <Button
          variant="primary"
          size="small"
          busy={busy}
          disabled={alt === item.alt_text && name === item.filename}
          onClick={async () => {
            const result = await run(
              () => adminApi.updateMedia(item.id, { alt_text: alt, filename: name }),
              'Details saved',
            )
            if (result.ok) {
              setItem(result.data)
              onChanged(result.data)
            }
          }}
        >
          Save details
        </Button>
        <a className="studio-btn small" href={item.url} target="_blank" rel="noreferrer">
          Open ↗
        </a>
        <input
          ref={replaceRef}
          type="file"
          hidden
          accept={
            item.kind === 'image' ? ACCEPT.replace(',application/pdf', '') : 'application/pdf'
          }
          onChange={replace}
        />
        <Button
          size="small"
          onClick={() => replaceRef.current?.click()}
          disabled={progress !== null}
        >
          {progress !== null ? `Replacing ${progress}%` : 'Replace file'}
        </Button>
        <ConfirmButton
          size="small"
          disabled={item.usage.length > 0}
          title={item.usage.length ? 'Remove it from where it is used first' : undefined}
          onConfirm={async () => {
            const result = await run(() => adminApi.deleteMedia(item.id), 'File deleted')
            if (result.ok) onDeleted(item.id)
          }}
        >
          Delete
        </ConfirmButton>
      </div>
      <p className="studio-hint">
        Public URL: <code className="studio-break">{item.url}</code>
      </p>
    </Panel>
  )
}

export default function MediaPage() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const state = useLoad((signal) => adminApi.media({ q, kind, page }, signal), [q, kind, page])
  const pages = state.data ? Math.max(1, Math.ceil(state.data.total / state.data.page_size)) : 1

  return (
    <>
      <PageHeader
        crumb="Studio / Media"
        title="Media library"
        description="Photographs, project screenshots, logos, certificates and resume PDFs — uploaded once, used anywhere."
      />
      <Uploader onUploaded={() => (page === 1 ? state.reload() : setPage(1))} />
      <div className={`studio-media-layout ${selected ? 'with-detail' : ''}`}>
        <section className="studio-panel flush">
          <div className="studio-toolbar">
            <input
              className="studio-search"
              type="search"
              placeholder="Search by name or alt text…"
              aria-label="Search media"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            <div className="studio-segmented" role="group" aria-label="File type">
              {[
                ['', 'All'],
                ['image', 'Images'],
                ['document', 'Documents'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={kind === value ? 'active' : ''}
                  aria-pressed={kind === value}
                  onClick={() => {
                    setKind(value)
                    setPage(1)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="studio-muted">{state.data?.total ?? 0} files</span>
          </div>
          <LoadState
            state={state}
            empty={{
              when: state.data?.items.length === 0,
              message: 'No files yet. Drop some above.',
            }}
          >
            <div className="studio-media-grid">
              {state.data?.items.map((media) => (
                <button
                  key={media.id}
                  className={`studio-media-tile ${selected === media.id ? 'selected' : ''}`}
                  onClick={() => setSelected(media.id)}
                  aria-pressed={selected === media.id}
                >
                  {media.kind === 'image' ? (
                    <img src={media.url} alt="" loading="lazy" />
                  ) : (
                    <span className="studio-doc-icon">PDF</span>
                  )}
                  <span>{media.filename}</span>
                  <small className="studio-muted">{formatBytes(media.size_bytes)}</small>
                </button>
              ))}
            </div>
            {pages > 1 && (
              <div className="studio-row pad">
                <Button size="small" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  ← Previous
                </Button>
                <span className="studio-muted">
                  Page {page} of {pages}
                </span>
                <Button size="small" disabled={page === pages} onClick={() => setPage(page + 1)}>
                  Next →
                </Button>
              </div>
            )}
          </LoadState>
        </section>
        {selected && (
          <Detail
            key={selected}
            mediaId={selected}
            onClose={() => setSelected(null)}
            onChanged={(updated) =>
              state.setData((data) => ({
                ...data,
                items: data.items.map((m) => (m.id === updated.id ? updated : m)),
              }))
            }
            onDeleted={(id) => {
              setSelected(null)
              state.setData((data) => ({
                ...data,
                total: data.total - 1,
                items: data.items.filter((m) => m.id !== id),
              }))
            }}
          />
        )}
      </div>
    </>
  )
}
