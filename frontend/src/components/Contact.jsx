import { useState } from 'react'
import { sendContact } from '../api'
import SectionHeading from './common/SectionHeading'

export default function Contact({ content, linkedin, phone }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('')
  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  const submitContact = async (event) => {
    event.preventDefault()
    setStatus('loading')
    try {
      await sendContact(form)
      setForm({ name: '', email: '', message: '' })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="section-pad contact-section">
      <div className="contact-grid">
        <div className="reveal">
          <SectionHeading eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
          <div className="contact-links">
            <a href={`mailto:${content.email}`}>
              {content.email} <span>&rarr;</span>
            </a>
            <a href={linkedin} target="_blank" rel="noreferrer">
              {content.linkedin} <span>&rarr;</span>
            </a>
            <a href={`tel:${phone.replace(/\s/g, '')}`}>
              {phone} <span>&rarr;</span>
            </a>
            <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              WhatsApp <span>&rarr;</span>
            </a>
          </div>
        </div>
        <form className="contact-form reveal" onSubmit={submitContact}>
          <label>
            {content.name}
            <input
              name="name"
              required
              value={form.name}
              onChange={updateField}
              placeholder={content.namePlaceholder}
            />
          </label>
          <label>
            {content.emailLabel}
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={updateField}
              placeholder={content.emailPlaceholder}
            />
          </label>
          <label>
            {content.message}
            <textarea
              name="message"
              required
              rows="5"
              value={form.message}
              onChange={updateField}
              placeholder={content.messagePlaceholder}
            />
          </label>
          <button className="button primary" disabled={status === 'loading'}>
            {status === 'loading' ? content.sending : content.send}
          </button>
          {status === 'success' && <p className="form-status success">{content.success}</p>}
          {status === 'error' && <p className="form-status error">{content.error}</p>}
        </form>
      </div>
    </section>
  )
}
