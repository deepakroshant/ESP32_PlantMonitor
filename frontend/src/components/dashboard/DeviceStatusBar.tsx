import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { DeviceStatus, Readings, DeviceMeta } from '../../types'
import type { StatusMeta } from '../../utils/deviceStatus'
import { spring } from '../../lib/motion'
import { ConfirmDestructiveButton } from '../ConfirmDestructiveButton'

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
  statusDescription: React.ReactNode
  readings: Readings | null
  lastUpdated: string | null
}

export function DeviceStatusBar({
  devices, devicesMeta, selectedMac, onSelectMac, onSaveDeviceMeta,
  onResetWiFi, isResetPending, deviceStatus, statusMeta, statusDescription,
  readings, lastUpdated,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [editName, setEditName] = useState('')
  const [editRoom, setEditRoom] = useState('')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
      className={`mb-3 rounded-2xl border ${statusMeta.border} ${statusMeta.bg} ${statusMeta.darkBorder} ${statusMeta.darkBg} p-3 transition-colors duration-500 sm:p-4`}
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Device selector — always visible */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-0">
          <select
            value={selectedMac}
            onChange={(e) => onSelectMac(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-forest/10 bg-white/85 px-3 py-2 text-xs text-forest shadow-soft focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm dark:border-forest/20 dark:bg-forest-800/60 dark:text-forest-200"
            aria-label="Select device"
          >
            {devices.map((mac) => (
              <option key={mac} value={mac}>{deviceLabel(mac, devicesMeta[mac])}</option>
            ))}
          </select>

          {/* Desktop: edit + reset visible */}
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={openEdit}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-forest/10 bg-white/70 text-forest/50 transition hover:bg-white hover:text-forest dark:border-forest/20 dark:bg-forest-800/40 dark:text-forest-400 dark:hover:bg-forest-700/60 dark:hover:text-forest"
              aria-label="Edit device name"
              title="Edit device name and room"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <ConfirmDestructiveButton
              label={isResetPending ? 'Reset sent…' : 'Reset WiFi'}
              title="Reset device WiFi?"
              message="The device will clear its WiFi config and restart in setup mode. You must reconnect it to your WiFi. Data will pause until it reconnects."
              confirmLabel="Reset"
              onConfirm={onResetWiFi}
              disabled={isResetPending}
              variant="danger"
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                isResetPending
                  ? 'cursor-not-allowed border-forest/10 bg-white/40 text-forest/30 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-500'
                  : 'border-red-200/70 bg-white/70 text-red-500 hover:bg-red-50 hover:border-red-300 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 dark:hover:border-red-700'
              }`}
            />
          </div>

          {/* Mobile: overflow menu */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-forest/10 bg-white/70 text-forest/50 transition hover:bg-white hover:text-forest dark:border-forest/20 dark:bg-forest-800/40 dark:text-forest-400"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-forest/10 bg-white py-2 shadow-lift dark:border-slate-600 dark:bg-slate-800"
              >
                <button type="button" onClick={() => { openEdit(); setMenuOpen(false) }} className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-forest hover:bg-sage-50 dark:text-slate-200 dark:hover:bg-slate-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit device
                </button>
                <ConfirmDestructiveButton
                  label="Reset WiFi"
                  title="Reset device WiFi?"
                  message="The device will clear its WiFi config and restart. You must reconnect it."
                  confirmLabel="Reset"
                  onConfirm={async () => { await onResetWiFi(); setMenuOpen(false) }}
                  disabled={isResetPending}
                  variant="danger"
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {isResetPending ? 'Reset sent…' : 'Reset WiFi'}
                </ConfirmDestructiveButton>
                <Link to="/overview" onClick={() => setMenuOpen(false)} className="flex min-h-[44px] items-center gap-3 px-4 text-sm text-forest-500 hover:bg-sage-50 dark:text-slate-300 dark:hover:bg-slate-700">
                  All devices
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        {/* All devices link (desktop) */}
        <Link to="/overview" className="hidden rounded-xl border border-forest/10 bg-white/70 px-2.5 py-2 text-xs font-medium text-forest-500 transition hover:bg-white hover:text-forest sm:flex dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white">
          All devices
        </Link>

        {/* Status badge */}
        <div className="flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5 dark:bg-slate-700/70 dark:border dark:border-slate-600/50">
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
        <p className={`text-xs ${statusMeta.color} ${statusMeta.darkColor} opacity-90`}>{statusDescription}</p>
        {readings?.wifiSSID && (
          <p className="text-xs text-forest-400 dark:text-slate-400">
            {deviceStatus === 'live' ? 'WiFi: ' : 'Last WiFi: '}
            <span className="font-medium text-forest-500 dark:text-slate-300">{readings.wifiSSID}</span>
            {readings.wifiRSSI != null && deviceStatus === 'live' && (
              <span className="ml-1 opacity-70 dark:opacity-80">({readings.wifiRSSI} dBm)</span>
            )}
          </p>
        )}
        {lastUpdated && deviceStatus === 'live' && (
          <p className="text-xs text-forest/30 dark:text-slate-500">Updated {lastUpdated}</p>
        )}
      </div>

      {/* Edit device name/room modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/25 dark:bg-black/50 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="edit-device-title" onClick={() => setEditOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-forest/10 bg-white p-5 shadow-modal dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-device-title" className="mb-4 text-sm font-semibold uppercase tracking-wider text-forest/60 dark:text-slate-300">Edit device</h2>
            <p className="mb-3 font-mono text-xs text-forest/40 dark:text-slate-400">{selectedMac}</p>
            <label className="block text-xs font-medium text-forest-600 dark:text-slate-400">
              Name
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Monstera by window" className="mt-1 w-full input-field" />
            </label>
            <label className="mt-3 block text-xs font-medium text-forest-600 dark:text-slate-400">
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
