import { useEffect, useState, useMemo } from 'react'
import { ref, query, orderByKey, limitToLast, onValue } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useTheme } from '../context/ThemeContext'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

type HistoryEntry = {
  time: number
  temperature: number | null
  soilRaw: number
  pressure: number | null
  humidity: number | null
}

type SeriesKey = 'temperature' | 'soilRaw' | 'pressure' | 'humidity'

const SERIES_META: Record<SeriesKey, { label: string; color: string; unit: string; yAxisId: string }> = {
  temperature: { label: 'Temperature', color: '#F59E0B', unit: '°C',  yAxisId: 'temp'     },
  soilRaw:     { label: 'Soil raw',    color: '#3B7A57', unit: '',    yAxisId: 'soil'     },
  pressure:    { label: 'Pressure',    color: '#6366F1', unit: ' hPa', yAxisId: 'pressure' },
  humidity:    { label: 'Humidity',    color: '#06B6D4', unit: '%',   yAxisId: 'temp'     },
}

const RANGES = [
  { label: '6 h', hours: 6 },
  { label: '12 h', hours: 12 },
  { label: '24 h', hours: 24 },
] as const

function formatTime(epoch: number): string {
  const d = new Date(epoch * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function HistoryChart({ deviceMac }: { deviceMac: string }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [raw, setRaw] = useState<HistoryEntry[]>([])
  const [rangeIdx, setRangeIdx] = useState(2)
  const [loading, setLoading] = useState(true)
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    temperature: true,
    soilRaw: true,
    pressure: true,
    humidity: true,
  })

  useEffect(() => {
    if (!deviceMac) return
    setLoading(true)
    const histRef = query(
      ref(firebaseDb, `devices/${deviceMac}/history`),
      orderByKey(),
      limitToLast(288),
    )
    const unsub = onValue(histRef, (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') {
        setRaw([])
        setLoading(false)
        return
      }
      const entries: HistoryEntry[] = Object.entries(val as Record<string, Record<string, unknown>>)
        .map(([key, v]) => ({
          time: Number(key),
          temperature: typeof v.t === 'number' ? v.t : null,
          soilRaw: typeof v.s === 'number' ? v.s : 0,
          pressure: typeof v.p === 'number' ? Math.round(v.p / 100 * 10) / 10 : null,
          humidity: typeof v.h === 'number' ? v.h : null,
        }))
        .sort((a, b) => a.time - b.time)
      setRaw(entries)
      setLoading(false)
    })
    return () => unsub()
  }, [deviceMac])

  const hours = RANGES[rangeIdx].hours
  const data = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600
    return raw.filter((e) => e.time >= cutoff)
  }, [raw, hours])

  const hasPressure = raw.some((e) => e.pressure != null)
  const hasHumidity = raw.some((e) => e.humidity != null)

  const availableSeries: SeriesKey[] = useMemo(() => {
    const s: SeriesKey[] = ['temperature', 'soilRaw']
    if (hasPressure) s.push('pressure')
    if (hasHumidity) s.push('humidity')
    return s
  }, [hasPressure, hasHumidity])

  function toggleSeries(key: SeriesKey) {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="section-card mt-3">
        <p className="stat-label mb-3">Readings history</p>
        <div className="h-48 space-y-3 overflow-hidden">
          {[72, 88, 60, 80, 56].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded-md bg-forest/[0.04]"
              style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (raw.length === 0) {
    return (
      <div className="section-card mt-3">
        <p className="stat-label mb-3">Readings history</p>
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-forest/35 text-center px-4">
            No history data yet. The device records a snapshot every ~5 minutes.
          </p>
        </div>
      </div>
    )
  }

  const showPressureAxis = hasPressure && visibleSeries.pressure

  return (
    <div className="section-card mt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="stat-label">Readings history</p>
        <div className="flex gap-0.5 rounded-xl bg-surface p-1 shadow-inner dark:bg-forest-800/50">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                i === rangeIdx
                  ? 'bg-white text-forest shadow-soft dark:bg-forest-700 dark:text-forest-100'
                  : 'text-forest/35 hover:text-forest/60 dark:text-forest-500 dark:hover:text-forest-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series toggles */}
      {availableSeries.length > 2 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {availableSeries.map((key) => {
            const meta = SERIES_META[key]
            const active = visibleSeries[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSeries(key)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-forest/10 bg-white text-forest shadow-soft dark:border-forest/20 dark:bg-forest-700 dark:text-forest-100'
                    : 'border-transparent text-forest/30 hover:text-forest/50 dark:text-forest-500 dark:hover:text-forest-400'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full transition-colors"
                  style={{ backgroundColor: active ? meta.color : 'rgba(20,51,42,0.15)' }}
                />
                {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-forest/40">No data in the last {hours} hours.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: showPressureAxis ? 60 : 12, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.2)' : 'rgba(20,51,42,0.06)'} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: isDark ? 'rgba(203,213,225,0.9)' : 'rgba(20,51,42,0.4)' }}
              axisLine={{ stroke: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(20,51,42,0.08)' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              yAxisId="temp"
              orientation="left"
              tick={{ fontSize: 11, fill: isDark ? 'rgba(203,213,225,0.9)' : 'rgba(20,51,42,0.4)' }}
              axisLine={false}
              tickLine={false}
              width={40}
              label={{ value: '°C', position: 'insideTopLeft', offset: 0, style: { fontSize: 10, fill: isDark ? 'rgba(203,213,225,0.8)' : 'rgba(20,51,42,0.35)' } }}
            />
            <YAxis
              yAxisId="soil"
              orientation="right"
              tick={{ fontSize: 11, fill: isDark ? 'rgba(203,213,225,0.9)' : 'rgba(20,51,42,0.4)' }}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{ value: 'Soil raw', position: 'insideTopRight', offset: 0, style: { fontSize: 10, fill: isDark ? 'rgba(203,213,225,0.8)' : 'rgba(20,51,42,0.35)' } }}
            />
            {showPressureAxis && (
              <YAxis
                yAxisId="pressure"
                orientation="right"
                tick={{ fontSize: 10, fill: isDark ? 'rgba(129,140,248,0.9)' : 'rgba(99,102,241,0.5)' }}
                axisLine={false}
                tickLine={false}
                width={50}
                domain={['dataMin - 2', 'dataMax + 2']}
                label={{ value: 'hPa', position: 'insideTopRight', offset: 8, style: { fontSize: 10, fill: isDark ? 'rgba(129,140,248,0.85)' : 'rgba(99,102,241,0.45)' } }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: isDark ? 'rgba(30,41,59,0.98)' : 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: isDark ? '1px solid rgba(71,85,105,0.5)' : '1px solid rgba(27,47,39,0.07)',
                borderRadius: 14,
                fontSize: 12,
                color: isDark ? '#e2e8e5' : undefined,
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(27,47,39,0.08), 0 1px 3px rgba(27,47,39,0.04)',
              }}
              labelFormatter={(v) => formatTime(v as number)}
              formatter={(value?: number | string, name?: string) => {
                const meta = name ? SERIES_META[name as SeriesKey] : undefined
                if (!meta) return [value ?? '—', name ?? '']
                const n = typeof value === 'number' ? value : null
                const formatted = n != null ? `${name === 'soilRaw' ? n : n.toFixed(1)}${meta.unit}` : '—'
                return [formatted, meta.label]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v: string) => SERIES_META[v as SeriesKey]?.label ?? v}
              iconType="circle"
              iconSize={8}
              style={isDark ? { color: 'rgba(203,213,225,0.9)' } : undefined}
            />

            {visibleSeries.temperature && (
              <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#F59E0B' }} connectNulls />
            )}
            {visibleSeries.soilRaw && (
              <Line yAxisId="soil" type="monotone" dataKey="soilRaw" stroke="#3B7A57" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#3B7A57' }} />
            )}
            {hasPressure && visibleSeries.pressure && (
              <Line yAxisId="pressure" type="monotone" dataKey="pressure" stroke="#6366F1" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#6366F1' }} connectNulls />
            )}
            {hasHumidity && visibleSeries.humidity && (
              <Line yAxisId="temp" type="monotone" dataKey="humidity" stroke="#06B6D4" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#06B6D4' }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
