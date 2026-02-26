import { motion, AnimatePresence } from 'framer-motion'
import type { DeviceStatus } from '../../types'

type Props = {
  deviceStatus: DeviceStatus
  showSyncedBanner: boolean
  lastSeenLabel: string
}

const bannerMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
  transition: { type: 'spring' as const, stiffness: 200, damping: 22 },
}

export function StatusBanners({ deviceStatus, showSyncedBanner, lastSeenLabel }: Props) {
  return (
    <AnimatePresence mode="popLayout">
      {showSyncedBanner && (
        <motion.div key="synced" {...bannerMotion} className="mb-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 dark:border-primary/40 dark:bg-primary/20">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/35">
            <svg className="h-3.5 w-3.5 text-primary dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-primary dark:text-primary-300">Sync complete — live data is now showing</p>
        </motion.div>
      )}

      {deviceStatus === 'wifi_connected' && (
        <motion.div key="wifi" {...bannerMotion} className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200/50 bg-amber-50/70 px-3 py-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <div>
            <p className="text-sm font-medium text-forest">Connected to WiFi — syncing sensor data…</p>
            <p className="mt-0.5 text-xs text-forest-400">The device is online. Waiting for fresh sensor readings…</p>
          </div>
        </motion.div>
      )}

      {deviceStatus === 'delayed' && (
        <motion.div key="delayed" {...bannerMotion} className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200/40 bg-amber-50/60 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-900/25">
          <svg className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700 dark:text-amber-300">Data may be slightly outdated — last update was {lastSeenLabel}</p>
        </motion.div>
      )}

      {deviceStatus === 'offline' && (
        <motion.div key="offline" {...bannerMotion} className="mb-2 rounded-xl border border-red-200/50 bg-red-50/70 px-3 py-3 dark:border-red-800/50 dark:bg-red-900/35">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/30">
              <svg className="h-4 w-4 text-red-500 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-600 dark:text-red-300">Device appears offline</p>
              <p className="mt-0.5 text-xs text-red-500/70 dark:text-red-400/90">
                Last seen {lastSeenLabel}. Values below are frozen from the last known reading.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Check power', 'Check WiFi range', 'Try resetting WiFi'].map((hint) => (
                  <span key={hint} className="rounded-md bg-red-100/80 px-2 py-0.5 text-[10px] font-medium text-red-500 dark:bg-red-800/50 dark:text-red-300">
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
