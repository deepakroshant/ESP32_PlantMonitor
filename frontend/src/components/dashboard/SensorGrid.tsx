import { motion } from 'framer-motion'
import type { DeviceStatus, Readings } from '../../types'
import { CircularGauge } from '../CircularGauge'
import { ThermometerIcon } from '../icons/ThermometerIcon'
import { SunIcon } from '../icons/SunIcon'

type Props = {
  deviceStatus: DeviceStatus
  dataUntrusted: boolean
  isDelayed: boolean
  displayTemp: number
  temp: number | undefined
  displayGaugePct: number
  soilLabel: string
  readings: Readings | null
  selectedMac: string
}

function LiveDot() {
  return (
    <div
      className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
      aria-hidden="true"
    />
  )
}

function FrozenOverlay({ deviceStatus }: { deviceStatus: DeviceStatus }) {
  const text =
    deviceStatus === 'syncing' || deviceStatus === 'wifi_connected'
      ? 'Waiting for sensor data…'
      : deviceStatus === 'no_data'
        ? 'No data yet'
        : 'Data frozen — device offline'

  return (
    <div className="pointer-events-none absolute -inset-1 z-10 flex items-start justify-center rounded-3xl">
      <div className="pointer-events-auto mt-20 rounded-2xl bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
        <p className="text-center text-sm font-semibold text-forest/60">{text}</p>
      </div>
    </div>
  )
}

function BarometerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <path d="M12 3v1" />
      <path d="M12 20v1" />
      <path d="M3 12h1" />
      <path d="M20 12h1" />
    </svg>
  )
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  )
}

function formatPressure(pa: number): string {
  return (pa / 100).toFixed(1)
}

export function SensorGrid({
  deviceStatus, dataUntrusted, isDelayed,
  displayTemp, temp, displayGaugePct, soilLabel,
  readings, selectedMac,
}: Props) {
  const isLive = deviceStatus === 'live'
  const hasPressure = readings?.pressure != null && !Number.isNaN(readings.pressure)
  const hasHumidity = readings?.humidity != null && !Number.isNaN(readings.humidity)

  return (
    <div className="relative">
      {dataUntrusted && <FrozenOverlay deviceStatus={deviceStatus} />}

      <motion.div
        key={`gauges-${selectedMac}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: dataUntrusted ? 0.35 : isDelayed ? 0.7 : 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-500 ${
          dataUntrusted
            ? 'pointer-events-none select-none blur-[1px] grayscale-[40%]'
            : isDelayed
              ? 'grayscale-[15%]'
              : ''
        }`}
      >
        {/* Temperature */}
        <div className="section-card relative overflow-hidden">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ThermometerIcon className="h-5 w-5 text-primary" />
          </div>
          <p className="stat-label mb-1">Temperature</p>
          <p className="font-display text-2xl font-bold tabular-nums text-forest">
            {temp != null && !Number.isNaN(temp) ? `${displayTemp.toFixed(1)}°C` : '—'}
          </p>
          {isLive && <LiveDot />}
        </div>

        {/* Soil moisture gauge */}
        <div className="section-card relative overflow-hidden lg:col-span-2">
          <p className="stat-label mb-4 text-center">Soil moisture</p>
          <CircularGauge percentage={displayGaugePct} label={soilLabel} size={170} strokeWidth={10} />
          {isLive && <LiveDot />}
        </div>

        {/* Pressure — shown when firmware sends it */}
        {hasPressure && (
          <div className="section-card relative overflow-hidden">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarometerIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="stat-label mb-1">Pressure</p>
            <p className="font-display text-2xl font-bold tabular-nums text-forest">
              {formatPressure(readings!.pressure!)}
              <span className="ml-1 text-sm font-medium text-forest-400">hPa</span>
            </p>
            {isLive && <LiveDot />}
          </div>
        )}

        {/* Light */}
        <div className="section-card relative overflow-hidden">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SunIcon className="h-5 w-5 text-primary" />
          </div>
          <p className="stat-label mb-1">Light</p>
          <p className="font-display text-xl font-bold text-forest">
            {readings?.lightBright === true ? 'Bright' : readings?.lightBright === false ? 'Dim' : '—'}
          </p>
          {isLive && <LiveDot />}
        </div>

        {/* Humidity — shown only when sensor is BME280 */}
        {hasHumidity && (
          <div className="section-card relative overflow-hidden">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <DropletIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="stat-label mb-1">Humidity</p>
            <p className="font-display text-2xl font-bold tabular-nums text-forest">
              {readings!.humidity!.toFixed(1)}
              <span className="ml-1 text-sm font-medium text-forest-400">%</span>
            </p>
            {isLive && <LiveDot />}
          </div>
        )}
      </motion.div>
    </div>
  )
}
