import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { fadeSlideUp, staggerContainer, transition } from '../lib/motion'
import { PlantIcon } from '../components/icons/PlantIcon'
import { sanitizeEmail } from '../utils/sanitize'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const safeEmail = sanitizeEmail(email)
    if (!safeEmail) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password.length > 128) {
      setError('Password too long')
      return
    }
    setLoading(true)
    try {
      if (isSignUp) await signUp(safeEmail, password)
      else await signIn(safeEmail, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-12 dark:bg-forest-900">
      {/* Decorative ambient light */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/[.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/[.03] blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-sage-200/40 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-[420px]"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Brand */}
        <motion.div
          className="mb-10 text-center"
          variants={fadeSlideUp}
          transition={transition.section}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shadow-glow">
            <PlantIcon className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-[28px] font-bold tracking-tight text-forest">
            Smart Plant Pro
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-forest-400">
            Intelligent plant monitoring, powered by IoT
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="glass-card rounded-3xl p-7 shadow-card sm:p-8"
          variants={fadeSlideUp}
          transition={{ ...transition.section, delay: 0.08 }}
        >
          <h2 className="mb-6 text-lg font-semibold text-forest">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="stat-label mb-1.5 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="stat-label mb-1.5 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-terracotta/20 bg-terracotta-light px-4 py-2.5 text-sm text-terracotta"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isSignUp ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-forest/5 pt-5">
            <button
              type="button"
              onClick={() => { setIsSignUp((v) => !v); setError('') }}
              className="w-full text-center text-sm text-forest-400 transition hover:text-primary"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="mt-8 text-center text-xs text-forest-300"
          variants={fadeSlideUp}
          transition={{ ...transition.section, delay: 0.16 }}
        >
          ESP32-powered plant monitoring &middot; Real-time Firebase sync
        </motion.p>
      </motion.div>
    </div>
  )
}
