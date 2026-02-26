export type Readings = {
  temperature?: number
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
}

export type DeviceStatus =
  | 'live'
  | 'delayed'
  | 'offline'
  | 'syncing'
  | 'wifi_connected'
  | 'no_data'
