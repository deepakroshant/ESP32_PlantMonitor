import { motion } from 'framer-motion'
import type { DeviceStatus } from '../../types'
import { PlantIcon } from '../icons/PlantIcon'
import { PencilIcon } from '../icons/PencilIcon'

type Props = {
  selectedMac: string
  plantName: string
  plantType: string
  deviceStatus: DeviceStatus
  dataUntrusted: boolean
  isDelayed: boolean
  health: string | undefined
  healthOk: boolean
  onEditPlant: () => void
}

const statusLabel: Partial<Record<DeviceStatus, { text: string; color: string }>> = {
  live:           { text: '· Live',    color: 'text-green-500' },
  delayed:        { text: '· Delayed', color: 'text-amber-500' },
  offline:        { text: '· Offline', color: 'text-red-400' },
  wifi_connected: { text: '· Syncing', color: 'text-amber-500' },
}

export function PlantHero({
  selectedMac, plantName, plantType, deviceStatus,
  dataUntrusted, isDelayed, health, healthOk, onEditPlant,
}: Props) {
  const badge = statusLabel[deviceStatus]

  return (
    <motion.div
      key={selectedMac}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="section-card mb-6 flex items-center gap-4 !p-4 sm:gap-5 sm:!p-5"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-500 sm:h-14 sm:w-14 ${
        dataUntrusted ? 'bg-forest/5' : 'bg-primary/10'
      }`}>
        <PlantIcon className={`h-6 w-6 transition-colors duration-500 sm:h-7 sm:w-7 ${
          dataUntrusted ? 'text-forest/30' : 'text-primary'
        }`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium transition-colors duration-300 sm:text-base ${
            dataUntrusted ? 'text-forest/50' : 'text-forest'
          }`}>
            {plantName}
          </p>
          <button
            type="button"
            onClick={onEditPlant}
            className="rounded-full p-1 text-forest/50 transition hover:bg-sage-100 hover:text-forest"
            aria-label="Edit plant name and type"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-forest-400">
          {plantType || 'No plant type set'}
          {badge && <span className={`ml-1.5 ${badge.color}`}>{badge.text}</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-forest/50 sm:text-xs">
          Health
        </p>
        {dataUntrusted ? (
          <span className="inline-block rounded-full border-2 border-forest/10 bg-forest/5 px-4 py-2 text-sm font-semibold text-forest/30 sm:px-5 sm:py-2.5 sm:text-base">
            {deviceStatus === 'wifi_connected' || deviceStatus === 'syncing' ? '…' : '—'}
          </span>
        ) : isDelayed ? (
          <span className="inline-block rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 sm:px-5 sm:py-2.5 sm:text-base">
            {health ?? '?'}
          </span>
        ) : (
          <span className={`inline-block rounded-full border-2 px-4 py-2 text-sm font-semibold sm:px-5 sm:py-2.5 sm:text-base ${
            healthOk ? 'border-primary/30 bg-primary/10 text-primary' : 'border-terracotta/30 bg-terracotta/10 text-terracotta'
          }`}>
            {health ?? '—'}
          </span>
        )}
      </div>
    </motion.div>
  )
}
