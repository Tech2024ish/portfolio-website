import { useState } from 'react'
import { adminApi } from '../api'
import {
  Button,
  Field,
  LoadState,
  MediaPicker,
  MoveButtons,
  PageHeader,
  Panel,
  Toggle,
  TranslationFields,
  cleanTranslations,
  move,
  useAction,
  useLoad,
  useUnsavedWarning,
} from '../ui'
import ProfileTabs from './ProfileTabs'

const EDITABLE = [
  'full_name',
  'professional_title',
  'location',
  'is_available',
  'availability_text',
  'hero_title',
  'hero_title_accent',
  'hero_summary',
  'about_title',
  'about_lead',
  'about_body',
  'engineering_principles',
  'contact_intro',
  'email',
  'phone',
  'whatsapp',
  'social_links',
  'translations',
]

function toForm(profile) {
  const form = Object.fromEntries(EDITABLE.map((key) => [key, profile[key]]))
  form.photo = profile.photo
  return form
}

function ProfileForm({ profile }) {
  const [form, setForm] = useState(() => toForm(profile))
  const [saved, setSaved] = useState(() => JSON.stringify(toForm(profile)))
  const [errors, setErrors] = useState({})
  const [run, busy] = useAction()

  const dirty = form && JSON.stringify(form) !== saved
  useUnsavedWarning(dirty)
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event?.target ? event.target.value : event })

  const save = async (event) => {
    event.preventDefault()
    setErrors({})
    const body = Object.fromEntries(EDITABLE.map((key) => [key, form[key]]))
    body.photo_id = form.photo?.id ?? null
    body.translations = cleanTranslations(form.translations)
    body.social_links = form.social_links.filter((link) => link.label.trim() || link.url.trim())
    body.engineering_principles = form.engineering_principles.filter((p) => p.title.trim())
    const result = await run(
      () => adminApi.updateProfile(body),
      'Profile saved. The public site shows it now.',
    )
    if (result.ok) {
      setForm(toForm(result.data))
      setSaved(JSON.stringify(toForm(result.data)))
    } else
      setErrors(
        Object.fromEntries(
          (result.error.fields || []).map((f) => [f.field.split('.')[0], f.message]),
        ),
      )
  }

  return (
    <form className="studio-form" onSubmit={save}>
      <Panel title="Identity & positioning">
        <div className="studio-grid two">
          <Field
            label="Full name"
            value={form.full_name}
            onChange={set('full_name')}
            required
            max={120}
            error={errors.full_name}
          />
          <Field
            label="Professional title"
            value={form.professional_title}
            onChange={set('professional_title')}
            required
            max={120}
            error={errors.professional_title}
          />
          <Field label="Location" value={form.location} onChange={set('location')} max={120} />
          <MediaPicker
            label="Profile photograph"
            value={form.photo}
            onChange={(media) => setForm({ ...form, photo: media })}
            hint="Shown in the hero. Portrait orientation (about 4:5) works best. Without one, the original photo is used."
          />
        </div>
        <Toggle
          label="Available for opportunities"
          hint="Shows the green availability line in the hero."
          checked={form.is_available}
          onChange={set('is_available')}
        />
        <Field
          label="Availability text"
          value={form.availability_text}
          onChange={set('availability_text')}
          max={200}
        />
      </Panel>

      <Panel title="Hero">
        <div className="studio-grid two">
          <Field
            label="Headline"
            value={form.hero_title}
            onChange={set('hero_title')}
            required
            max={200}
            error={errors.hero_title}
          />
          <Field
            label="Headline accent (green)"
            value={form.hero_title_accent}
            onChange={set('hero_title_accent')}
            max={200}
          />
        </div>
        <Field
          label="Introduction"
          as="textarea"
          rows={3}
          value={form.hero_summary}
          onChange={set('hero_summary')}
          max={600}
        />
      </Panel>

      <Panel title="About">
        <Field
          label="Section title"
          value={form.about_title}
          onChange={set('about_title')}
          max={200}
        />
        <Field
          label="Lead paragraph"
          as="textarea"
          rows={3}
          value={form.about_lead}
          onChange={set('about_lead')}
          max={800}
        />
        <Field
          label="Biography"
          as="textarea"
          rows={8}
          value={form.about_body}
          onChange={set('about_body')}
          hint="Separate paragraphs with a blank line."
        />
      </Panel>

      <Panel title="Engineering focus" description="The four-column band under the hero.">
        {form.engineering_principles.map((principle, index) => (
          <div key={index} className="studio-repeat-row">
            <Field
              label={`Title ${index + 1}`}
              value={principle.title}
              max={80}
              onChange={(e) =>
                set('engineering_principles')(
                  form.engineering_principles.map((p, i) =>
                    i === index ? { ...p, title: e.target.value } : p,
                  ),
                )
              }
            />
            <Field
              label="Description"
              value={principle.body}
              max={300}
              onChange={(e) =>
                set('engineering_principles')(
                  form.engineering_principles.map((p, i) =>
                    i === index ? { ...p, body: e.target.value } : p,
                  ),
                )
              }
            />
            <MoveButtons
              index={index}
              length={form.engineering_principles.length}
              label="principle"
              onMove={(from, to) =>
                set('engineering_principles')(move(form.engineering_principles, from, to))
              }
            />
            <button
              type="button"
              className="studio-icon-btn"
              aria-label={`Remove principle ${index + 1}`}
              onClick={() =>
                set('engineering_principles')(
                  form.engineering_principles.filter((_, i) => i !== index),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
        {form.engineering_principles.length < 8 && (
          <Button
            type="button"
            size="small"
            variant="ghost"
            onClick={() =>
              set('engineering_principles')([
                ...form.engineering_principles,
                { title: '', body: '' },
              ])
            }
          >
            + Add principle
          </Button>
        )}
      </Panel>

      <Panel title="Contact & social links">
        <Field
          label="Contact introduction"
          as="textarea"
          rows={2}
          value={form.contact_intro}
          onChange={set('contact_intro')}
          max={600}
        />
        <div className="studio-grid three">
          <Field
            label="Public email"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Field label="Phone" value={form.phone} onChange={set('phone')} max={40} />
          <Field
            label="WhatsApp number"
            value={form.whatsapp}
            onChange={set('whatsapp')}
            max={40}
            hint="Digits with country code, e.g. +250783326529"
            error={errors.whatsapp}
          />
        </div>
        {form.social_links.map((link, index) => (
          <div key={index} className="studio-repeat-row">
            <Field
              label="Label"
              value={link.label}
              max={40}
              onChange={(e) =>
                set('social_links')(
                  form.social_links.map((l, i) =>
                    i === index ? { ...l, label: e.target.value } : l,
                  ),
                )
              }
            />
            <Field
              label="URL"
              type="url"
              value={link.url}
              error={errors.social_links}
              onChange={(e) =>
                set('social_links')(
                  form.social_links.map((l, i) =>
                    i === index ? { ...l, url: e.target.value } : l,
                  ),
                )
              }
            />
            <button
              type="button"
              className="studio-icon-btn"
              aria-label={`Remove link ${link.label || index + 1}`}
              onClick={() => set('social_links')(form.social_links.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
        {form.social_links.length < 10 && (
          <Button
            type="button"
            size="small"
            variant="ghost"
            onClick={() => set('social_links')([...form.social_links, { label: '', url: '' }])}
          >
            + Add link
          </Button>
        )}
      </Panel>

      <Panel title="Translations">
        <TranslationFields
          value={form.translations}
          onChange={set('translations')}
          fields={[
            ['professional_title', 'Professional title'],
            ['availability_text', 'Availability'],
            ['hero_title', 'Headline'],
            ['hero_title_accent', 'Headline accent'],
            ['hero_summary', 'Introduction', true],
            ['about_title', 'About title'],
            ['about_lead', 'About lead', true],
            ['about_body', 'Biography', true],
            ['contact_intro', 'Contact introduction', true],
          ]}
        />
      </Panel>

      <div className="studio-savebar">
        <span className="studio-muted">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <Button variant="primary" type="submit" busy={busy} disabled={!dirty}>
          Save profile
        </Button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const state = useLoad((signal) => adminApi.profile(signal))
  return (
    <>
      <PageHeader
        crumb="Studio / Profile & content"
        title="Profile, content & identity"
        description="What visitors read first: your name, positioning, hero, about and contact details."
      />
      <ProfileTabs />
      <LoadState state={state}>{state.data && <ProfileForm profile={state.data} />}</LoadState>
    </>
  )
}
