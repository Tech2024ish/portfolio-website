import React, { useState } from 'react'
import { sendContact } from '../api'
import { useLanguage } from '../context/LanguageContext'

export default function Contact() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState(null)

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    try {
      await sendContact(form)
      setStatus('success')
      setForm({ name: '', email: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="py-24 bg-gray-950">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-teal-400 font-semibold uppercase tracking-widest text-sm mb-2">
            {t.contact.sectionLabel}
          </p>
          <h2 className="text-4xl font-extrabold text-white">{t.contact.title}</h2>
          <div className="mt-4 w-16 h-1 bg-teal-500 mx-auto rounded-full" />
          <p className="mt-4 text-gray-400">{t.contact.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              {t.contact.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder={t.contact.namePlaceholder}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              {t.contact.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder={t.contact.emailPlaceholder}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
              {t.contact.messageLabel}
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              value={form.message}
              onChange={handleChange}
              placeholder={t.contact.messagePlaceholder}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? t.contact.sending : t.contact.sendButton}
          </button>

          {status === 'success' && (
            <p className="text-center text-emerald-400 font-medium">{t.contact.success}</p>
          )}
          {status === 'error' && (
            <p className="text-center text-red-500 font-medium">{t.contact.error}</p>
          )}
        </form>
      </div>
    </section>
  )
}
