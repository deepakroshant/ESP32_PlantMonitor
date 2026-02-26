import { motion } from 'framer-motion'
import type { DeviceStatus, Readings } from '../../types'
import type { StatusMeta } from '../../utils/deviceStatus'

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 rounded-3xl border ${meta.border} ${meta.bg} p-4 transition-colors duration-500 sm:p-5`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedMac}
            onChange={(e) => onSelectMac(e.target.value)}
            className="rounded-xl border border-forest/10 bg-white/80 px-3 py-2 font-mono text-xs text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
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
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              isResetPending
                ? 'cursor-not-allowed border-forest/10 bg-white/40 text-forest/30'
                : 'border-red-200 bg-white/60 text-red-500 hover:bg-red-50'
            }`}
            title="Device will clear its WiFi config and restart in AP mode"
          >
            {isResetPending ? 'Reset sent…' : 'Reset WiFi'}
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            {meta.pulse && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.dotColor}`} />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
          </span>
          <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className={`text-xs ${meta.color} opacity-80`}>{statusDescription}</p>
        {readings?.wifiSSID && (
          <p className="text-xs text-forest-400">
            {deviceStatus === 'live' ? 'WiFi: ' : 'Last WiFi: '}
            <span className="font-medium text-forest-500">{readings.wifiSSID}</span>
            {readings.wifiRSSI != null && deviceStatus === 'live' && (
              <span className="ml-1">({readings.wifiRSSI} dBm)</span>
            )}
          </p>
        )}
        {lastUpdated && deviceStatus === 'live' && (
          <p className="text-xs text-forest/35">Updated at {lastUpdated}</p>
        )}
      </div>
    </motion.div>
  )
}
