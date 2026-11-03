import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext()

function savedTheme() {
  try {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || saved === 'light' ? saved : null
  } catch {
    return null
  }
}

export function ThemeProvider({ children }) {
  // The live site has always defaulted to dark.
  const [dark, setDarkState] = useState(() => (savedTheme() ?? 'dark') === 'dark')
  const [explicit, setExplicit] = useState(() => savedTheme() !== null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0d1714' : '#f5f7f5')
  }, [dark])

  /** Visitor choice: remembered on this device. */
  const setDark = useCallback((next) => {
    setDarkState(next)
    setExplicit(true)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // storage unavailable; keep in-memory choice
    }
  }, [])

  /** Owner's site default: only applies when the visitor has not chosen. */
  const applyDefault = useCallback(
    (theme) => {
      if (!explicit && (theme === 'dark' || theme === 'light')) setDarkState(theme === 'dark')
    },
    [explicit],
  )

  const value = useMemo(() => ({ dark, setDark, applyDefault }), [dark, setDark, applyDefault])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
