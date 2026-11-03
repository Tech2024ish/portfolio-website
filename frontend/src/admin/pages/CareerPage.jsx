import { useState } from 'react'
import { adminApi } from '../api'
import {
  Button,
  ConfirmButton,
  Field,
  ListEditor,
  LoadState,
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
  useAction,
  useLoad,
} from '../ui'
import ProfileTabs from './ProfileTabs'

/*
 * Field spec: [key, label, type, options]
 * types: text, textarea, date, url, toggle, list, tags, media
 */
const COLLECTIONS = {
  experiences: {
    title: 'Professional experience',
    singular: 'experience',
    heading: (item) => `${item.role} · ${item.organization}`,
    sub: (item) =>
      item.period_label ||
      [item.start_date, item.is_current ? 'Present' : item.end_date].filter(Boolean).join(' — '),
    blank: {
      organization: '',
      role: '',
      is_visible: false,
      highlights: [],
      skills: [],
      translations: {},
    },
    fields: [
      ['organization', 'Organization', 'text', { required: true, max: 160 }],
      ['role', 'Role', 'text', { required: true, max: 160 }],
      [
        'employment_type',
        'Employment type / programme',
        'text',
        { max: 60, hint: 'e.g. Full-time, Internship, IEE / Mastercard Foundation' },
      ],
      ['location', 'Location', 'text', { max: 120 }],
      ['start_date', 'Start date', 'date'],
      ['end_date', 'End date', 'date'],
      ['is_current', 'I currently work here', 'toggle'],
      [
        'period_label',
        'Display period (overrides dates)',
        'text',
        { max: 80, hint: 'e.g. “May — Present”. Leave empty to show the dates.' },
      ],
      ['summary', 'Summary', 'textarea'],
      ['highlights', 'Highlights', 'list'],
      ['skills', 'Skills used', 'tags'],
      ['logo', 'Organization logo', 'media', { kind: 'image' }],
      ['is_visible', 'Show on the public site', 'toggle'],
    ],
    translations: [
      ['role', 'Role'],
      ['period_label', 'Period'],
      ['summary', 'Summary', true],
      ['highlights', 'Highlights', 'list'],
    ],
  },
  education: {
    title: 'Education',
    singular: 'education entry',
    heading: (item) => `${item.degree}${item.field_of_study ? ` in ${item.field_of_study}` : ''}`,
    sub: (item) => [item.institution, item.period_label].filter(Boolean).join(' · '),
    blank: { institution: '', degree: '', is_visible: true, translations: {} },
    fields: [
      ['institution', 'Institution', 'text', { required: true, max: 160 }],
      ['degree', 'Degree', 'text', { required: true, max: 160 }],
      ['field_of_study', 'Field of study', 'text', { max: 160 }],
      ['status', 'Status', 'text', { max: 60, hint: 'e.g. In progress, Graduated' }],
      ['period_label', 'Period', 'text', { max: 80, hint: 'e.g. Expected July 2028' }],
      ['description', 'Description', 'textarea'],
      ['logo', 'Institution logo', 'media', { kind: 'image' }],
      ['is_visible', 'Show on the public site', 'toggle'],
    ],
    translations: [
      ['degree', 'Degree'],
      ['field_of_study', 'Field of study'],
      ['status', 'Status'],
      ['period_label', 'Period'],
      ['description', 'Description', true],
    ],
  },
  certifications: {
    title: 'Certifications',
    singular: 'certification',
    heading: (item) => item.name,
    sub: (item) => [item.issuer, item.issued_label].filter(Boolean).join(' · '),
    blank: { name: '', is_visible: true },
    fields: [
      ['name', 'Certification', 'text', { required: true, max: 160 }],
      ['issuer', 'Issuer', 'text', { max: 160 }],
      ['issued_label', 'Issued', 'text', { max: 60, hint: 'e.g. March 2025' }],
      ['credential_url', 'Credential URL', 'url'],
      ['certificate', 'Certificate file (image or PDF)', 'media', { kind: 'any' }],
      ['is_visible', 'Show on the public site', 'toggle'],
    ],
  },
}

const MEDIA_KEYS = { logo: 'logo_id', certificate: 'certificate_id' }

function toBody(spec, form) {
  const body = {}
  spec.fields.forEach(([key, , type]) => {
    if (type === 'media') body[MEDIA_KEYS[key]] = form[key]?.id ?? null
    else if (type === 'date') body[key] = form[key] || null
    else if (type === 'url') body[key] = form[key]?.trim() || null
    else if (type === 'list')
      body[key] = (form[key] || []).map((line) => line.trim()).filter(Boolean)
    else if (form[key] !== undefined) body[key] = form[key]
  })
  if (spec.translations) body.translations = cleanTranslations(form.translations)
  return body
}

