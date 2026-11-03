import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { adminApi } from '../api'
import {
  Button,
  ConfirmButton,
  Field,
  LoadState,
  MediaDialog,
  MediaPicker,
  MoveButtons,
  PageHeader,
  Panel,
  StatusPill,
  TagInput,
  Toggle,
  TranslationFields,
  cleanTranslations,
  move,
  slugify,
  useAction,
  useLoad,
  useUnsavedWarning,
} from '../ui'

const BLANK = {
  title: '',
  slug: '',
  category: '',
  role: '',
  summary: '',
  problem: '',
  approach: '',
  architecture: '',
  challenges: '',
  outcome: '',
  tech_stack: [],
  github_url: '',
  live_url: '',
  thumbnail: null,
  is_featured: false,
  images: [],
  translations: {},
  status: 'draft',
}

const CASE_SECTIONS = [
  ['problem', 'The problem', 'What needed solving, for whom, and the constraints.'],
  ['approach', 'Approach', 'How you tackled it and why.'],
  [
    'architecture',
    'Architecture',
    'Components, data model, APIs. Markdown supported (lists, code blocks, links).',
  ],
  ['challenges', 'Challenges & trade-offs', 'What was hard and what you chose not to do.'],
  ['outcome', 'Outcome', 'What shipped and what you learned. Only state results you can verify.'],
]

function toBody(form) {
  return {
    title: form.title,
    slug: form.slug,
    category: form.category,
    role: form.role,
    summary: form.summary,
    problem: form.problem,
    approach: form.approach,
    architecture: form.architecture,
    challenges: form.challenges,
    outcome: form.outcome,
    tech_stack: form.tech_stack,
    github_url: form.github_url?.trim() || null,
    live_url: form.live_url?.trim() || null,
    thumbnail_id: form.thumbnail?.id ?? null,
    is_featured: form.is_featured,
    translations: cleanTranslations(form.translations),
  }
}

