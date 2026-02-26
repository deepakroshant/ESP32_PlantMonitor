import type { Variants, Transition } from 'framer-motion'

// ── Spring presets (GSAP-inspired physics) ──
export const spring = {
  gentle: { type: 'spring' as const, stiffness: 120, damping: 20 },
  snappy: { type: 'spring' as const, stiffness: 200, damping: 22 },
  smooth: { type: 'spring' as const, stiffness: 90,  damping: 18 },
  bouncy: { type: 'spring' as const, stiffness: 160, damping: 15 },
}

export const duration = {
  fast:   0.15,
  normal: 0.22,
  slow:   0.38,
} as const

export const transition: Record<string, Transition> = {
  page:    { duration: duration.normal, ease: 'easeOut' },
  section: { ...spring.gentle },
  card:    { ...spring.snappy },
}

// ── Variants ──

export const fadeSlideUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0,  transition: spring.gentle },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
}

export const fadeScale: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1,    transition: spring.gentle },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
}

export const fade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
}

// Stagger container — wraps a list of cardItem children
export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

// Individual card inside a stagger container
export const cardItem: Variants = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
}

// Slide in from left (for banners / status)
export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: spring.snappy },
  exit:    { opacity: 0, x: -8, transition: { duration: 0.15 } },
}

export const pageWrap = {
  initial:    'hidden'  as const,
  animate:    'visible' as const,
  exit:       'exit'    as const,
  variants:   fadeSlideUp,
  transition: transition.page,
}
