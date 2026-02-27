import { motion } from 'framer-motion'

type Props = {
  variant?: 'sensor' | 'hero' | 'gauge'
  className?: string
}

export function SkeletonCard({ variant = 'sensor', className = '' }: Props) {
  if (variant === 'hero') {
    return (
      <div className={`section-card mb-3 !p-4 sm:!p-5 ${className}`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-forest/[0.06] dark:bg-slate-700/50 sm:h-14 sm:w-14 sm:rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded-md bg-forest/[0.06] dark:bg-slate-700/50" />
            <div className="h-3 w-24 animate-pulse rounded-md bg-forest/[0.04] dark:bg-slate-700/40" />
          </div>
          <div className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-forest/[0.06] dark:bg-slate-700/50" />
        </div>
      </div>
    )
  }

  if (variant === 'gauge') {
    return (
      <div className={`sensor-card relative overflow-hidden sm:col-span-2 ${className}`}>
        <div className="mb-5 h-4 w-24 animate-pulse rounded-md bg-forest/[0.06] dark:bg-slate-700/50 mx-auto" />
        <div className="flex items-center justify-center">
          <div className="h-[180px] w-[180px] animate-pulse rounded-full bg-forest/[0.04] dark:bg-slate-700/40" />
        </div>
      </div>
    )
  }

  // sensor
  return (
    <motion.div
      className={`sensor-card relative overflow-hidden ${className}`}
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
    >
      <div className="icon-pill mb-4 h-10 w-10 animate-pulse bg-forest/[0.06] dark:bg-slate-700/50" />
      <div className="mb-2 h-3 w-20 animate-pulse rounded-md bg-forest/[0.06] dark:bg-slate-700/50" />
      <div className="h-9 w-16 animate-pulse rounded-md bg-forest/[0.08] dark:bg-slate-600/50" />
    </motion.div>
  )
}
