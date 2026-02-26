import { useTheme } from '../../context/ThemeContext'

export function ThemeToggleIcon() {
  const { resolvedTheme, toggleDark } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleDark}
      className="flex items-center gap-1.5 rounded-xl border border-forest/15 bg-white/60 px-2.5 py-2 text-forest/60 transition hover:bg-white hover:text-forest dark:border-slate-600 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30 dark:hover:text-amber-200"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      <span className="hidden text-xs font-medium sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
