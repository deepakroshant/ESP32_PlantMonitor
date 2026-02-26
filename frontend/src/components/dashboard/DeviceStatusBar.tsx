import { motion } from 'framer-motion'
import type { DeviceStatus, Readings } from '../../types'
import type { StatusMeta } from '../../utils/deviceStatus'
import { spring } from '../../lib/motion'

type Props = {
  devices: string[]
  selectedMac: string
  onSelectMac: (mac: string) => void
  onResetWiFi: () => void
  isResetPending: boolean
  deviceStatus: DeviceStatus
  meta: StatusMeta
  statusDescription: string
  readings: Readings | null
  lastUpdated: string | null
}

export function DeviceStatusBar({
  devices, selectedMac, onSelectMac, onResetWiFi,
  isResetPending, deviceStatus, meta, statusDescription,
  readings, lastUpdated,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className={`mb-3 rounded-2xl border ${meta.border} ${meta.bg} p-3 transition-colors duration-500 sm:p-4`}
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Device selector + reset */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMac}
            onChange={(e) => onSelectMac(e.target.value)}
            className="rounded-xl border border-forest/10 bg-white/85 px-3 py-2 font-mono text-xs text-forest shadow-soft focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm"
            aria-label="Select device"
          >
            {devices.map((mac) => (
              <option key={mac} value={mac}>{mac}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onResetWiFi}
            disabled={isResetPending}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              isResetPending
                ? 'cursor-not-allowed border-forest/10 bg-white/40 text-forest/30'
                : 'border-red-200/70 bg-white/70 text-red-500 hover:bg-red-50 hover:border-red-300'
            }`}
            title="Device will clear its WiFi config and restart in AP mode"
          >
            {isResetPending ? 'Reset sent…' : 'Reset WiFi'}
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {meta.pulse && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${meta.dotColor}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dotColor}`} />
          </span>
          <span className={`text-xs font-semibold tracking-wide ${meta.color}`}>{meta.label}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className={`text-xs ${meta.color} opacity-75`}>{statusDescription}</p>
        {readings?.wifiSSID && (
          <p className="text-xs text-forest-400">
            {deviceStatus === 'live' ? 'WiFi: ' : 'Last WiFi: '}
            <span className="font-medium text-forest-500">{readings.wifiSSID}</span>
            {readings.wifiRSSI != null && deviceStatus === 'live' && (
              <span className="ml-1 opacity-60">({readings.wifiRSSI} dBm)</span>
            )}
          </p>
        )}
        {lastUpdated && deviceStatus === 'live' && (
          <p className="text-xs text-forest/30">Updated {lastUpdated}</p>
        )}
      </div>
    </motion.div>
  )
}
