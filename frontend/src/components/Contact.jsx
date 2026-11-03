import { useState } from 'react'
import { sendContact } from '../api'
import { useLanguage } from '../context/LanguageContext'
import SectionHeading from './common/SectionHeading'

const empty = { name: '', email: '', subject: '', message: '', website: '' }

export default function Contact({ profile }) {
  const { t, ui } = useLanguage()
  const [form, setForm] = useState(empty)
  const [status, setStatus] = useState('')
  const [errorText, setErrorText] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const linkedin = profile.social_links.find((link) => link.label.toLowerCase() === 'linkedin')

  const submitContact = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setFieldErrors({})
    try {
      await sendContact(form)
      setForm(empty)
      setStatus('success')
    } catch (error) {
      setFieldErrors(Object.fromEntries((error.fields || []).map((f) => [f.field, f.message])))
      setErrorText(error.status === 429 ? error.message : t.contact.error)
      setStatus('error')
    }
  }

  const describedBy = (name) => (fieldErrors[name] ? `contact-${name}-error` : undefined)
  const fieldError = (name) =>
    fieldErrors[name] && (
      <span className="field-error" id={`contact-${name}-error`}>
        {fieldErrors[name]}
      </span>
    )

  return (
    <section id="contact" className="section-pad contact-section">
      <div className="contact-grid">
        <div className="reveal">
          <SectionHeading
            eyebrow={t.contact.eyebrow}
            title={t.contact.title}
            intro={profile.contact_intro}
          />
          <div className="contact-links">
            {profile.email && (
              <a href={`mailto:${profile.email}`}>
                {profile.email} <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {linkedin && (
              <a href={linkedin.url} target="_blank" rel="noreferrer">
                {t.contact.linkedin} <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone.replace(/\s/g, '')}`}>
                {profile.phone} <span aria-hidden="true">&rarr;</span>
              </a>
            )}
            {profile.whatsapp && (
              <a
                href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp <span aria-hidden="true">&rarr;</span>
              </a>
            )}
          </div>
        </div>
        <form className="contact-form reveal" onSubmit={submitContact} noValidate={false}>
          <label>
            {t.contact.name}
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={form.name}
              onChange={updateField}
              placeholder={t.contact.namePlaceholder}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={describedBy('name')}
            />
            {fieldError('name')}
          </label>
          <label>
            {t.contact.emailLabel}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              placeholder={t.contact.emailPlaceholder}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={describedBy('email')}
            />
            {fieldError('email')}
          </label>
          <label>
            {ui.contact.subject}
            <input
              name="subject"
              maxLength={200}
              value={form.subject}
              onChange={updateField}
              placeholder={ui.contact.subjectPlaceholder}
            />
          </label>
          <label>
            {t.contact.message}
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={5000}
              rows="5"
              value={form.message}
              onChange={updateField}
              placeholder={t.contact.messagePlaceholder}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={describedBy('message')}
            />
            {fieldError('message')}
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={updateField}
            />
          </label>
          <button className="button primary" disabled={status === 'loading'}>
            {status === 'loading' ? t.contact.sending : t.contact.send}
          </button>
          <p className="form-status-region" role="status" aria-live="polite">
            {status === 'success' && (
              <span className="form-status success">{t.contact.success}</span>
            )}
            {status === 'error' && <span className="form-status error">{errorText}</span>}
          </p>
        </form>
      </div>
    </section>
  )
}
