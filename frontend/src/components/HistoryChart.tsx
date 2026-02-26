import { useEffect, useState, useMemo } from 'react'
import { ref, query, orderByKey, limitToLast, onValue } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
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

type HistoryEntry = { time: number; temperature: number | null; soilRaw: number }

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
  const [raw, setRaw] = useState<HistoryEntry[]>([])
  const [rangeIdx, setRangeIdx] = useState(2) // default 24 h
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="section-card mt-6">
        <p className="stat-label mb-3">Readings history</p>
        <div className="flex h-48 items-center justify-center">
          <span className="text-sm text-forest/40">Loading history…</span>
        </div>
      </div>
    )
  }

  if (raw.length === 0) {
    return (
      <div className="section-card mt-6">
        <p className="stat-label mb-3">Readings history</p>
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-forest/40">
            No history data yet. The device records a snapshot every ~5 minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="section-card mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="stat-label">Readings history</p>
        <div className="flex gap-1 rounded-xl bg-surface p-0.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                i === rangeIdx
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-forest/40 hover:text-forest/70'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-forest/40">No data in the last {hours} hours.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,51,42,0.06)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: 'rgba(20,51,42,0.4)' }}
              axisLine={{ stroke: 'rgba(20,51,42,0.08)' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              yAxisId="temp"
              orientation="left"
              tick={{ fontSize: 11, fill: 'rgba(20,51,42,0.4)' }}
              axisLine={false}
              tickLine={false}
              width={40}
              label={{ value: '°C', position: 'insideTopLeft', offset: 0, style: { fontSize: 10, fill: 'rgba(20,51,42,0.35)' } }}
            />
            <YAxis
              yAxisId="soil"
              orientation="right"
              tick={{ fontSize: 11, fill: 'rgba(20,51,42,0.4)' }}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{ value: 'Soil raw', position: 'insideTopRight', offset: 0, style: { fontSize: 10, fill: 'rgba(20,51,42,0.35)' } }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(20,51,42,0.08)',
                borderRadius: 12,
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(20,51,42,0.06)',
              }}
              labelFormatter={(v) => formatTime(v as number)}
              formatter={(value?: number, name?: string) => [
                value != null
                  ? name === 'temperature' ? `${value.toFixed(1)}°C` : String(value)
                  : '—',
                name === 'temperature' ? 'Temperature' : 'Soil raw',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v: string) => (v === 'temperature' ? 'Temperature' : 'Soil raw')}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#F59E0B' }}
              connectNulls
            />
            <Line
              yAxisId="soil"
              type="monotone"
              dataKey="soilRaw"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#22C55E' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
