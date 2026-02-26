import { motion } from 'framer-motion'
import type { DeviceStatus } from '../../types'

type Props = {
  deviceStatus: DeviceStatus
  showSyncedBanner: boolean
  lastSeenLabel: string
}

export function StatusBanners({ deviceStatus, showSyncedBanner, lastSeenLabel }: Props) {
  return (
    <>
      {showSyncedBanner && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3"
        >
          <svg className="h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-primary">Sync complete — live data is now showing</p>
        </motion.div>
      )}

      {deviceStatus === 'wifi_connected' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-5 py-4"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
          <div>
            <p className="text-sm font-medium text-forest">Connected to WiFi — syncing sensor data…</p>
            <p className="text-xs text-forest-400">The device is online. Waiting for fresh sensor readings…</p>
          </div>
        </motion.div>
      )}

      {deviceStatus === 'delayed' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3"
        >
          <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">Data may be slightly outdated — last update was {lastSeenLabel}</p>
        </motion.div>
      )}

      {deviceStatus === 'offline' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-600">Device appears offline</p>
              <p className="mt-0.5 text-xs text-red-500/70">
                Last seen {lastSeenLabel}. The values below are frozen from the last known reading.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Check power supply', 'Check WiFi range', 'Try resetting WiFi'].map((hint) => (
                  <span key={hint} className="rounded-md bg-red-100/80 px-2 py-0.5 text-[10px] font-medium text-red-600">
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  )
}
