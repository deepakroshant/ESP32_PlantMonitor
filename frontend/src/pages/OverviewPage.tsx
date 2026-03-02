import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ref, query, orderByKey, limitToLast, onValue } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getDeviceStatus, STATUS_META } from '../utils/deviceStatus'
import type { Readings, DeviceMeta, DeviceStatus } from '../types'
import { LogoutIcon } from '../components/icons/LogoutIcon'
import { PlantIcon } from '../components/icons/PlantIcon'
import { ThemeToggleIcon } from '../components/icons/ThemeToggleIcon'
import { RotatingText } from '../components/ui/rotating-text'
import ScrollStack, { ScrollStackItem } from '../components/ui/ScrollStack'

const STORAGE_KEY = 'smart-plant-selected-device'

function deviceLabel(mac: string, meta?: DeviceMeta): string {
  if (meta?.name?.trim()) return meta.name
  if (meta?.room?.trim()) return meta.room
  return mac
}

function formatWateredAgo(epoch: number): string {
  const d = Math.floor(Date.now() / 1000) - epoch
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

type DeviceData = {
  readings: Readings | null
  lastWateredEpoch: number | null
  lastAlert: { message: string } | null
}

export function OverviewPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [myDevices, setMyDevices] = useState<string[]>([])
  const [devicesMeta, setDevicesMeta] = useState<Record<string, DeviceMeta>>({})
  const [deviceData, setDeviceData] = useState<Record<string, DeviceData>>({})
  const [resetRequestedAt, setResetRequestedAt] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem('spp_reset_at')
    const ts = raw ? parseInt(raw, 10) : 0
    if (ts > 0 && Math.floor(Date.now() / 1000) - ts > 300) {
      localStorage.removeItem('spp_reset_at')
      setResetRequestedAt(0)
    } else {
      setResetRequestedAt(ts)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    return onValue(ref(firebaseDb, `users/${user.uid}/devices`), (snap) => {
      const val = snap.val()
      const list = val ? (Object.keys(val) as string[]) : []
      setMyDevices(list)
      const meta: Record<string, DeviceMeta> = {}
      if (val && typeof val === 'object') {
        for (const mac of list) {
          const d = (val as Record<string, { meta?: { name?: string; room?: string } }>)[mac]
          if (d?.meta && typeof d.meta === 'object') {
            meta[mac] = { name: d.meta.name, room: d.meta.room }
          }
        }
      }
      setDevicesMeta(meta)
    })
  }, [user])

  useEffect(() => {
    if (!user || myDevices.length === 0) return
    const unsubs: (() => void)[] = []

    for (const mac of myDevices) {
      unsubs.push(
        onValue(ref(firebaseDb, `devices/${mac}/readings`), (snap) => {
          setDeviceData((prev) => ({
            ...prev,
            [mac]: { ...prev[mac], readings: snap.val() ?? null },
          }))
        })
      )
      const waterLogRef = ref(firebaseDb, `devices/${mac}/waterLog`)
      const waterLogQuery = query(waterLogRef, orderByKey(), limitToLast(1))
      unsubs.push(
        onValue(waterLogQuery, (snap) => {
          const val = snap.val()
          let epoch: number | null = null
          if (val && typeof val === 'object') {
            const keys = Object.keys(val)
            if (keys.length) {
              epoch = parseInt(keys[keys.length - 1], 10)
            }
          }
          setDeviceData((prev) => ({
            ...prev,
            [mac]: { ...prev[mac], lastWateredEpoch: epoch },
          }))
        })
      )
      unsubs.push(
        onValue(ref(firebaseDb, `devices/${mac}/alerts/lastAlert`), (snap) => {
          const val = snap.val()
          if (val && typeof val === 'object') {
            const o = val as Record<string, unknown>
            setDeviceData((prev) => ({
              ...prev,
              [mac]: {
                ...prev[mac],
                lastAlert: { message: typeof o.message === 'string' ? o.message : '—' },
              },
            }))
          } else {
            setDeviceData((prev) => ({
              ...prev,
              [mac]: { ...prev[mac], lastAlert: null },
            }))
          }
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [user, myDevices])

  function goToDevice(mac: string) {
    localStorage.setItem(STORAGE_KEY, mac)
    navigate('/')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50 to-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-forest/10 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <h1 className="font-display text-lg font-bold text-forest sm:text-xl">All Plants</h1>
        <div className="flex items-center gap-2">
          <ThemeToggleIcon compact />
          <Link
            to="/"
            className="rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm font-medium text-forest transition hover:bg-sage-50 dark:border-forest/20 dark:bg-forest/5 dark:text-forest"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-xl border border-forest/15 bg-white p-2 text-forest/60 transition hover:bg-sage-50 hover:text-forest"
            aria-label="Log out"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 sm:py-8">
        {myDevices.length === 0 ? (
          <div className="rounded-2xl border border-forest/10 bg-white p-8 text-center dark:border-forest-700 dark:bg-forest-800/80">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <PlantIcon className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 font-display text-xl font-bold text-forest dark:text-forest-100">
              <RotatingText
                words={["Ready", "Set", "Let's"]}
                mode="slide"
                interval={2000}
                className="text-primary"
              />{" "}
              get started
            </h2>
            <p className="mb-6 text-forest/60 dark:text-forest-400">
              No devices yet. Claim one to begin{" "}
              <RotatingText
                words={["monitoring", "tracking", "caring"]}
                mode="fade"
                interval={2500}
                className="font-medium text-primary"
              />{" "}
              your plants.
            </p>
            <Link
              to="/claim"
              className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Claim device
            </Link>
          </div>
        ) : (
          <div className="h-[calc(100vh-120px)] overflow-hidden rounded-2xl">
            <ScrollStack
              className="h-full"
              itemDistance={120}
              itemScale={0.04}
              itemStackDistance={40}
              stackPosition="15%"
              scaleEndPosition="5%"
              baseScale={0.88}
              rotationAmount={2}
              blurAmount={1.5}
              useWindowScroll={false}
            >
              {myDevices.map((mac) => {
                const data = deviceData[mac] ?? { readings: null, lastWateredEpoch: null, lastAlert: null }
                const status = getDeviceStatus(
                  data.readings,
                  Math.floor(Date.now() / 1000),
                  resetRequestedAt
                ) as DeviceStatus
                const meta = STATUS_META[status]
                const soil = data.readings?.soilRaw != null ? String(data.readings.soilRaw) : '—'
                const temp = data.readings?.temperature != null ? `${data.readings.temperature.toFixed(1)}°C` : '—'

                return (
                  <ScrollStackItem
                    key={mac}
                    itemClassName="bg-white dark:bg-forest-800/90 border-2 border-forest/10 dark:border-forest-700 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  >
                    <button
                      type="button"
                      onClick={() => goToDevice(mac)}
                      className="w-full text-left"
                    >
                      {data.lastAlert && (
                        <span className="absolute right-6 top-6 rounded-full bg-terracotta/20 px-3 py-1 text-xs font-semibold text-terracotta backdrop-blur-sm">
                          Alert
                        </span>
                      )}
                      <div className="flex items-start gap-4 mb-6">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 shadow-glow ring-2 ring-primary/10">
                          <PlantIcon className="h-8 w-8 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-2xl font-bold text-forest dark:text-forest-100 mb-2">
                            {deviceLabel(mac, devicesMeta[mac])}
                          </h2>
                          <span
                            className={`inline-flex items-center gap-2 text-sm font-medium ${meta.color}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${meta.dotColor} ${meta.pulse ? 'animate-pulse' : ''}`}
                            />
                            {meta.label}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-forest/10 dark:border-forest-700">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-forest/40 dark:text-forest-500">Soil</p>
                          <p className="text-xl font-mono font-bold text-forest dark:text-forest-100">{soil}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-forest/40 dark:text-forest-500">Temperature</p>
                          <p className="text-xl font-mono font-bold text-forest dark:text-forest-100">{temp}</p>
                        </div>
                        {data.lastWateredEpoch != null && data.lastWateredEpoch > 0 && (
                          <div className="col-span-2 pt-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-forest/40 dark:text-forest-500 mb-1">Last Watered</p>
                            <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
                              {formatWateredAgo(data.lastWateredEpoch)}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  </ScrollStackItem>
                )
              })}
            </ScrollStack>
          </div>
        )}
      </main>
    </div>
  )
}
