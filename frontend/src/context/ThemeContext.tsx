import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'spp-theme'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleDark: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    const t = getStoredTheme()
    if (t === 'light') return 'light'
    if (t === 'dark') return 'dark'
    return getSystemTheme()
  })

  useEffect(() => {
    const root = document.documentElement
    let effective: 'light' | 'dark'
    if (theme === 'system') {
      effective = getSystemTheme()
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        const next = mq.matches ? 'dark' : 'light'
        setResolvedTheme(next)
        root.classList.toggle('dark', next === 'dark')
      }
      mq.addEventListener('change', handler)
      root.classList.toggle('dark', effective === 'dark')
      return () => mq.removeEventListener('change', handler)
    }
    effective = theme
    setResolvedTheme(effective)
    root.classList.toggle('dark', effective === 'dark')
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  const toggleDark = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
