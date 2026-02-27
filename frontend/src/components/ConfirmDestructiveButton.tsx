import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { spring } from '../lib/motion'

type Props = {
  label: string
  confirmLabel?: string
  cancelLabel?: string
  title: string
  message: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  variant?: 'danger' | 'warning'
  className?: string
  children?: React.ReactNode
}

export function ConfirmDestructiveButton({
  label,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  title,
  message,
  onConfirm,
  disabled = false,
  variant = 'danger',
  className = '',
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const isRed = variant === 'danger'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
      >
        {children ?? label}
      </button>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-forest/25 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-destructive-title"
            onClick={() => !loading && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring.gentle}
              className="w-full max-w-sm rounded-2xl border border-forest/10 bg-white p-6 shadow-modal dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="confirm-destructive-title" className="mb-2 text-lg font-semibold text-forest dark:text-slate-100">
                {title}
              </h2>
              <p className="mb-6 text-sm text-forest-500 dark:text-slate-400">{message}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !loading && setOpen(false)}
                  className="flex-1 btn-ghost"
                  disabled={loading}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                    isRed
                      ? 'bg-red-500 hover:bg-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-500'
                      : 'bg-amber-500 hover:bg-amber-600 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500'
                  }`}
                >
                  {loading ? '…' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
