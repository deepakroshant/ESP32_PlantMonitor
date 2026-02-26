import { motion } from 'framer-motion'
import type { DeviceStatus, Readings } from '../../types'
import { CircularGauge } from '../CircularGauge'
import { ThermometerIcon } from '../icons/ThermometerIcon'
import { SunIcon } from '../icons/SunIcon'
import { staggerContainer, cardItem } from '../../lib/motion'

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
    <span
      className="absolute right-4 top-4 flex h-2 w-2"
      aria-hidden="true"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
    </span>
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
      <div className="pointer-events-auto mt-24 rounded-2xl bg-white/95 px-5 py-3 shadow-lift backdrop-blur-sm">
        <p className="text-center text-sm font-semibold text-forest/55">{text}</p>
      </div>
    </div>
  )
}

function BarometerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <path d="M12 3v1M12 20v1M3 12h1M20 12h1" />
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
  const isLive      = deviceStatus === 'live'
  const hasPressure = readings?.pressure != null && !Number.isNaN(readings.pressure)
  const hasHumidity = readings?.humidity  != null && !Number.isNaN(readings.humidity)

  const gridOpacity = dataUntrusted ? 0.32 : isDelayed ? 0.68 : 1

  return (
    <div className="relative mb-5">
      {dataUntrusted && <FrozenOverlay deviceStatus={deviceStatus} />}

      <motion.div
        key={`gauges-${selectedMac}`}
        variants={staggerContainer}
        initial="hidden"
        animate={{ ...{ opacity: gridOpacity, y: 0 }, transition: { staggerChildren: 0.07 } }}
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-all duration-500 ${
          dataUntrusted ? 'pointer-events-none select-none blur-[1px] grayscale-[50%]' : isDelayed ? 'grayscale-[20%]' : ''
        }`}
      >
        {/* Temperature */}
        <motion.div
          variants={cardItem}
          whileHover={dataUntrusted ? {} : { y: -2 }}
          className="sensor-card relative overflow-hidden"
        >
          {isLive && <LiveDot />}
          <div className="icon-pill mb-4">
            <ThermometerIcon className="h-5 w-5 text-primary" />
          </div>
          <p className="stat-label mb-2">Temperature</p>
          <p className="font-display text-3xl font-bold tabular-nums text-forest leading-none">
            {temp != null && !Number.isNaN(temp) ? `${displayTemp.toFixed(1)}°` : '—'}
            {temp != null && !Number.isNaN(temp) && (
              <span className="ml-1 text-base font-medium text-forest-400">C</span>
            )}
          </p>
        </motion.div>

        {/* Light */}
        <motion.div
          variants={cardItem}
          whileHover={dataUntrusted ? {} : { y: -2 }}
          className="sensor-card relative overflow-hidden"
        >
          {isLive && <LiveDot />}
          <div className="icon-pill mb-4">
            <SunIcon className="h-5 w-5 text-primary" />
          </div>
          <p className="stat-label mb-2">Light</p>
          <p className="font-display text-3xl font-bold text-forest leading-none">
            {readings?.lightBright === true ? 'Bright' : readings?.lightBright === false ? 'Dim' : '—'}
          </p>
        </motion.div>

        {/* Soil moisture — full width */}
        <motion.div
          variants={cardItem}
          whileHover={dataUntrusted ? {} : { y: -2 }}
          className="sensor-card relative overflow-hidden sm:col-span-2"
        >
          {isLive && <LiveDot />}
          <p className="stat-label mb-5 text-center">Soil moisture</p>
          <CircularGauge percentage={displayGaugePct} label={soilLabel} size={180} strokeWidth={11} />
        </motion.div>

        {/* Pressure — optional */}
        {hasPressure && (
          <motion.div
            variants={cardItem}
            whileHover={dataUntrusted ? {} : { y: -2 }}
            className="sensor-card relative overflow-hidden"
          >
            {isLive && <LiveDot />}
            <div className="icon-pill mb-4">
              <BarometerIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="stat-label mb-2">Pressure</p>
            <p className="font-display text-3xl font-bold tabular-nums text-forest leading-none">
              {formatPressure(readings!.pressure!)}
              <span className="ml-1 text-base font-medium text-forest-400">hPa</span>
            </p>
          </motion.div>
        )}

        {/* Humidity — optional (BME280) */}
        {hasHumidity && (
          <motion.div
            variants={cardItem}
            whileHover={dataUntrusted ? {} : { y: -2 }}
            className="sensor-card relative overflow-hidden"
          >
            {isLive && <LiveDot />}
            <div className="icon-pill mb-4">
              <DropletIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="stat-label mb-2">Humidity</p>
            <p className="font-display text-3xl font-bold tabular-nums text-forest leading-none">
              {readings!.humidity!.toFixed(1)}
              <span className="ml-1 text-base font-medium text-forest-400">%</span>
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
