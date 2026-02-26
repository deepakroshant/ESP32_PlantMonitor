import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, animate } from 'framer-motion'
import { ref, onValue, set, push, remove } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { soilStatus, soilStatusLabel, soilRawToGaugeCalibrated } from '../utils/soil'
import { CircularGauge } from '../components/CircularGauge'
import { LogoutIcon } from '../components/icons/LogoutIcon'
import { PlusIcon } from '../components/icons/PlusIcon'
import { PlantIcon } from '../components/icons/PlantIcon'
import { ThermometerIcon } from '../components/icons/ThermometerIcon'
import { SunIcon } from '../components/icons/SunIcon'
import { PencilIcon } from '../components/icons/PencilIcon'
import { HistoryChart } from '../components/HistoryChart'

type Readings = {
  temperature?: number
  soilRaw?: number
  lightBright?: boolean
  pumpRunning?: boolean
  health?: string
  timestamp?: number
  wifiSSID?: string
  wifiRSSI?: number
}

type PlantProfile = { name: string; type: string; createdAt: number }

/** Example plants: category label + target soil moisture (raw) for the device */
const EXAMPLE_PLANTS = [
  { id: 'mint', label: 'Mint', targetSoil: 2000 },
  { id: 'sunflower', label: 'Sunflower (flower)', targetSoil: 2400 },
  { id: 'herb', label: 'Herb / Spice', targetSoil: 2200 },
  { id: 'succulent', label: 'Succulent', targetSoil: 1800 },
  { id: 'tomato', label: 'Tomato', targetSoil: 2600 },
] as const

const STORAGE_KEY = 'smart-plant-selected-device'

// ---------------------------------------------------------------------------
// Centralized device status state machine
// ---------------------------------------------------------------------------
type DeviceStatus = 'live' | 'delayed' | 'offline' | 'syncing' | 'wifi_connected' | 'no_data'

function getDeviceStatus(
  readings: Readings | null,
  nowSec: number,
  resetRequestedAt: number,
): DeviceStatus {
  // Reset flow active but readings wiped
  if (!readings && resetRequestedAt > 0) return 'syncing'
  // Never received any data
  if (!readings) return 'no_data'

  const ts = readings.timestamp ?? 0
  const tsValid = ts > 1577836800

  // Reset flow: check post-reset conditions
  if (resetRequestedAt > 0) {
    const isPostReset = tsValid && ts > resetRequestedAt
    if (!isPostReset) return 'syncing'
    if (!readings.wifiSSID) return 'syncing'
    const hasSensors = readings.temperature != null && !Number.isNaN(readings.temperature)
    if (!hasSensors) return 'wifi_connected'
    // All post-reset data arrived → fall through to normal states
  }

  if (!tsValid) return 'no_data'

  const secondsAgo = nowSec - ts
  if (secondsAgo <= 15) return 'live'
  if (secondsAgo <= 35) return 'delayed'
  return 'offline'
}

