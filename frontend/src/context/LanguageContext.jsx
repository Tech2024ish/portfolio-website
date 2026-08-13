import { createContext, useContext, useMemo, useState } from 'react'
import { translations } from '../translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en')
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next) => {
        localStorage.setItem('language', next)
        setLanguage(next)
      },
      t: translations[language],
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
