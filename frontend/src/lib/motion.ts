import type { Variants, Transition } from 'framer-motion'

const ease = [0.25, 0.46, 0.45, 0.94] as const

export const duration = {
  fast: 0.15,
  normal: 0.22,
  slow: 0.35,
} as const

export const transition: Record<string, Transition> = {
  page:    { duration: duration.normal, ease: 'easeOut' },
  section: { duration: duration.slow,   ease },
  card:    { duration: duration.normal, ease },
}

export const fadeSlideUp: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
}

export const fade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
}

export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
}

export const pageWrap = {
  initial:    'hidden' as const,
  animate:    'visible' as const,
  exit:       'exit' as const,
  variants:   fadeSlideUp,
  transition: transition.page,
}
