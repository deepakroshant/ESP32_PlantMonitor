import { motion } from 'framer-motion'
import type { DeviceStatus } from '../../types'
import { PlantIcon } from '../icons/PlantIcon'
import { PencilIcon } from '../icons/PencilIcon'
import { fadeSlideUp } from '../../lib/motion'

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

const statusChip: Partial<Record<DeviceStatus, { text: string; dot: string }>> = {
  live:           { text: 'Live',    dot: 'bg-green-400' },
  delayed:        { text: 'Delayed', dot: 'bg-amber-400' },
  offline:        { text: 'Offline', dot: 'bg-red-400' },
  wifi_connected: { text: 'Syncing', dot: 'bg-amber-400' },
}

export function PlantHero({
  selectedMac, plantName, plantType, deviceStatus,
  dataUntrusted, isDelayed, health, healthOk, onEditPlant,
}: Props) {
  const chip = statusChip[deviceStatus]

  const healthVariant = dataUntrusted
    ? { bg: 'bg-forest/5', border: 'border-forest/10', text: 'text-forest/25' }
    : isDelayed
    ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' }
    : healthOk
    ? { bg: 'bg-primary/10', border: 'border-primary/25', text: 'text-primary' }
    : { bg: 'bg-terracotta/10', border: 'border-terracotta/25', text: 'text-terracotta' }

  return (
    <motion.div
      key={selectedMac}
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      className="section-card mb-5 flex items-center gap-4 !p-5 sm:gap-6 sm:!p-6"
    >
      {/* Plant icon */}
      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-500 sm:h-16 sm:w-16 ${
          dataUntrusted ? 'bg-forest/5' : ''
        }`}
        style={dataUntrusted ? {} : {
          background: 'linear-gradient(135deg, rgba(59,122,87,0.18) 0%, rgba(59,122,87,0.08) 100%)',
          boxShadow: '0 0 0 1px rgba(59,122,87,0.12)',
        }}
      >
        <PlantIcon
          className={`h-7 w-7 transition-colors duration-500 sm:h-8 sm:w-8 ${
            dataUntrusted ? 'text-forest/25' : 'text-primary'
          }`}
        />
      </div>

      {/* Name + type */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`font-display font-bold leading-tight transition-colors duration-300 sm:text-lg ${
              dataUntrusted ? 'text-forest/40' : 'text-forest'
            }`}
            style={{ fontSize: '1.05rem' }}
          >
            {plantName}
          </p>
          <button
            type="button"
            onClick={onEditPlant}
            className="rounded-full p-1 text-forest/35 transition hover:bg-sage-100 hover:text-forest"
            aria-label="Edit plant name and type"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {plantType && (
            <span className="text-xs text-forest-400">{plantType}</span>
          )}
          {chip && !dataUntrusted && (
            <span className="flex items-center gap-1 rounded-full bg-forest/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest/50">
              <span className={`h-1.5 w-1.5 rounded-full ${chip.dot} ${deviceStatus === 'live' ? 'animate-pulse' : ''}`} />
              {chip.text}
            </span>
          )}
          {!plantType && !chip && (
            <span className="text-xs text-forest/35">No plant type set</span>
          )}
        </div>
      </div>

      {/* Health badge */}
      <div className="shrink-0 text-right">
        <p className="mb-2 stat-label">Health</p>
        <span
          className={`inline-block rounded-full border px-4 py-1.5 text-sm font-semibold transition-all duration-500 sm:px-5 sm:text-base ${healthVariant.bg} ${healthVariant.border} ${healthVariant.text}`}
        >
          {dataUntrusted
            ? (deviceStatus === 'wifi_connected' || deviceStatus === 'syncing' ? '…' : '—')
            : (health ?? '—')}
        </span>
      </div>
    </motion.div>
  )
}
