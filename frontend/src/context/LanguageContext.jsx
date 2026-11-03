import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from '../translations'
import { uiStrings } from '../uiStrings'

const LanguageContext = createContext(null)
const SUPPORTED = ['en', 'fr', 'rw']

function initialLanguage() {
  try {
    const saved = localStorage.getItem('language')
    return SUPPORTED.includes(saved) ? saved : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = language === 'rw' ? 'rw' : language
  }, [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage: (next) => {
        if (!SUPPORTED.includes(next)) return
        try {
          localStorage.setItem('language', next)
        } catch {
          // storage unavailable (private mode); keep the in-memory choice
        }
        setLanguage(next)
      },
      t: translations[language],
      ui: uiStrings[language],
    }),
    [language],
  )
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
