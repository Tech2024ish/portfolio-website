import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Markdown from '../../components/common/Markdown'
import { adminApi } from '../api'
import {
  Button,
  ConfirmButton,
  Field,
  LoadState,
  MediaPicker,
  PageHeader,
  Panel,
  StatusPill,
  TagInput,
  slugify,
  useAction,
  useLoad,
  useUnsavedWarning,
} from '../ui'

const BLANK = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  category: '',
  tags: [],
  cover: null,
  seo_title: '',
  seo_description: '',
  canonical_url: '',
  status: 'draft',
}

const toBody = (form) => ({
  title: form.title,
  slug: form.slug,
  excerpt: form.excerpt,
  body: form.body,
  category: form.category,
  tags: form.tags,
  cover_id: form.cover?.id ?? null,
  seo_title: form.seo_title,
  seo_description: form.seo_description,
  canonical_url: form.canonical_url?.trim() || null,
})

function ArticleEditor({ id, initial }) {
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [errors, setErrors] = useState({})
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [mode, setMode] = useState('write')
  const [run, busy] = useAction()

  const dirty = form && JSON.stringify(form) !== saved
  useUnsavedWarning(dirty)
  const set = (key) => (value) =>
    setForm((f) => ({ ...f, [key]: value?.target ? value.target.value : value }))

  const save = async (event) => {
    event?.preventDefault()
    setErrors({})
    const result = isNew
      ? await run(() => adminApi.createArticle(toBody(form)), 'Draft created')
      : await run(() => adminApi.updateArticle(id, toBody(form)), 'Article saved')
    if (!result.ok) {
      setErrors(Object.fromEntries((result.error.fields || []).map((f) => [f.field, f.message])))
      return false
    }
    setForm(result.data)
    setSaved(JSON.stringify(result.data))
    if (isNew) navigate(`/admin/writing/${result.data.id}`, { replace: true })
    return true
  }

  const togglePublish = async () => {
    if (dirty && !(await save())) return
    const publishing = form.status !== 'published'
    const result = await run(
      () => (publishing ? adminApi.publishArticle(form.id) : adminApi.unpublishArticle(form.id)),
      publishing ? 'Published to /writing' : 'Article moved back to drafts',
    )
    if (result.ok) {
      setForm(result.data)
      setSaved(JSON.stringify(result.data))
    }
  }

  const words = form?.body.trim() ? form.body.trim().split(/\s+/).length : 0

  return (
    <>
      <PageHeader
        crumb={
          <>
            <Link to="/admin/writing">Studio / Writing</Link> / {isNew ? 'New' : 'Edit'}
          </>
        }
        title={isNew ? 'New article' : form?.title || 'Article'}
        actions={
          form &&
          !isNew && (
            <>
              <StatusPill status={form.status} />
              {form.status === 'published' && (
                <a
                  className="studio-btn small"
                  href={`/writing/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View live ↗
                </a>
              )}
              <Button
                variant={form.status === 'published' ? 'default' : 'primary'}
                busy={busy}
                onClick={togglePublish}
              >
                {form.status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
            </>
          )
        }
      />
      <>
        {form && (
          <form className="studio-form studio-editor" onSubmit={save}>
            <div className="studio-editor-main">
              <Panel>
                <Field
                  label="Title"
                  value={form.title}
                  required
                  max={160}
                  error={errors.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }))
                  }}
                />
                <Field
                  label="URL slug"
                  value={form.slug}
                  required
                  max={140}
                  error={errors.slug}
                  hint={`Public address: /writing/${form.slug || '…'}`}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug')(e.target.value.toLowerCase())
                  }}
                />
                <Field
                  label="Excerpt"
                  as="textarea"
                  rows={2}
                  max={400}
                  value={form.excerpt}
                  hint="One or two sentences for cards and previews. Required to publish."
                  onChange={set('excerpt')}
                />
              </Panel>

              <Panel
                title="Body"
                description={`${words} words · about ${Math.max(1, Math.round(words / 220))} min read · Markdown`}
                actions={
                  <div className="studio-segmented" role="tablist" aria-label="Editor mode">
                    {['write', 'preview'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={mode === value}
                        className={mode === value ? 'active' : ''}
                        onClick={() => setMode(value)}
                      >
                        {value === 'write' ? 'Write' : 'Preview'}
                      </button>
                    ))}
                  </div>
                }
              >
                {mode === 'write' ? (
                  <Field
                    label="Article body"
                    as="textarea"
                    className="studio-body-editor"
                    rows={24}
                    value={form.body}
                    hint="Use ## for section headings, ``` for code blocks, - for lists."
                    onChange={set('body')}
                  />
                ) : (
                  <div className="studio-preview">
                    {form.body ? (
                      <Markdown>{form.body}</Markdown>
                    ) : (
                      <p className="studio-muted">Nothing to preview yet.</p>
                    )}
                  </div>
                )}
              </Panel>
            </div>

            <aside className="studio-editor-side">
              <Panel title="Organise">
                <Field
                  label="Category"
                  value={form.category}
                  max={80}
                  onChange={set('category')}
                  hint="e.g. Backend, Databases"
                />
                <TagInput label="Tags" value={form.tags} onChange={set('tags')} />
                <MediaPicker label="Cover image" value={form.cover} onChange={set('cover')} />
              </Panel>
              <Panel title="Search & sharing">
                <Field
                  label="SEO title"
                  value={form.seo_title}
                  max={70}
                  hint="Defaults to the article title."
                  onChange={set('seo_title')}
                />
                <Field
                  label="Meta description"
                  as="textarea"
                  rows={3}
                  value={form.seo_description}
                  max={170}
                  hint="Shown in search results. Defaults to the excerpt."
                  onChange={set('seo_description')}
                />
                <Field
                  label="Canonical URL"
                  type="url"
                  value={form.canonical_url || ''}
                  error={errors.canonical_url}
                  hint="Only if this was first published elsewhere (e.g. Techinika)."
                  onChange={set('canonical_url')}
                />
                <div className="studio-serp" aria-label="Search result preview">
                  <span className="studio-serp-title">
                    {form.seo_title || form.title || 'Article title'}
                  </span>
                  <span className="studio-serp-url">goslish.vercel.app/writing/{form.slug}</span>
                  <span className="studio-serp-desc">
                    {form.seo_description || form.excerpt || 'Add a description.'}
                  </span>
                </div>
              </Panel>
              <div className="studio-savebar side">
                <span className="studio-muted">
                  {dirty ? 'Unsaved changes' : isNew ? '' : 'Saved'}
                </span>
                <Button variant="primary" type="submit" busy={busy} disabled={!dirty && !isNew}>
                  {isNew ? 'Create draft' : 'Save draft'}
                </Button>
              </div>
              {!isNew && (
                <ConfirmButton
                  confirmLabel="Delete permanently?"
                  onConfirm={async () => {
                    const result = await run(
                      () => adminApi.deleteArticle(form.id),
                      'Article deleted',
                    )
                    if (result.ok) {
                      setSaved(JSON.stringify(form))
                      navigate('/admin/writing')
                    }
                  }}
                >
                  Delete article
                </ConfirmButton>
              )}
            </aside>
          </form>
        )}
      </>
    </>
  )
}

export default function ArticleEditorPage() {
  const { id } = useParams()
  const state = useLoad(
    (signal) => (id === 'new' ? Promise.resolve(BLANK) : adminApi.article(id, signal)),
    [id],
  )
  // Mount the editor only with data for the current id (avoids editing stale data).
  const ready = state.data && (id === 'new' ? !state.data.id : String(state.data.id) === id)
  if (ready) return <ArticleEditor key={id} id={id} initial={state.data} />
  return (
    <>
      <PageHeader crumb="Studio / Writing" title="Article" />
      {state.error ? <LoadState state={state} /> : <p className="studio-muted">Loading…</p>}
    </>
  )
}
