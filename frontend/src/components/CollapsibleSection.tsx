import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { accordionContent } from '../lib/motion'

type Props = {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="section-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="accordion-trigger"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest dark:text-slate-200">{title}</p>
          {subtitle && !open && (
            <p className="mt-1 text-xs text-forest/35 dark:text-slate-500 line-clamp-1">{subtitle}</p>
          )}
        </div>
        <svg
          className="accordion-chevron"
          data-open={open}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            variants={accordionContent}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
