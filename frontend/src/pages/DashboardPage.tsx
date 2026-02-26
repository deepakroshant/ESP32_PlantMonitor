import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, animate } from 'framer-motion'
import { ref, onValue, set, push, remove } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { soilStatus, soilStatusLabel, soilRawToGaugeCalibrated } from '../utils/soil'
import { CircularGauge } from '../components/CircularGauge'
import { DeviceIcon } from '../components/icons/DeviceIcon'
import { LogoutIcon } from '../components/icons/LogoutIcon'
import { PlusIcon } from '../components/icons/PlusIcon'
import { PlantIcon } from '../components/icons/PlantIcon'
import { ThermometerIcon } from '../components/icons/ThermometerIcon'
import { SunIcon } from '../components/icons/SunIcon'
import { PencilIcon } from '../components/icons/PencilIcon'

type Readings = {
  temperature?: number
  soilRaw?: number
  lightBright?: boolean
  pumpRunning?: boolean
  health?: string
  timestamp?: number
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
  const [resetFlowActive, setResetFlowActive] = useState(false)
  const [calibration, setCalibration] = useState<{ boneDry: number | null; submerged: number | null }>({ boneDry: null, submerged: null })
  const [lastAlert, setLastAlert] = useState<{ timestamp: number; type: string; message: string } | null>(null)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Load user's claimed devices
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

  // Load plant profiles (users/<uid>/plantProfiles)
  useEffect(() => {
    if (!user) return
    const profilesRef = ref(firebaseDb, `users/${user.uid}/plantProfiles`)
    const unsub = onValue(profilesRef, (snap) => {
      const val = snap.val()
      setProfiles((val && typeof val === 'object') ? val as Record<string, PlantProfile> : {})
    })
    return () => unsub()
  }, [user])

  // Load linked plant for selected device (users/<uid>/devicePlant/<mac>)
  useEffect(() => {
    if (!user || !selectedMac) {
      setLinkedProfileId(null)
      return
    }
    const devicePlantRef = ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`)
    const unsub = onValue(devicePlantRef, (snap) => {
      const id = snap.val()
      setLinkedProfileId(typeof id === 'string' ? id : null)
    })
    return () => unsub()
  }, [user, selectedMac])

  // Live readings for selected device
  useEffect(() => {
    if (!selectedMac) {
      setReadings(null)
      return
    }
    const readingsRef = ref(firebaseDb, `devices/${selectedMac}/readings`)
    const unsub = onValue(readingsRef, (snap) => {
      setReadings(snap.val() ?? null)
    })
    return () => unsub()
  }, [selectedMac])

  // Load targetSoil from control for selected device
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

  // Load calibration (boneDry, submerged) for selected device
  useEffect(() => {
    if (!selectedMac) {
      setCalibration({ boneDry: null, submerged: null })
      return
    }
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

  // Load last alert for selected device
  useEffect(() => {
    if (!selectedMac) {
      setLastAlert(null)
      return
    }
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

  // Invited users list (users/<uid>/invites)
  useEffect(() => {
    if (!user) return
    const invitesRef = ref(firebaseDb, `users/${user.uid}/invites`)
    const unsub = onValue(invitesRef, (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') {
        setInvitedList([])
        return
      }
      const emails = (Object.values(val) as { email?: string }[])
        .map((v) => v.email)
        .filter((e): e is string => typeof e === 'string')
      setInvitedList(emails)
    })
    return () => unsub()
  }, [user])

  function handleSaveTarget() {
    const n = parseInt(targetSoilInput, 10)
    if (isNaN(n) || n < 0) return
    const path = `devices/${selectedMac}/control/targetSoil`
    set(ref(firebaseDb, path), n).catch(console.error)
    setTargetSoil(n)
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(appUrl)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    } catch {
      setCopyOk(false)
    }
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
        name,
        type: type || '—',
        createdAt: profiles[editingProfileId]?.createdAt ?? now,
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
    if (!selectedMac) return
    await set(ref(firebaseDb, `devices/${selectedMac}/control/resetProvisioning`), true).catch(console.error)
    setResetFlowActive(true)
  }

  async function handleMarkDry() {
    if (!selectedMac || readings?.soilRaw == null) return
    await set(ref(firebaseDb, `devices/${selectedMac}/calibration/boneDry`), readings.soilRaw).catch(console.error)
  }

  async function handleMarkWet() {
    if (!selectedMac || readings?.soilRaw == null) return
    await set(ref(firebaseDb, `devices/${selectedMac}/calibration/submerged`), readings.soilRaw).catch(console.error)
  }

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

  // Auto-dismiss reset flow once device comes back online with fresh data
  useEffect(() => {
    if (!resetFlowActive) return
    const ts = readings?.timestamp ?? 0
    const fresh = ts > 1577836800 && Math.floor(Date.now() / 1000) - ts < 30
    if (fresh) setResetFlowActive(false)
  }, [readings?.timestamp, resetFlowActive])

  const currentPlant = linkedProfileId ? profiles[linkedProfileId] : null

  const soil = readings?.soilRaw != null ? soilStatus(readings.soilRaw) : null
  const soilLabel = soil != null ? soilStatusLabel(soil) : '—'
  const gaugePct =
    readings?.soilRaw != null
      ? soilRawToGaugeCalibrated(readings.soilRaw, calibration.boneDry, calibration.submerged) * 100
      : 0
  const temp = readings?.temperature

  // Count-up animation for temperature
  useEffect(() => {
    const to = temp != null && !Number.isNaN(temp) ? temp : 0
    const controls = animate(displayTemp, to, { duration: 0.6, onUpdate: (v) => setDisplayTemp(v) })
    return () => controls.stop()
  }, [temp])

  // Count-up for soil gauge percentage
  useEffect(() => {
    const controls = animate(displayGaugePct, gaugePct, { duration: 0.7, onUpdate: (v) => setDisplayGaugePct(v) })
    return () => controls.stop()
  }, [gaugePct])
  const showProTip = temp != null && !Number.isNaN(temp) && temp > 28
  const healthOk = (readings?.health ?? '').toLowerCase() === 'ok'
  const nowSec = Math.floor(Date.now() / 1000)
  const lastSeenSec = readings?.timestamp ?? 0
  const tsLooksValid = lastSeenSec > 1577836800
  const secondsAgo = tsLooksValid ? nowSec - lastSeenSec : Infinity
  const isStale = secondsAgo > 30
  const isOffline = secondsAgo > 120
  const lastUpdated = readings?.timestamp != null && tsLooksValid
    ? new Date(readings.timestamp * 1000).toLocaleTimeString()
    : null
  const lastSeenLabel =
    !tsLooksValid
      ? 'unknown'
      : secondsAgo < 60
        ? `${secondsAgo}s ago`
        : secondsAgo < 3600
          ? `${Math.floor(secondsAgo / 60)} min ago`
          : secondsAgo < 86400
            ? `${Math.floor(secondsAgo / 3600)} h ago`
            : `${Math.floor(secondsAgo / 86400)} d ago`

  return (
    <div className="min-h-screen bg-surface p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-forest/10 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-forest">
            Smart Plant Pro
          </h1>
          <div className="flex items-center gap-2">
            {user && (
              <span className="rounded-full border border-forest/10 bg-white px-3 py-2 text-sm text-forest/80 shadow-card">
                {user.displayName || user.email || 'Account'}
              </span>
            )}
            <Link
              to="/claim"
              className="flex items-center gap-2 rounded-full border border-forest/10 bg-white px-4 py-2.5 text-sm font-medium text-forest shadow-card transition hover:bg-mint/50"
            >
              <DeviceIcon className="h-5 w-5" />
              Claim device
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-full border border-forest/10 bg-white px-4 py-2.5 text-sm font-medium text-forest shadow-card transition hover:bg-mint/50"
            >
              <LogoutIcon className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </header>

        {myDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] bg-white p-12 text-center shadow-card">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint">
              <PlusIcon className="h-8 w-8 text-primary" />
            </div>
            <p className="mb-2 text-lg font-medium text-forest">Time to add a new green friend.</p>
            <p className="mb-6 text-sm text-forest/70">Claim a device to see live readings.</p>
            <Link
              to="/claim"
              className="inline-block rounded-2xl bg-primary px-6 py-3 font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Claim a device
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-forest/70">
                Device
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedMac}
                  onChange={(e) => {
                    const v = e.target.value
                    setSelectedMac(v)
                    localStorage.setItem(STORAGE_KEY, v)
                  }}
                  className="w-full max-w-sm rounded-2xl border border-forest/10 bg-white px-4 py-2.5 font-mono text-sm text-forest shadow-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {myDevices.map((mac) => (
                    <option key={mac} value={mac}>
                      {mac}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleResetDeviceWiFi}
                  disabled={resetFlowActive}
                  className="rounded-2xl border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs font-medium text-terracotta transition hover:bg-terracotta/20 disabled:opacity-50"
                  title="Device will clear its WiFi config and restart in AP mode so you can enter a new network"
                >
                  Reset device WiFi
                </button>
              </div>
            </div>

            {/* Reset WiFi provisioning flow */}
            {resetFlowActive && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-[24px] border-2 border-amber-300 bg-amber-50 p-5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">Reconnecting device…</p>
                  <button
                    type="button"
                    onClick={() => setResetFlowActive(false)}
                    className="rounded-xl px-2 py-0.5 text-xs text-amber-600 transition hover:bg-amber-100"
                  >
                    Dismiss
                  </button>
                </div>
                <ol className="ml-4 list-decimal space-y-1 text-sm text-amber-900/80">
                  <li>The device is restarting into AP mode (takes ~10 s).</li>
                  <li>On your phone or laptop, connect to the <strong>SmartPlantPro</strong> WiFi network.</li>
                  <li>A portal should open automatically. If not, go to <strong>192.168.4.1</strong> in a browser.</li>
                  <li>Choose your WiFi network, enter password, and (optionally) Firebase credentials.</li>
                  <li>After saving, the device will connect and data will reappear here.</li>
                </ol>
              </motion.div>
            )}

            {/* Offline banner */}
            {isOffline && !resetFlowActive && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-[24px] border border-terracotta/30 bg-terracotta/5 px-5 py-3"
              >
                <span className="flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-terracotta/40" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-terracotta" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-terracotta">Device offline</p>
                  <p className="text-xs text-forest/60">
                    {tsLooksValid
                      ? `Last seen ${lastSeenLabel}. Readings below may be outdated.`
                      : 'No valid timestamp received. The device may never have connected.'}
                  </p>
                </div>
              </motion.div>
            )}

            {!isOffline && (lastUpdated || isStale) && (
              <p className="mb-4 text-xs text-forest/60">
                {isStale ? (
                  <span>Last seen: {lastSeenLabel}</span>
                ) : (
                  <>Last reading: {lastUpdated}</>
                )}
              </p>
            )}

            {/* Hero: plant name/type + overall health — compact single row */}
            <motion.div
              key={selectedMac}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 flex items-center gap-4 rounded-[32px] bg-white p-4 shadow-card sm:gap-5 sm:p-5"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-mint sm:h-16 sm:w-16">
                <PlantIcon className="h-8 w-8 text-primary sm:h-9 sm:w-9" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-forest sm:text-base">
                    {currentPlant?.name ?? 'Your plant'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditPlant(linkedProfileId)}
                    className="rounded-full p-1 text-forest/50 transition hover:bg-mint/50 hover:text-forest"
                    aria-label="Edit plant name and type"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-forest/60">
                  {currentPlant?.type ? `${currentPlant.type} · Device status` : 'Device status'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-forest/70 sm:text-xs">Overall health</p>
                {isOffline ? (
                  <span className="inline-block rounded-full border-2 border-forest/15 bg-forest/5 px-4 py-2 text-sm font-semibold text-forest/40 sm:px-5 sm:py-2.5 sm:text-base">
                    Offline
                  </span>
                ) : (
                  <span
                    className={`inline-block rounded-full border-2 px-4 py-2 text-sm font-semibold sm:px-5 sm:py-2.5 sm:text-base ${
                      healthOk
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-terracotta/30 bg-terracotta/10 text-terracotta'
                    }`}
                  >
                    {readings?.health ?? '—'}
                  </span>
                )}
              </div>
            </motion.div>

            {lastAlert && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border border-terracotta/30 bg-terracotta/10 px-4 py-2"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-terracotta">Last alert</p>
                <p className="text-sm text-forest/90">{lastAlert.message}</p>
                {lastAlert.timestamp > 0 && (
                  <p className="mt-0.5 text-xs text-forest/60">
                    {new Date(lastAlert.timestamp * 1000).toLocaleString()}
                  </p>
                )}
              </motion.div>
            )}

            <motion.div
              key={`gauges-${selectedMac}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: isOffline ? 0.45 : 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isOffline ? 'pointer-events-none select-none grayscale-[30%]' : ''}`}
            >
              <div className="rounded-[32px] bg-white p-5 shadow-card">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint">
                  <ThermometerIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-forest/70">
                  Temperature
                </p>
                <p className="text-2xl font-semibold tabular-nums text-forest">
                  {temp != null && !Number.isNaN(temp)
                    ? `${displayTemp.toFixed(1)} °C`
                    : '—'}
                </p>
              </div>
              <div className="rounded-[32px] bg-white/90 p-5 shadow-card backdrop-blur-sm lg:col-span-2">
                <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-forest/70">
                  Soil moisture
                </p>
                <CircularGauge percentage={displayGaugePct} label={soilLabel} size={180} strokeWidth={14} />
              </div>
              <div className="rounded-[32px] bg-white p-5 shadow-card">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint">
                  <SunIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-forest/70">
                  Light
                </p>
                <p className="text-xl font-semibold text-forest">
                  {readings?.lightBright === true
                    ? 'Bright'
                    : readings?.lightBright === false
                      ? 'Dim'
                      : '—'}
                </p>
              </div>
            </motion.div>

            {showProTip && (
              <div className="mt-6 rounded-[32px] border border-terracotta/20 bg-terracotta/5 p-4 shadow-card">
                <p className="text-sm font-medium text-terracotta">
                  Pro tip
                </p>
                <p className="mt-1 text-sm text-forest/80">
                  Temperature is above 28 °C. Consider lowering the target moisture threshold so the plant doesn’t get overwatered in the heat.
                </p>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-6 rounded-[32px] bg-white p-5 shadow-card"
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-forest/70">
                Target moisture (raw threshold)
              </p>
              <p className="mb-3 text-sm text-forest/80">
                Soil raw below this = “wet enough”. Drag to set target.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={4095}
                  value={targetSoil}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setTargetSoil(v)
                    setTargetSoilInput(String(v))
                  }}
                  className="moisture-slider min-w-0 flex-1"
                  aria-label="Target moisture raw value"
                />
                <span className="w-16 text-right text-lg font-semibold tabular-nums text-forest">{targetSoil}</span>
                <button
                  onClick={handleSaveTarget}
                  className="rounded-2xl bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
                >
                  Save
                </button>
              </div>
              <p className="mt-3 text-xs text-forest/60">
                Pump control is optional (no hardware). When enabled, the device pulses the pump until soilRaw ≤ target.
              </p>
            </motion.div>

            {/* Calibrate soil: mark dry / wet for accurate gauge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 }}
              className="mt-6 rounded-[32px] bg-white p-5 shadow-card"
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-forest/70">
                Calibrate soil sensor
              </p>
              <p className="mb-3 text-sm text-forest/80">
                Mark one dry and one wet reading so the gauge uses your sensor range. Current raw: {readings?.soilRaw ?? '—'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkDry}
                  disabled={readings?.soilRaw == null}
                  className="rounded-2xl border border-forest/20 bg-white px-4 py-2 text-sm font-medium text-forest transition hover:bg-mint/30 disabled:opacity-50"
                >
                  Mark as dry
                </button>
                <button
                  type="button"
                  onClick={handleMarkWet}
                  disabled={readings?.soilRaw == null}
                  className="rounded-2xl border border-forest/20 bg-white px-4 py-2 text-sm font-medium text-forest transition hover:bg-mint/30 disabled:opacity-50"
                >
                  Mark as wet
                </button>
                {(calibration.boneDry != null || calibration.submerged != null) && (
                  <span className="text-xs text-forest/60">
                    Dry: {calibration.boneDry ?? '—'} · Wet: {calibration.submerged ?? '—'}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Plant profiles: list, add, link to device */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 }}
              className="mt-6 rounded-[32px] bg-white p-5 shadow-card"
            >
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-forest/70">
                Plant profiles
              </h2>
              <p className="mb-4 text-sm text-forest/80">
                Add profiles for different plants. Link one to this device to show its name and type above.
              </p>
              <form onSubmit={addNewProfile} className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Plant name"
                  className="rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest placeholder-forest/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <select
                  value={newProfilePresetId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null
                    setNewProfilePresetId(id)
                    const preset = id ? EXAMPLE_PLANTS.find((p) => p.id === id) : null
                    setNewProfileType(preset ? preset.label : '')
                  }}
                  className="rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">— Example plant —</option>
                  {EXAMPLE_PLANTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} (target {p.targetSoil})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newProfileType}
                  onChange={(e) => setNewProfileType(e.target.value)}
                  placeholder="Type"
                  className="min-w-[120px] rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest placeholder-forest/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Add profile
                </button>
              </form>
              {Object.keys(profiles).length === 0 ? (
                <p className="text-xs text-forest/60">No plant profiles yet. Add one above.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(profiles)
                    .sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
                    .map(([id, p]) => (
                      <li
                        key={id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest/10 bg-surface/50 px-3 py-2"
                      >
                        <span className="font-medium text-forest">{p.name}</span>
                        {p.type && p.type !== '—' && (
                          <span className="text-xs text-forest/60">{p.type}</span>
                        )}
                        {linkedProfileId === id && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                            Linked
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {linkedProfileId !== id && selectedMac && (
                            <button
                              type="button"
                              onClick={() => linkProfileToDevice(id)}
                              className="rounded-xl bg-primary/15 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/25"
                            >
                              Use for this device
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditPlant(id)}
                            className="rounded-full p-1.5 text-forest/50 transition hover:bg-mint/50 hover:text-forest"
                            aria-label="Edit profile"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProfile(id)}
                            className="rounded-full px-2 py-1 text-xs text-terracotta transition hover:bg-terracotta/10"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </motion.section>
          </>
        )}

        {/* Edit plant modal */}
        {editModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-forest/30 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-plant-title"
            onClick={closeEditPlant}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="edit-plant-title" className="mb-4 text-lg font-semibold text-forest">
                {editingProfileId ? 'Edit plant' : 'Add plant'}
              </h2>
              <div className="mb-4 space-y-3">
                <label className="block text-sm font-medium text-forest/80">
                  Name
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Living room Monstera"
                    className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="block text-sm font-medium text-forest/80">
                  Example plant (sets type & target moisture)
                  <select
                    value={editPresetId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null
                      setEditPresetId(id)
                      const preset = id ? EXAMPLE_PLANTS.find((p) => p.id === id) : null
                      setEditForm((f) => ({ ...f, type: preset ? preset.label : f.type }))
                    }}
                    className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Custom —</option>
                    {EXAMPLE_PLANTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} (target {p.targetSoil})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-forest/80">
                  Type
                  <input
                    type="text"
                    value={editForm.type}
                    onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                    placeholder="e.g. Monstera, Succulent"
                    className="mt-1 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditPlant}
                  className="flex-1 rounded-2xl border border-forest/10 bg-white py-2.5 text-sm font-medium text-forest transition hover:bg-mint/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveEditPlant(!editingProfileId)}
                  className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  {editingProfileId ? 'Save' : 'Save and use for this device'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invite user section */}
        <section className="mt-10 rounded-[32px] bg-white p-5 shadow-card">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-forest/70">
            Invite user
          </h2>
          <p className="mb-3 text-sm text-forest/80">
            Share the app link. New users sign up with email and password, then can claim their own devices.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={appUrl}
              className="min-w-0 flex-1 rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="rounded-2xl border border-forest/10 bg-mint/50 px-4 py-2 text-sm font-medium text-forest transition hover:bg-mint"
            >
              {copyOk ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <form onSubmit={handleInvite} className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email to add to invite list"
              className="rounded-2xl border border-forest/10 bg-white px-3 py-2 text-sm text-forest placeholder-forest/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Add to invite list
            </button>
          </form>
          {invitedList.length > 0 && (
            <p className="text-xs text-forest/60">
              Invited: {invitedList.join(', ')} (they still need to sign up at the link above).
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
