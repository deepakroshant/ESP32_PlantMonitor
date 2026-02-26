export type Readings = {
  temperature?: number
  pressure?: number
  humidity?: number
  soilRaw?: number
  lightBright?: boolean
  pumpRunning?: boolean
  health?: string
  timestamp?: number
  wifiSSID?: string
  wifiRSSI?: number
}

export type PlantProfile = {
  name: string
  type: string
  createdAt: number
  /** Ideal soil raw range (lower = wetter). Optional. */
  soilMin?: number
  soilMax?: number
  /** Ideal temp range °C. Optional. */
  tempMin?: number
  tempMax?: number
  /** Ideal humidity % range. Optional. */
  humidityMin?: number
  humidityMax?: number
  /** Light preference: bright, dim, or any. Optional. */
  lightPreference?: 'bright' | 'dim' | 'any'
}

export type DeviceMeta = {
  name?: string
  room?: string
}

export type WaterLogEntry = {
  reason: 'manual' | 'schedule' | 'auto'
  durationMs: number
  soilBefore: number
  soilAfter: number
}

export type DeviceStatus =
  | 'live'
  | 'delayed'
  | 'offline'
  | 'syncing'
  | 'wifi_connected'
  | 'no_data'

export type WateringSchedule = {
  enabled?: boolean
  hour?: number
  minute?: number
  hysteresis?: number
  maxSecondsPerDay?: number
  cooldownMinutes?: number
  day?: string
  todaySeconds?: number
  lastWateredAt?: number
}