const STATUS_META: Record<DeviceStatus, {
  color: string; bg: string; border: string; label: string; pulse: boolean
  dotColor: string
}> = {
  live:           { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200/60',  label: 'Live',           pulse: true,  dotColor: 'bg-green-500' },
  delayed:        { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'Delayed',        pulse: false, dotColor: 'bg-amber-500' },
  offline:        { color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200/60',    label: 'Offline',        pulse: false, dotColor: 'bg-red-500' },
  syncing:        { color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200/60',   label: 'Syncing',        pulse: true,  dotColor: 'bg-blue-500' },
  wifi_connected: { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200/60',  label: 'WiFi Connected', pulse: true,  dotColor: 'bg-amber-500' },
  no_data:        { color: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-200/60',   label: 'No Data',        pulse: false, dotColor: 'bg-gray-400' },
}

function formatSecondsAgo(sec: number, tsValid: boolean): string {
  if (!tsValid) return 'never'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`
  return `${Math.floor(sec / 86400)} d ago`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DashboardPage() {
  const { user, signOut } = useAuth()
  const [myDevices, setMyDevices] = useState<string[]>([])
  const [selectedMac, setSelectedMac] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  })
  const [readings, setReadings] = useState<Readings | null>(null)
  const [targetSoil, setTargetSoil] = useState<number>(2800)
  const [targetSoilInput, setTargetSoilInput] = useState('2800')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedList, setInvitedList] = useState<string[]>([])
  const [copyOk, setCopyOk] = useState(false)
  const [displayTemp, setDisplayTemp] = useState(0)
  const [displayGaugePct, setDisplayGaugePct] = useState(0)
  const [profiles, setProfiles] = useState<Record<string, PlantProfile>>({})
  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', type: '' })
  const [editPresetId, setEditPresetId] = useState<string | null>(null)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileType, setNewProfileType] = useState('')
  const [newProfilePresetId, setNewProfilePresetId] = useState<string | null>(null)
  const [resetRequestedAt, setResetRequestedAt] = useState(0)
  const [showSyncedBanner, setShowSyncedBanner] = useState(false)
  const [calibration, setCalibration] = useState<{ boneDry: number | null; submerged: number | null }>({ boneDry: null, submerged: null })
  const [lastAlert, setLastAlert] = useState<{ timestamp: number; type: string; message: string } | null>(null)
  const [pumpActive, setPumpActive] = useState(false)
  const [pumpCooldown, setPumpCooldown] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('notif_enabled') === 'true'
  )
  const lastNotifiedAtRef = useRef(0)
  const prevStatusRef = useRef<DeviceStatus>('no_data')
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ── Firebase listeners (unchanged) ──

  useEffect(() => {
    if (!user) return
    const userDevicesRef = ref(firebaseDb, `users/${user.uid}/devices`)
    const unsub = onValue(userDevicesRef, (snap) => {
      const val = snap.val()
      const list = val ? Object.keys(val) as string[] : []
      setMyDevices(list)
      if (list.length && !list.includes(selectedMac)) {
        const next = list[0]
        setSelectedMac(next)
        localStorage.setItem(STORAGE_KEY, next)
      }
    })
    return () => unsub()
  }, [user, selectedMac])

  useEffect(() => {
    if (!user) return
    const profilesRef = ref(firebaseDb, `users/${user.uid}/plantProfiles`)
    const unsub = onValue(profilesRef, (snap) => {
      const val = snap.val()
      setProfiles((val && typeof val === 'object') ? val as Record<string, PlantProfile> : {})
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (!user || !selectedMac) { setLinkedProfileId(null); return }
    const devicePlantRef = ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`)
    const unsub = onValue(devicePlantRef, (snap) => {
      const id = snap.val()
      setLinkedProfileId(typeof id === 'string' ? id : null)
    })
    return () => unsub()
  }, [user, selectedMac])

  useEffect(() => {
    if (!selectedMac) { setReadings(null); return }
    const readingsRef = ref(firebaseDb, `devices/${selectedMac}/readings`)
    const unsub = onValue(readingsRef, (snap) => {
      setReadings(snap.val() ?? null)
    })
    return () => unsub()
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) return
    const controlRef = ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`)
    const unsub = onValue(controlRef, (snap) => {
      const v = snap.val()
      if (typeof v === 'number' && v >= 0) {
        setTargetSoil(v)
        setTargetSoilInput(String(v))
      }
    })
    return () => unsub()
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setCalibration({ boneDry: null, submerged: null }); return }
    const calRef = ref(firebaseDb, `devices/${selectedMac}/calibration`)
    const unsub = onValue(calRef, (snap) => {
      const val = snap.val()
      if (val && typeof val === 'object') {
        const o = val as Record<string, unknown>
        setCalibration({
          boneDry: typeof o.boneDry === 'number' ? o.boneDry : null,
          submerged: typeof o.submerged === 'number' ? o.submerged : null,
        })
      } else {
        setCalibration({ boneDry: null, submerged: null })
      }
    })
    return () => unsub()
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setLastAlert(null); return }
    const alertRef = ref(firebaseDb, `devices/${selectedMac}/alerts/lastAlert`)
    const unsub = onValue(alertRef, (snap) => {
      const val = snap.val()
      if (val && typeof val === 'object') {
        const o = val as Record<string, unknown>
        setLastAlert({
          timestamp: typeof o.timestamp === 'number' ? o.timestamp : 0,
          type: typeof o.type === 'string' ? o.type : 'alert',
          message: typeof o.message === 'string' ? o.message : '—',
        })
      } else {
        setLastAlert(null)
      }
    })
    return () => unsub()
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setPumpActive(false); return }
    const pumpRef = ref(firebaseDb, `devices/${selectedMac}/readings/pumpRunning`)
    const unsub = onValue(pumpRef, (snap) => setPumpActive(snap.val() === true))
    return () => unsub()
  }, [selectedMac])

  useEffect(() => {
    if (!user) return
    const invitesRef = ref(firebaseDb, `users/${user.uid}/invites`)
    const unsub = onValue(invitesRef, (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') { setInvitedList([]); return }
      const emails = (Object.values(val) as { email?: string }[])
        .map((v) => v.email)
        .filter((e): e is string => typeof e === 'string')
      setInvitedList(emails)
    })
    return () => unsub()
  }, [user])

  // ── Handlers ──

  function handleSaveTarget() {
    const n = parseInt(targetSoilInput, 10)
    if (isNaN(n) || n < 0) return
    set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), n).catch(console.error)
    setTargetSoil(n)
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(appUrl)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    } catch { setCopyOk(false) }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !user) return
    const key = email.replace(/[.#$[\]]/g, '_')
    await set(ref(firebaseDb, `users/${user.uid}/invites/${key}`), { email, at: Date.now() }).catch(console.error)
    setInviteEmail('')
  }

  function openEditPlant(profileId: string | null) {
    setEditPresetId(null)
    if (profileId && profiles[profileId]) {
      setEditingProfileId(profileId)
      setEditForm({ name: profiles[profileId].name, type: profiles[profileId].type })
    } else {
      setEditingProfileId(null)
      setEditForm({ name: '', type: '' })
    }
    setEditModalOpen(true)
  }

  function closeEditPlant() {
    setEditModalOpen(false)
    setEditingProfileId(null)
    setEditForm({ name: '', type: '' })
    setEditPresetId(null)
  }

  async function saveEditPlant(andLinkToDevice: boolean) {
    const name = editForm.name.trim()
    const type = editForm.type.trim()
    if (!name || !user) return
    const now = Date.now()
    if (editingProfileId) {
      await set(ref(firebaseDb, `users/${user.uid}/plantProfiles/${editingProfileId}`), {
        name, type: type || '—', createdAt: profiles[editingProfileId]?.createdAt ?? now,
      }).catch(console.error)
      if (selectedMac && editPresetId) {
        const preset = EXAMPLE_PLANTS.find((p) => p.id === editPresetId)
        if (preset) {
          await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error)
          setTargetSoil(preset.targetSoil)
          setTargetSoilInput(String(preset.targetSoil))
        }
      }
    } else {
      const newRef = push(ref(firebaseDb, `users/${user.uid}/plantProfiles`))
      const id = newRef.key
      if (!id) return
      await set(newRef, { name, type: type || '—', createdAt: now }).catch(console.error)
      if (andLinkToDevice && selectedMac) {
        await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), id).catch(console.error)
        if (editPresetId) {
          const preset = EXAMPLE_PLANTS.find((p) => p.id === editPresetId)
          if (preset) {
            await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error)
            setTargetSoil(preset.targetSoil)
            setTargetSoilInput(String(preset.targetSoil))
          }
        }
      }
    }
    closeEditPlant()
  }

  async function linkProfileToDevice(profileId: string) {
    if (!user || !selectedMac) return
    await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), profileId).catch(console.error)
  }

  async function deleteProfile(profileId: string) {
    if (!user) return
    await remove(ref(firebaseDb, `users/${user.uid}/plantProfiles/${profileId}`)).catch(console.error)
    if (linkedProfileId === profileId && selectedMac) {
      await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), null).catch(console.error)
    }
  }

  async function handleResetDeviceWiFi() {
    if (!selectedMac || resetRequestedAt > 0) return
    const now = Math.floor(Date.now() / 1000)
    await Promise.all([
      set(ref(firebaseDb, `devices/${selectedMac}/control/resetProvisioning`), true),
      set(ref(firebaseDb, `devices/${selectedMac}/readings`), null),
    ]).catch(console.error)
    setResetRequestedAt(now)
  }

  async function handleMarkDry() {
    if (!selectedMac || readings?.soilRaw == null) return
    await set(ref(firebaseDb, `devices/${selectedMac}/calibration/boneDry`), readings.soilRaw).catch(console.error)
  }

  async function handleMarkWet() {
    if (!selectedMac || readings?.soilRaw == null) return
    await set(ref(firebaseDb, `devices/${selectedMac}/calibration/submerged`), readings.soilRaw).catch(console.error)
  }

  async function handleTriggerPump() {
    if (!selectedMac || pumpCooldown) return
    await set(ref(firebaseDb, `devices/${selectedMac}/control/pumpRequest`), true).catch(console.error)
    setPumpCooldown(true)
    setTimeout(() => setPumpCooldown(false), 8000)
  }

  async function handleAckAlert() {
    if (!selectedMac) return
    await set(ref(firebaseDb, `devices/${selectedMac}/alerts/lastAlert/ackAt`), Math.floor(Date.now() / 1000)).catch(console.error)
    setLastAlert(null)
  }

  async function handleToggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false)
      localStorage.setItem('notif_enabled', 'false')
      return
    }
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotificationsEnabled(true)
      localStorage.setItem('notif_enabled', 'true')
    }
  }

  useEffect(() => {
    if (!notificationsEnabled || !lastAlert) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (lastAlert.timestamp <= lastNotifiedAtRef.current) return
    lastNotifiedAtRef.current = lastAlert.timestamp
    new Notification('Smart Plant Pro', { body: lastAlert.message, icon: '/plant-icon.svg' })
  }, [lastAlert, notificationsEnabled])

  async function addNewProfile(e: React.FormEvent) {
    e.preventDefault()
    const name = newProfileName.trim()
    const type = newProfileType.trim()
    if (!name || !user) return
    const newRef = push(ref(firebaseDb, `users/${user.uid}/plantProfiles`))
    const id = newRef.key
    if (!id) return
    await set(newRef, { name, type: type || '—', createdAt: Date.now() }).catch(console.error)
    if (newProfilePresetId && selectedMac) {
      const preset = EXAMPLE_PLANTS.find((p) => p.id === newProfilePresetId)
      if (preset) {
        await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error)
        setTargetSoil(preset.targetSoil)
        setTargetSoilInput(String(preset.targetSoil))
      }
    }
    setNewProfileName('')
    setNewProfileType('')
    setNewProfilePresetId(null)
  }

  // ── Derived values + sensor animations ──

  const currentPlant = linkedProfileId ? profiles[linkedProfileId] : null
  const soil = readings?.soilRaw != null ? soilStatus(readings.soilRaw) : null
  const soilLabel = soil != null ? soilStatusLabel(soil) : '—'
  const gaugePct = readings?.soilRaw != null
    ? soilRawToGaugeCalibrated(readings.soilRaw, calibration.boneDry, calibration.submerged) * 100
    : 0
  const temp = readings?.temperature

  useEffect(() => {
    const to = temp != null && !Number.isNaN(temp) ? temp : 0
    const controls = animate(displayTemp, to, { duration: 0.6, onUpdate: (v) => setDisplayTemp(v) })
    return () => controls.stop()
  }, [temp])

  useEffect(() => {
    const controls = animate(displayGaugePct, gaugePct, { duration: 0.7, onUpdate: (v) => setDisplayGaugePct(v) })
    return () => controls.stop()
  }, [gaugePct])

  // Tick every 2s for live "last seen" counter
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 2000)
    return () => clearInterval(id)
  }, [])

  // ── CENTRALIZED STATUS ──
  const deviceStatus = getDeviceStatus(readings, nowSec, resetRequestedAt)
  const meta = STATUS_META[deviceStatus]

  // Auto-clear reset flow + show "synced" banner on recovery
  useEffect(() => {
    if (resetRequestedAt > 0 && deviceStatus === 'live') {
      setShowSyncedBanner(true)
      const timer = setTimeout(() => {
        setResetRequestedAt(0)
        setShowSyncedBanner(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [deviceStatus, resetRequestedAt])

  useEffect(() => { prevStatusRef.current = deviceStatus }, [deviceStatus])

  // Convenience flags derived from the single status enum
  const isResetGuide = resetRequestedAt > 0 && deviceStatus === 'syncing'
  const dataUntrusted = deviceStatus === 'offline' || deviceStatus === 'syncing'
    || deviceStatus === 'wifi_connected' || deviceStatus === 'no_data'
  const isDelayed = deviceStatus === 'delayed'
  const healthOk = (readings?.health ?? '').toLowerCase() === 'ok'

  const lastSeenSec = readings?.timestamp ?? 0
  const tsValid = lastSeenSec > 1577836800
  const secondsAgo = tsValid ? nowSec - lastSeenSec : Infinity
  const lastSeenLabel = formatSecondsAgo(secondsAgo, tsValid)
  const lastUpdated = readings?.timestamp != null && tsValid
    ? new Date(readings.timestamp * 1000).toLocaleTimeString()
    : null
  const showProTip = temp != null && !Number.isNaN(temp) && temp > 28

  const statusDescription: Record<DeviceStatus, string> = {
    live:           `Receiving data — updated ${lastSeenLabel}`,
    delayed:        `Last data ${lastSeenLabel} — device may be slow to respond`,
    offline:        `Last seen ${lastSeenLabel} — device is not sending data`,
    syncing:        resetRequestedAt > 0 ? 'Device is restarting into setup mode…' : 'Waiting for sensor data…',
    wifi_connected: 'Connected to WiFi — waiting for sensor data…',
    no_data:        'This device has never sent readings',
  }

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-surface p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/60 px-4 py-3 shadow-card backdrop-blur-sm sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-600 shadow-sm">
              <PlantIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="font-display text-lg font-bold tracking-tight text-forest sm:text-xl">
              Smart Plant Pro
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden items-center gap-2 rounded-xl bg-surface px-3 py-1.5 sm:flex">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate text-xs text-forest/60">
                  {user.displayName || user.email || 'Account'}
                </span>
              </div>
            )}
            <Link to="/claim" className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-xs">
              <PlusIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add device</span>
            </Link>
            <button onClick={() => signOut()} className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-xs text-forest/50 hover:text-red-500">
              <LogoutIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {myDevices.length === 0 ? (
          <div className="section-card flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-glow">
              <PlusIcon className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-2 font-display text-lg font-semibold text-forest">No devices yet</p>
            <p className="mb-6 text-sm text-forest/45">Add your first plant monitor to get started.</p>
            <Link to="/claim" className="btn-primary">Add a device</Link>
          </div>
        ) : (
          <>
            {/* ── Device selector + status card ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 rounded-3xl border ${meta.border} ${meta.bg} p-4 transition-colors duration-500 sm:p-5`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMac}
                    onChange={(e) => { setSelectedMac(e.target.value); localStorage.setItem(STORAGE_KEY, e.target.value) }}
                    className="rounded-xl border border-forest/10 bg-white/80 px-3 py-2 font-mono text-xs text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                  >
                    {myDevices.map((mac) => <option key={mac} value={mac}>{mac}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleResetDeviceWiFi}
                    disabled={resetRequestedAt > 0}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      resetRequestedAt > 0
                        ? 'cursor-not-allowed border-forest/10 bg-white/40 text-forest/30'
                        : 'border-red-200 bg-white/60 text-red-500 hover:bg-red-50'
                    }`}
                    title="Device will clear its WiFi config and restart in AP mode"
                  >
                    {resetRequestedAt > 0 ? 'Reset sent…' : 'Reset WiFi'}
                  </button>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {meta.pulse && (
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.dotColor.replace('bg-', 'bg-')}`} />
                    )}
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
                  </span>
                  <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className={`text-xs ${meta.color} opacity-80`}>{statusDescription[deviceStatus]}</p>
                {readings?.wifiSSID && (
                  <p className="text-xs text-forest/40">
                    {deviceStatus === 'live' ? 'WiFi: ' : 'Last WiFi: '}
                    <span className="font-medium text-forest/60">{readings.wifiSSID}</span>
                    {readings.wifiRSSI != null && deviceStatus === 'live' && (
                      <span className="ml-1">({readings.wifiRSSI} dBm)</span>
                    )}
                  </p>
                )}
                {lastUpdated && deviceStatus === 'live' && (
                  <p className="text-xs text-forest/35">Updated at {lastUpdated}</p>
                )}
              </div>
            </motion.div>

            {/* ── Reset WiFi guide (shown only during active syncing after reset) ── */}
            {isResetGuide && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[32px] bg-white p-6 shadow-card sm:p-8"
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-forest">Device WiFi reset</h2>
                    <p className="text-sm text-forest/60">Your device is restarting into setup mode</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-forest/70">
                  No data will appear here until the device reconnects to WiFi. Follow these steps:
                </p>
                <ol className="mb-6 space-y-4">
                  {[
                    { title: 'Wait ~10 seconds', desc: 'The device is clearing its WiFi config and restarting into AP mode.' },
                    { title: <>Connect to <span className="font-mono text-primary">SmartPlantPro</span> WiFi</>, desc: 'Open WiFi settings on your phone or laptop and connect to the SmartPlantPro network.' },
                    { title: 'Open the setup portal', desc: <>A captive portal should open automatically. If not, go to <strong className="font-mono">192.168.4.1</strong> in a browser.</> },
                    { title: 'Choose WiFi and save', desc: 'Select your WiFi network, enter the password. Hit Save.' },
                    { title: 'Reconnect to your own WiFi', desc: 'Switch back to your home WiFi. The dashboard will update automatically once the device connects.' },
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-forest">{step.title}</p>
                        <p className="text-xs text-forest/60">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                  </span>
                  <p className="text-sm text-forest/70">Waiting for device to reconnect…</p>
                </div>
                <button
                  type="button"
                  onClick={() => setResetRequestedAt(0)}
                  className="mt-4 rounded-2xl border border-forest/10 bg-white px-4 py-2 text-sm font-medium text-forest/60 transition hover:bg-mint/30 hover:text-forest"
                >
                  Dismiss and show dashboard
                </button>
              </motion.div>
            )}

            {/* ── Main dashboard content (hidden during reset guide) ── */}
            {!isResetGuide && (<>

            {/* Sync complete banner */}
            {showSyncedBanner && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3"
              >
                <svg className="h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <p className="text-sm font-medium text-primary">Sync complete — live data is now showing</p>
              </motion.div>
            )}

            {/* WiFi connected, waiting for sensors */}
            {deviceStatus === 'wifi_connected' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-5 py-4"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-forest">Connected to WiFi — syncing sensor data…</p>
                  <p className="text-xs text-forest/60">The device is online. Waiting for fresh sensor readings…</p>
                </div>
              </motion.div>
            )}

            {/* Delayed warning */}
            {deviceStatus === 'delayed' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3"
              >
                <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <p className="text-xs text-amber-700">Data may be slightly outdated — last update was {lastSeenLabel}</p>
              </motion.div>
            )}

            {/* Offline banner */}
            {deviceStatus === 'offline' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-red-600">Device appears offline</p>
                    <p className="mt-0.5 text-xs text-red-500/70">Last seen {lastSeenLabel}. The values below are frozen from the last known reading.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-red-100/80 px-2 py-0.5 text-[10px] font-medium text-red-600">Check power supply</span>
                      <span className="rounded-md bg-red-100/80 px-2 py-0.5 text-[10px] font-medium text-red-600">Check WiFi range</span>
                      <span className="rounded-md bg-red-100/80 px-2 py-0.5 text-[10px] font-medium text-red-600">Try resetting WiFi</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Hero: plant name + health ── */}
            <motion.div
              key={selectedMac}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="section-card mb-6 flex items-center gap-4 !p-4 sm:gap-5 sm:!p-5"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-500 sm:h-14 sm:w-14 ${
                dataUntrusted ? 'bg-forest/5' : 'bg-primary/10'
              }`}>
                <PlantIcon className={`h-6 w-6 transition-colors duration-500 sm:h-7 sm:w-7 ${dataUntrusted ? 'text-forest/30' : 'text-primary'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium sm:text-base transition-colors duration-300 ${dataUntrusted ? 'text-forest/50' : 'text-forest'}`}>
                    {currentPlant?.name ?? 'Your plant'}
                  </p>
                  <button type="button" onClick={() => openEditPlant(linkedProfileId)} className="rounded-full p-1 text-forest/50 transition hover:bg-mint/50 hover:text-forest" aria-label="Edit plant name and type">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-forest/50">
                  {currentPlant?.type || 'No plant type set'}
                  {deviceStatus === 'live' && <span className="ml-1.5 text-green-500">· Live</span>}
                  {deviceStatus === 'delayed' && <span className="ml-1.5 text-amber-500">· Delayed</span>}
                  {deviceStatus === 'offline' && <span className="ml-1.5 text-red-400">· Offline</span>}
                  {deviceStatus === 'wifi_connected' && <span className="ml-1.5 text-amber-500">· Syncing</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-forest/50 sm:text-xs">Health</p>
                {dataUntrusted ? (
                  <span className="inline-block rounded-full border-2 border-forest/10 bg-forest/5 px-4 py-2 text-sm font-semibold text-forest/30 sm:px-5 sm:py-2.5 sm:text-base">
                    {deviceStatus === 'wifi_connected' || deviceStatus === 'syncing' ? '…' : '—'}
                  </span>
                ) : isDelayed ? (
                  <span className="inline-block rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 sm:px-5 sm:py-2.5 sm:text-base">
                    {readings?.health ?? '?'}
                  </span>
                ) : (
                  <span className={`inline-block rounded-full border-2 px-4 py-2 text-sm font-semibold sm:px-5 sm:py-2.5 sm:text-base ${
                    healthOk ? 'border-primary/30 bg-primary/10 text-primary' : 'border-terracotta/30 bg-terracotta/10 text-terracotta'
                  }`}>
                    {readings?.health ?? '—'}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Alert + notification toggle */}
            <div className="mb-4 space-y-3">
              {lastAlert && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl border border-terracotta/20 bg-terracotta-light/60 px-4 py-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-terracotta/15">
                    <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.008" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-forest">{lastAlert.message}</p>
                    {lastAlert.timestamp > 0 && <p className="mt-0.5 text-xs text-forest/40">{new Date(lastAlert.timestamp * 1000).toLocaleString()}</p>}
                  </div>
                  <button type="button" onClick={handleAckAlert} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-terracotta transition hover:bg-terracotta/10">Dismiss</button>
                </motion.div>
              )}
              <div className="flex items-center gap-3 rounded-2xl border border-forest/5 bg-white/60 px-4 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-forest/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                <span className="flex-1 text-xs text-forest/60">
                  {'Notification' in window && Notification.permission === 'denied' ? 'Notifications blocked by browser' : 'Notify me when plant health drops'}
                </span>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  disabled={'Notification' in window && Notification.permission === 'denied'}
                  className={`relative h-6 w-11 rounded-full transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-forest/15'} disabled:cursor-not-allowed disabled:opacity-40`}
                  aria-label="Toggle browser notifications"
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* ── Sensor cards with frozen overlay ── */}
            <div className="relative">
              {dataUntrusted && (
                <div className="pointer-events-none absolute -inset-1 z-10 flex items-start justify-center rounded-3xl">
                  <div className="pointer-events-auto mt-20 rounded-2xl bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
                    <p className="text-center text-sm font-semibold text-forest/60">
                      {deviceStatus === 'syncing' || deviceStatus === 'wifi_connected' ? 'Waiting for sensor data…' : deviceStatus === 'no_data' ? 'No data yet' : 'Data frozen — device offline'}
                    </p>
                  </div>
                </div>
              )}
              <motion.div
                key={`gauges-${selectedMac}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: dataUntrusted ? 0.35 : isDelayed ? 0.7 : 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-500 ${
                  dataUntrusted ? 'pointer-events-none select-none blur-[1px] grayscale-[40%]' : isDelayed ? 'grayscale-[15%]' : ''
                }`}
              >
                <div className="section-card relative overflow-hidden">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><ThermometerIcon className="h-5 w-5 text-primary" /></div>
                  <p className="stat-label mb-1">Temperature</p>
                  <p className="font-display text-2xl font-bold tabular-nums text-forest">{temp != null && !Number.isNaN(temp) ? `${displayTemp.toFixed(1)}°C` : '—'}</p>
                  {deviceStatus === 'live' && <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />}
                </div>
                <div className="section-card relative overflow-hidden lg:col-span-2">
                  <p className="stat-label mb-4 text-center">Soil moisture</p>
                  <CircularGauge percentage={displayGaugePct} label={soilLabel} size={170} strokeWidth={10} />
                  {deviceStatus === 'live' && <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />}
                </div>
                <div className="section-card relative overflow-hidden">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><SunIcon className="h-5 w-5 text-primary" /></div>
                  <p className="stat-label mb-1">Light</p>
                  <p className="font-display text-xl font-bold text-forest">{readings?.lightBright === true ? 'Bright' : readings?.lightBright === false ? 'Dim' : '—'}</p>
                  {deviceStatus === 'live' && <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />}
                </div>
              </motion.div>
            </div>

            {/* History chart */}
            {selectedMac && !dataUntrusted && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}>
                <HistoryChart deviceMac={selectedMac} />
              </motion.div>
            )}

            {/* Pump control */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} className="mt-4 flex items-center gap-4 section-card !p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${pumpActive ? 'bg-primary/20' : 'bg-forest/5'}`}>
                <svg className={`h-5 w-5 transition-colors ${pumpActive ? 'text-primary' : 'text-forest/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-forest">Water pump</p>
                <p className="text-xs text-forest/40">{pumpActive ? 'Pump is running…' : 'Send a manual watering pulse to the device.'}</p>
              </div>
              <button
                type="button"
                onClick={handleTriggerPump}
                disabled={pumpCooldown || dataUntrusted}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  pumpActive ? 'bg-primary/15 text-primary' : pumpCooldown ? 'bg-forest/5 text-forest/30' : 'bg-primary text-white hover:bg-primary-600 shadow-sm'
                } disabled:opacity-50`}
              >
                {pumpActive ? 'Running…' : pumpCooldown ? 'Sent' : 'Water now'}
              </button>
            </motion.div>

            {showProTip && (
              <div className="mt-6 rounded-2xl border border-terracotta/15 bg-terracotta-light/50 p-4">
                <p className="text-sm font-medium text-terracotta">Pro tip</p>
                <p className="mt-1 text-sm text-forest/45">Temperature is above 28 °C. Consider lowering the target moisture threshold so the plant doesn't get overwatered in the heat.</p>
              </div>
            )}

            {/* Target moisture slider */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="section-card mt-6">
              <p className="mb-1 stat-label">Target moisture (raw threshold)</p>
              <p className="mb-3 text-sm text-forest/45">Soil raw below this = "wet enough". Drag to set target.</p>
              <div className="flex flex-wrap items-center gap-4">
                <input type="range" min={0} max={4095} value={targetSoil} onChange={(e) => { const v = Number(e.target.value); setTargetSoil(v); setTargetSoilInput(String(v)) }} className="moisture-slider min-w-0 flex-1" aria-label="Target moisture raw value" />
                <span className="w-16 text-right text-lg font-semibold tabular-nums text-forest">{targetSoil}</span>
                <button onClick={handleSaveTarget} className="btn-primary">Save</button>
              </div>
              <p className="mt-3 text-xs text-forest/60">Pump control is optional (no hardware). When enabled, the device pulses the pump until soilRaw ≤ target.</p>
            </motion.div>

            {/* Calibrate soil */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} className="section-card mt-6">
              <p className="mb-1 stat-label">Calibrate soil sensor</p>
              <p className="mb-3 text-sm text-forest/45">Mark one dry and one wet reading so the gauge uses your sensor range. Current raw: {readings?.soilRaw ?? '—'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleMarkDry} disabled={readings?.soilRaw == null} className="btn-ghost disabled:opacity-40">Mark as dry</button>
                <button type="button" onClick={handleMarkWet} disabled={readings?.soilRaw == null} className="btn-ghost disabled:opacity-40">Mark as wet</button>
                {(calibration.boneDry != null || calibration.submerged != null) && (
                  <span className="text-xs text-forest/60">Dry: {calibration.boneDry ?? '—'} · Wet: {calibration.submerged ?? '—'}</span>
                )}
              </div>
            </motion.div>

            {/* Plant profiles */}
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }} className="section-card mt-6">
              <h2 className="stat-label mb-1">Plant profiles</h2>
              <p className="mb-4 text-sm text-forest/45">Add profiles for different plants. Link one to this device to show its name and type above.</p>
              <form onSubmit={addNewProfile} className="mb-4 flex flex-wrap items-center gap-2">
                <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Plant name" className="input-field" />
                <select
                  value={newProfilePresetId ?? ''}
                  onChange={(e) => { const id = e.target.value || null; setNewProfilePresetId(id); setNewProfileType(id ? EXAMPLE_PLANTS.find((p) => p.id === id)?.label ?? '' : '') }}
                  className="input-field"
                >
                  <option value="">— Example plant —</option>
                  {EXAMPLE_PLANTS.map((p) => <option key={p.id} value={p.id}>{p.label} (target {p.targetSoil})</option>)}
                </select>
                <input type="text" value={newProfileType} onChange={(e) => setNewProfileType(e.target.value)} placeholder="Type" className="min-w-[120px] input-field" />
                <button type="submit" className="btn-primary">Add profile</button>
              </form>
              {Object.keys(profiles).length === 0 ? (
                <p className="text-xs text-forest/60">No plant profiles yet. Add one above.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(profiles).sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).map(([id, p]) => (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest/10 bg-surface/50 px-3 py-2">
                      <span className="font-medium text-forest">{p.name}</span>
                      {p.type && p.type !== '—' && <span className="text-xs text-forest/60">{p.type}</span>}
                      {linkedProfileId === id && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Linked</span>}
                      <div className="ml-auto flex items-center gap-1">
                        {linkedProfileId !== id && selectedMac && (
                          <button type="button" onClick={() => linkProfileToDevice(id)} className="rounded-xl bg-primary/15 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/25">Use for this device</button>
                        )}
                        <button type="button" onClick={() => openEditPlant(id)} className="rounded-full p-1.5 text-forest/50 transition hover:bg-mint/50 hover:text-forest" aria-label="Edit profile"><PencilIcon className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteProfile(id)} className="rounded-full px-2 py-1 text-xs text-terracotta transition hover:bg-terracotta/10">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
            </>)}
          </>
        )}

        {/* Edit plant modal */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-plant-title" onClick={closeEditPlant}>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card-solid w-full max-w-sm rounded-3xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
              <h2 id="edit-plant-title" className="mb-4 text-lg font-semibold text-forest">{editingProfileId ? 'Edit plant' : 'Add plant'}</h2>
              <div className="mb-4 space-y-3">
                <label className="block text-sm font-medium text-forest/80">
                  Name
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Living room Monstera" className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="block text-sm font-medium text-forest/80">
                  Example plant (sets type & target moisture)
                  <select value={editPresetId ?? ''} onChange={(e) => { const id = e.target.value || null; setEditPresetId(id); const preset = id ? EXAMPLE_PLANTS.find((p) => p.id === id) : null; setEditForm((f) => ({ ...f, type: preset ? preset.label : f.type })) }} className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">— Custom —</option>
                    {EXAMPLE_PLANTS.map((p) => <option key={p.id} value={p.id}>{p.label} (target {p.targetSoil})</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-forest/80">
                  Type
                  <input type="text" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. Monstera, Succulent" className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeEditPlant} className="flex-1 rounded-2xl border border-forest/10 bg-white py-2.5 text-sm font-medium text-forest transition hover:bg-mint/30">Cancel</button>
                <button type="button" onClick={() => saveEditPlant(!editingProfileId)} className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90">{editingProfileId ? 'Save' : 'Save and use for this device'}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invite user section */}
        <section className="section-card mt-10">
          <h2 className="stat-label mb-1">Invite user</h2>
          <p className="mb-3 text-sm text-forest/45">Share the app link. New users sign up with email and password, then can claim their own devices.</p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input type="text" readOnly value={appUrl} className="min-w-0 flex-1 rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button type="button" onClick={handleCopyUrl} className="btn-ghost">{copyOk ? 'Copied!' : 'Copy link'}</button>
          </div>
          <form onSubmit={handleInvite} className="mb-3 flex flex-wrap items-center gap-2">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email to add to invite list" className="input-field" />
            <button type="submit" className="btn-primary">Add to invite list</button>
          </form>
          {invitedList.length > 0 && <p className="text-xs text-forest/60">Invited: {invitedList.join(', ')} (they still need to sign up at the link above).</p>}
        </section>
      </div>
    </div>
  )
}
