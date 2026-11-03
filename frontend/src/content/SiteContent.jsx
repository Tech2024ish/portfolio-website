import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSite } from '../api'
import { useLanguage } from '../context/LanguageContext'
import { fallbackSite } from './fallback'

const SiteContentContext = createContext(null)

/** Merge optional FR/RW overrides stored in `translations` over English fields. */
export function localize(entity, language) {
  if (!entity || language === 'en') return entity
  const overrides = entity.translations?.[language]
  if (!overrides) return entity
  const merged = { ...entity }
  Object.entries(overrides).forEach(([key, value]) => {
    if (Array.isArray(value) ? value.length : value) merged[key] = value
  })
  return merged
}

export const paragraphs = (text) =>
  (text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

export function SiteContentProvider({ children }) {
  const [site, setSite] = useState(fallbackSite)
  const [status, setStatus] = useState('loading')

  const load = useCallback((signal) => {
    getSite(signal)
      .then((data) => {
        setSite({ ...data, isFallback: false })
        setStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('fallback')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(() => {
    setStatus('loading')
    load()
  }, [load])

  const value = useMemo(() => ({ site, status, reload }), [site, status, reload])
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}

export function useSiteContent() {
  const context = useContext(SiteContentContext)
  const { language } = useLanguage()
  if (!context) throw new Error('useSiteContent must be used inside SiteContentProvider')
  const { site } = context
  return useMemo(
    () => ({
      ...context,
      profile: localize(site.profile, language),
      skills: site.skills.map((group) => localize(group, language)),
      experience: site.experience.map((item) => localize(item, language)),
      education: site.education.map((item) => localize(item, language)),
      certifications: site.certifications,
      projects: site.projects.map((item) => localize(item, language)),
      articles: site.articles,
    }),
    [context, site, language],
  )
}
