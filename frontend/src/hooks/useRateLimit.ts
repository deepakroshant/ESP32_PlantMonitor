import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Client-side rate limiting for sensitive actions (Water, Reset, Invite, Claim).
 * Returns [canExecute, execute, cooldownRemaining].
 */
export function useRateLimit(cooldownMs: number): [
  canExecute: boolean,
  execute: (fn: () => void | Promise<void>) => Promise<void>,
  cooldownRemaining: number
] {
  const lastAtRef = useRef(0)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      const left = Math.max(0, cooldownMs - (Date.now() - lastAtRef.current))
      setRemaining(left)
    }, 200)
    return () => clearInterval(id)
  }, [remaining, cooldownMs])

  const canExecute = remaining <= 0

  const execute = useCallback(
    async (fn: () => void | Promise<void>) => {
      if (Date.now() - lastAtRef.current < cooldownMs) return
      lastAtRef.current = Date.now()
      setRemaining(cooldownMs)
      await fn()
    },
    [cooldownMs]
  )

  return [canExecute, execute, remaining]
}
