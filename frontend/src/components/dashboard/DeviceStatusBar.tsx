import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { DeviceStatus, Readings, DeviceMeta } from '../../types'
import type { StatusMeta } from '../../utils/deviceStatus'
import { spring } from '../../lib/motion'

function deviceLabel(mac: string, meta?: DeviceMeta): string {
  if (meta?.name?.trim()) return meta.name
  if (meta?.room?.trim()) return meta.room
  return mac
}

type Props = {
  devices: string[]
  devicesMeta: Record<string, DeviceMeta>
  selectedMac: string
  onSelectMac: (mac: string) => void
  onSaveDeviceMeta: (mac: string, meta: DeviceMeta) => Promise<void>
  onResetWiFi: () => void
  isResetPending: boolean
  deviceStatus: DeviceStatus
  statusMeta: StatusMeta
  statusDescription: string
  readings: Readings | null
  lastUpdated: string | null
}

export function DeviceStatusBar({
  devices, devicesMeta, selectedMac, onSelectMac, onSaveDeviceMeta,
  onResetWiFi, isResetPending, deviceStatus, statusMeta, statusDescription,
  readings, lastUpdated,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRoom, setEditRoom] = useState('')

  function openEdit() {
    const m = devicesMeta[selectedMac]
    setEditName(m?.name ?? '')
    setEditRoom(m?.room ?? '')
    setEditOpen(true)
  }

  async function saveEdit() {
    await onSaveDeviceMeta(selectedMac, { name: editName.trim() || undefined, room: editRoom.trim() || undefined })
    setEditOpen(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className={`mb-3 rounded-2xl border ${statusMeta.border} ${statusMeta.bg} p-3 transition-colors duration-500 sm:p-4`}
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Device selector + reset */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMac}
            onChange={(e) => onSelectMac(e.target.value)}
            className="rounded-xl border border-forest/10 bg-white/85 px-3 py-2 text-xs text-forest shadow-soft focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm dark:border-forest/20 dark:bg-forest-800/60 dark:text-forest-200"
            aria-label="Select device"
          >
            {devices.map((mac) => (
              <option key={mac} value={mac}>{deviceLabel(mac, devicesMeta[mac])}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={openEdit}
            className="rounded-xl border border-forest/10 bg-white/70 px-2.5 py-2 text-forest/50 transition hover:bg-white hover:text-forest dark:border-forest/20 dark:bg-forest-800/40 dark:text-forest-400 dark:hover:bg-forest-700/60 dark:hover:text-forest"
            aria-label="Edit device name"
            title="Edit device name and room"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>

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

        <Link to="/overview" className="rounded-xl border border-forest/10 bg-white/70 px-2.5 py-2 text-xs font-medium text-forest-500 transition hover:bg-white hover:text-forest">
          All devices
        </Link>

        {/* Status badge */}
        <div className="flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {statusMeta.pulse && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${statusMeta.dotColor}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${statusMeta.dotColor}`} />
          </span>
          <span className={`text-xs font-semibold tracking-wide ${statusMeta.color}`}>{statusMeta.label}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className={`text-xs ${statusMeta.color} opacity-75`}>{statusDescription}</p>
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

      {/* Edit device name/room modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/25 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="edit-device-title" onClick={() => setEditOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-forest/10 bg-white p-5 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-device-title" className="mb-4 text-sm font-semibold uppercase tracking-wider text-forest/60">Edit device</h2>
            <p className="mb-3 font-mono text-xs text-forest/40">{selectedMac}</p>
            <label className="block text-xs font-medium text-forest-600">
              Name
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Monstera by window" className="mt-1 w-full input-field" />
            </label>
            <label className="mt-3 block text-xs font-medium text-forest-600">
              Room
              <input type="text" value={editRoom} onChange={(e) => setEditRoom(e.target.value)} placeholder="e.g. Living room" className="mt-1 w-full input-field" />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="flex-1 btn-ghost">Cancel</button>
              <button type="button" onClick={saveEdit} className="flex-1 btn-primary">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
