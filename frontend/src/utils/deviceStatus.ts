import type { Readings, DeviceStatus } from '../types'

// After a reset request the device needs time to: receive the flag (~5s sync),
// clear it, reboot, and enter AP mode.  Any readings arriving within this
// window are "last-gasp" data from the pre-reset device — ignore them.
const RESET_GRACE_SEC = 30

/** If we have alerts/diagnostics but no readings, treat as "recent" for up to 2 min */
const PARTIAL_DATA_RECENT_SEC = 120

export type DeviceStatusOptions = {
  /** Fallback when readings.timestamp is invalid (e.g. NTP not synced on ESP32) */
  lastSyncAt?: number | null
  /** When readings is null but we receive alerts, show syncing instead of connecting */
  lastAlertTs?: number | null
}

export function getDeviceStatus(
  readings: Readings | null,
  nowSec: number,
  resetRequestedAt: number,
  options?: DeviceStatusOptions,
): DeviceStatus {
  if (!readings && resetRequestedAt > 0) return 'syncing'
  if (!readings) {
    // We're getting alerts but no readings — device is partially syncing
    const alertTs = options?.lastAlertTs ?? 0
    if (alertTs > 1577836800 && nowSec - alertTs <= PARTIAL_DATA_RECENT_SEC) return 'syncing'
    return 'no_data'
  }

  const ts = readings.timestamp ?? 0
  const tsValid = ts > 1577836800
  const lastSyncAt = options?.lastSyncAt ?? 0
  const hasValidLastSync = lastSyncAt > 1577836800

  if (resetRequestedAt > 0) {
    // Readings must be well after the reset request to be considered genuine
    const isPostReset = tsValid && ts > resetRequestedAt + RESET_GRACE_SEC
    if (!isPostReset) return 'syncing'
    if (!readings.wifiSSID) return 'syncing'
    const hasSensors = readings.temperature != null && !Number.isNaN(readings.temperature)
    if (!hasSensors) return 'wifi_connected'
  }

  // Use lastSyncAt as fallback when timestamp is invalid (e.g. ESP32 NTP not synced yet)
  const effectiveTs = tsValid ? ts : (hasValidLastSync ? lastSyncAt : 0)
  if (effectiveTs <= 0) return 'no_data'

  const secondsAgo = nowSec - effectiveTs
  if (secondsAgo <= 15) return 'live'
  if (secondsAgo <= 35) return 'delayed'
  return 'offline'
}

export type StatusMeta = {
  color: string
  bg: string
  border: string
  label: string
  pulse: boolean
  dotColor: string
  darkBg: string
  darkBorder: string
  darkColor: string
}

export const STATUS_META: Record<DeviceStatus, StatusMeta> = {
  live:           { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200/60',  label: 'Live',           pulse: true,  dotColor: 'bg-green-500', darkBg: 'dark:bg-green-900/40', darkBorder: 'dark:border-green-700/60', darkColor: 'dark:text-green-300' },
  delayed:        { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'Delayed',        pulse: false, dotColor: 'bg-amber-500', darkBg: 'dark:bg-amber-900/30', darkBorder: 'dark:border-amber-700/50', darkColor: 'dark:text-amber-300' },
  offline:        { color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200/60',    label: 'Offline',        pulse: false, dotColor: 'bg-red-500', darkBg: 'dark:bg-red-900/30', darkBorder: 'dark:border-red-800/50', darkColor: 'dark:text-red-300' },
  syncing:        { color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200/60',   label: 'Syncing',        pulse: true,  dotColor: 'bg-blue-500', darkBg: 'dark:bg-blue-900/30', darkBorder: 'dark:border-blue-700/50', darkColor: 'dark:text-blue-300' },
  wifi_connected: { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'WiFi Connected', pulse: true,  dotColor: 'bg-amber-500', darkBg: 'dark:bg-amber-900/30', darkBorder: 'dark:border-amber-700/50', darkColor: 'dark:text-amber-300' },
  no_data:        { color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200/60',   label: 'Connecting',     pulse: true,  dotColor: 'bg-gray-400', darkBg: 'dark:bg-slate-800/50', darkBorder: 'dark:border-slate-600/50', darkColor: 'dark:text-slate-400' },
}

export function formatSecondsAgo(sec: number, tsValid: boolean): string {
  if (!tsValid) return 'never'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`
  return `${Math.floor(sec / 86400)} d ago`
}