function ProjectEditor({ id, initial }) {
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [errors, setErrors] = useState({})
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [picking, setPicking] = useState(false)
  const [run, busy] = useAction()

  const dirty = form && JSON.stringify(form) !== saved
  useUnsavedWarning(dirty)
  const set = (key) => (value) =>
    setForm((f) => ({ ...f, [key]: value?.target ? value.target.value : value }))

  const save = async (event) => {
    event?.preventDefault()
    setErrors({})
    const body = toBody(form)
    let result
    if (isNew) {
      result = await run(() => adminApi.createProject(body), 'Project draft created')
    } else {
      body.images = form.images.map((image) => ({
        media_id: image.media_id,
        caption: image.caption,
      }))
      result = await run(() => adminApi.updateProject(id, body), 'Project saved')
    }
    if (!result.ok) {
      setErrors(Object.fromEntries((result.error.fields || []).map((f) => [f.field, f.message])))
      return false
    }
    setForm(result.data)
    setSaved(JSON.stringify(result.data))
    if (isNew) navigate(`/admin/projects/${result.data.id}`, { replace: true })
    return true
  }

  const togglePublish = async () => {
    if (dirty && !(await save())) return
    const action = form.status === 'published' ? adminApi.unpublishProject : adminApi.publishProject
    const result = await run(
      () => action(form.id),
      form.status === 'published'
        ? 'Project unpublished — hidden from the site'
        : 'Project published',
    )
    if (result.ok) {
      setForm(result.data)
      setSaved(JSON.stringify(result.data))
    }
  }

  const remove = async () => {
    const result = await run(() => adminApi.deleteProject(form.id), 'Project deleted')
    if (result.ok) {
      setSaved(JSON.stringify(form))
      navigate('/admin/projects')
    }
  }

  return (
    <>
      <PageHeader
        crumb={
          <>
            <Link to="/admin/projects">Studio / Projects</Link> / {isNew ? 'New' : form?.title}
          </>
        }
        title={isNew ? 'New project' : form?.title || 'Project'}
        actions={
          form &&
          !isNew && (
            <>
              <StatusPill status={form.status} />
              {form.status === 'published' && (
                <a
                  className="studio-btn small"
                  href={`/projects/${form.slug}`}
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
              <Panel title="Basics">
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
                  max={120}
                  error={errors.slug}
                  hint={`Public address: /projects/${form.slug || '…'}${!isNew ? ' — changing it breaks existing links.' : ''}`}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug')(e.target.value.toLowerCase())
                  }}
                />
                <Field
                  label="Summary"
                  as="textarea"
                  rows={3}
                  value={form.summary}
                  max={400}
                  error={errors.summary}
                  hint="Shown on cards and at the top of the case study. Required to publish."
                  onChange={set('summary')}
                />
                <div className="studio-grid two">
                  <Field
                    label="Category"
                    value={form.category}
                    max={80}
                    onChange={set('category')}
                    hint="Used for the project filter."
                  />
                  <Field
                    label="Your role"
                    value={form.role}
                    max={120}
                    onChange={set('role')}
                    hint="e.g. Backend developer"
                  />
                </div>
                <TagInput
                  label="Technologies"
                  value={form.tech_stack}
                  onChange={set('tech_stack')}
                />
              </Panel>

              <Panel
                title="Case study"
                description="Markdown supported. Empty sections are hidden on the public page."
              >
                {CASE_SECTIONS.map(([key, label, hint]) => (
                  <Field
                    key={key}
                    label={label}
                    as="textarea"
                    rows={6}
                    value={form[key]}
                    hint={hint}
                    onChange={set(key)}
                  />
                ))}
              </Panel>

              {!isNew && (
                <Panel
                  title="Screenshots"
                  actions={
                    <Button type="button" size="small" onClick={() => setPicking(true)}>
                      + Add screenshot
                    </Button>
                  }
                >
                  {form.images.length === 0 && <p className="studio-empty">No screenshots yet.</p>}
                  <ul className="studio-shots">
                    {form.images.map((image, index) => (
                      <li key={image.media_id}>
                        <img src={image.media.url} alt={image.media.alt_text || ''} />
                        <input
                          aria-label={`Caption for screenshot ${index + 1}`}
                          placeholder="Caption"
                          value={image.caption}
                          maxLength={300}
                          onChange={(e) =>
                            set('images')(
                              form.images.map((im, i) =>
                                i === index ? { ...im, caption: e.target.value } : im,
                              ),
                            )
                          }
                        />
                        <MoveButtons
                          index={index}
                          length={form.images.length}
                          label="screenshot"
                          onMove={(a, b) => set('images')(move(form.images, a, b))}
                        />
                        <button
                          type="button"
                          className="studio-icon-btn"
                          aria-label={`Remove screenshot ${index + 1}`}
                          onClick={() => set('images')(form.images.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  {picking && (
                    <MediaDialog
                      kind="image"
                      onClose={() => setPicking(false)}
                      onSelect={(media) => {
                        setPicking(false)
                        if (!form.images.some((im) => im.media_id === media.id))
                          set('images')([
                            ...form.images,
                            { media_id: media.id, caption: '', media },
                          ])
                      }}
                    />
                  )}
                </Panel>
              )}

              <Panel title="Translations">
                <TranslationFields
                  value={form.translations}
                  onChange={set('translations')}
                  fields={[
                    ['title', 'Title'],
                    ['category', 'Category'],
                    ['summary', 'Summary', true],
                  ]}
                />
              </Panel>
            </div>

            <aside className="studio-editor-side">
              <Panel title="Presentation">
                <MediaPicker
                  label="Thumbnail"
                  value={form.thumbnail}
                  onChange={set('thumbnail')}
                  hint="16:9 works best."
                />
                <Toggle
                  label="Featured on the home page"
                  checked={form.is_featured}
                  onChange={set('is_featured')}
                />
              </Panel>
              <Panel title="Links">
                <Field
                  label="GitHub repository"
                  type="url"
                  value={form.github_url || ''}
                  error={errors.github_url}
                  onChange={set('github_url')}
                />
                <Field
                  label="Live demo"
                  type="url"
                  value={form.live_url || ''}
                  error={errors.live_url}
                  onChange={set('live_url')}
                />
              </Panel>
              <div className="studio-savebar side">
                <span className="studio-muted">
                  {dirty ? 'Unsaved changes' : isNew ? '' : 'Saved'}
                </span>
                <Button variant="primary" type="submit" busy={busy} disabled={!dirty && !isNew}>
                  {isNew ? 'Create draft' : 'Save'}
                </Button>
              </div>
              {!isNew && (
                <ConfirmButton onConfirm={remove} confirmLabel="Delete permanently?">
                  Delete project
                </ConfirmButton>
              )}
            </aside>
          </form>
        )}
      </>
    </>
  )
}

export default function ProjectEditorPage() {
  const { id } = useParams()
  const state = useLoad(
    (signal) => (id === 'new' ? Promise.resolve(BLANK) : adminApi.project(id, signal)),
    [id],
  )
  // Mount the editor only with data for the current id (avoids editing stale data).
  const ready = state.data && (id === 'new' ? !state.data.id : String(state.data.id) === id)
  if (ready) return <ProjectEditor key={id} id={id} initial={state.data} />
  return (
    <>
      <PageHeader crumb="Studio / Projects" title="Project" />
      {state.error ? <LoadState state={state} /> : <p className="studio-muted">Loading…</p>}
    </>
  )
}