function ItemForm({ spec, item, onSaved, onCancel, create }) {
  const [form, setForm] = useState(item)
  const [errors, setErrors] = useState({})
  const [run, busy] = useAction()
  const set = (key) => (value) =>
    setForm({ ...form, [key]: value?.target ? value.target.value : value })

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    const body = toBody(spec, form)
    const result = await run(() => create(body), `Saved ${spec.singular}`)
    if (result.ok) onSaved(result.data)
    else setErrors(Object.fromEntries((result.error.fields || []).map((f) => [f.field, f.message])))
  }

  return (
    <form className="studio-form studio-item-form" onSubmit={submit}>
      <div className="studio-grid two">
        {spec.fields.map(([key, label, type, options = {}]) => {
          if (type === 'toggle')
            return <Toggle key={key} label={label} checked={form[key]} onChange={set(key)} />
          if (type === 'list')
            return (
              <ListEditor
                key={key}
                label={label}
                value={form[key] || []}
                onChange={set(key)}
                placeholder="One achievement or responsibility"
              />
            )
          if (type === 'tags')
            return <TagInput key={key} label={label} value={form[key] || []} onChange={set(key)} />
          if (type === 'media')
            return (
              <MediaPicker
                key={key}
                label={label}
                kind={options.kind}
                value={form[key]}
                onChange={set(key)}
              />
            )
          return (
            <Field
              key={key}
              label={label}
              type={type === 'textarea' ? undefined : type === 'url' ? 'url' : type}
              as={type === 'textarea' ? 'textarea' : 'input'}
              rows={type === 'textarea' ? 4 : undefined}
              value={form[key] ?? ''}
              onChange={set(key)}
              required={options.required}
              max={options.max}
              hint={options.hint}
              error={errors[key]}
              className={type === 'textarea' ? 'span-2' : ''}
            />
          )
        })}
      </div>
      {spec.translations && (
        <TranslationFields
          value={form.translations || {}}
          onChange={set('translations')}
          fields={spec.translations}
        />
      )}
      <div className="studio-row">
        <Button variant="primary" type="submit" busy={busy}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Collection({ name }) {
  const spec = COLLECTIONS[name]
  const api = adminApi.collection(name)
  const state = useLoad((signal) => api.list(signal))
  const [editing, setEditing] = useState(null) // item id or 'new'
  const [run] = useAction()

  const reorder = async (from, to) => {
    const list = move(state.data, from, to)
    state.setData(list)
    const result = await run(() => api.reorder(list.map((item) => item.id)))
    if (!result.ok) state.reload()
  }

  return (
    <Panel
      title={spec.title}
      actions={
        editing !== 'new' && (
          <Button size="small" onClick={() => setEditing('new')}>
            + Add {spec.singular}
          </Button>
        )
      }
    >
      <LoadState state={state}>
        {editing === 'new' && (
          <ItemForm
            spec={spec}
            item={spec.blank}
            create={(body) => api.create(body)}
            onCancel={() => setEditing(null)}
            onSaved={(created) => {
              state.setData((list) => [...list, created])
              setEditing(null)
            }}
          />
        )}
        <ul className="studio-collection">
          {state.data?.map((item, index) =>
            editing === item.id ? (
              <li key={item.id}>
                <ItemForm
                  spec={spec}
                  item={item}
                  create={(body) => api.update(item.id, body)}
                  onCancel={() => setEditing(null)}
                  onSaved={(updated) => {
                    state.setData((list) => list.map((i) => (i.id === updated.id ? updated : i)))
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <li key={item.id} className="studio-collection-row">
                <MoveButtons
                  index={index}
                  length={state.data.length}
                  onMove={reorder}
                  label={spec.heading(item)}
                />
                <div>
                  <strong>{spec.heading(item)}</strong>
                  <span className="studio-muted">{spec.sub(item) || 'No dates yet'}</span>
                </div>
                <StatusPill status={item.is_visible ? 'visible' : 'hidden'} />
                <Button size="small" onClick={() => setEditing(item.id)}>
                  Edit
                </Button>
                <ConfirmButton
                  size="small"
                  onConfirm={async () => {
                    const result = await run(() => api.remove(item.id), `Deleted ${spec.singular}`)
                    if (result.ok) state.setData((list) => list.filter((i) => i.id !== item.id))
                  }}
                >
                  Delete
                </ConfirmButton>
              </li>
            ),
          )}
        </ul>
        {state.data?.length === 0 && editing !== 'new' && (
          <p className="studio-empty">Nothing here yet.</p>
        )}
      </LoadState>
    </Panel>
  )
}

export default function CareerPage() {
  return (
    <>
      <PageHeader
        crumb="Studio / Profile & content"
        title="Experience, education & certifications"
        description="Hidden entries stay private until you complete and show them. Order controls the public order."
      />
      <ProfileTabs />
      <Collection name="experiences" />
      <Collection name="education" />
      <Collection name="certifications" />
    </>
  )
}
