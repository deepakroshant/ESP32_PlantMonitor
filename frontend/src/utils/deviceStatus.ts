import type { Readings, DeviceStatus } from '../types'

// After a reset request the device needs time to: receive the flag (~5s sync),
// clear it, reboot, and enter AP mode.  Any readings arriving within this
// window are "last-gasp" data from the pre-reset device — ignore them.
const RESET_GRACE_SEC = 30

export function getDeviceStatus(
  readings: Readings | null,
  nowSec: number,
  resetRequestedAt: number,
): DeviceStatus {
  if (!readings && resetRequestedAt > 0) return 'syncing'
  if (!readings) return 'no_data'

  const ts = readings.timestamp ?? 0
  const tsValid = ts > 1577836800

  if (resetRequestedAt > 0) {
    // Readings must be well after the reset request to be considered genuine
    const isPostReset = tsValid && ts > resetRequestedAt + RESET_GRACE_SEC
    if (!isPostReset) return 'syncing'
    if (!readings.wifiSSID) return 'syncing'
    const hasSensors = readings.temperature != null && !Number.isNaN(readings.temperature)
    if (!hasSensors) return 'wifi_connected'
  }

  if (!tsValid) return 'no_data'

  const secondsAgo = nowSec - ts
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
}

export const STATUS_META: Record<DeviceStatus, StatusMeta> = {
  live:           { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200/60',  label: 'Live',           pulse: true,  dotColor: 'bg-green-500' },
  delayed:        { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'Delayed',        pulse: false, dotColor: 'bg-amber-500' },
  offline:        { color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200/60',    label: 'Offline',        pulse: false, dotColor: 'bg-red-500' },
  syncing:        { color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200/60',   label: 'Syncing',        pulse: true,  dotColor: 'bg-blue-500' },
  wifi_connected: { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'WiFi Connected', pulse: true,  dotColor: 'bg-amber-500' },
  no_data:        { color: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-200/60',   label: 'No Data',        pulse: false, dotColor: 'bg-gray-400' },
}

export function formatSecondsAgo(sec: number, tsValid: boolean): string {
  if (!tsValid) return 'never'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`
  return `${Math.floor(sec / 86400)} d ago`
}
