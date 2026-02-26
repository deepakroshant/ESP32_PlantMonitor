import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, animate } from 'framer-motion'
import { ref, onValue, set, push, remove } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { soilStatus, soilStatusLabel, soilRawToGaugeCalibrated } from '../utils/soil'
import { getDeviceStatus, STATUS_META, formatSecondsAgo } from '../utils/deviceStatus'
import type { Readings, PlantProfile, DeviceStatus } from '../types'
import { LogoutIcon } from '../components/icons/LogoutIcon'
import { PlusIcon } from '../components/icons/PlusIcon'
import { PlantIcon } from '../components/icons/PlantIcon'
import { PencilIcon } from '../components/icons/PencilIcon'
import { HistoryChart } from '../components/HistoryChart'
import { DeviceStatusBar } from '../components/dashboard/DeviceStatusBar'
import { StatusBanners } from '../components/dashboard/StatusBanners'
import { PlantHero } from '../components/dashboard/PlantHero'
import { SensorGrid } from '../components/dashboard/SensorGrid'
import { fadeSlideUp, fadeScale, orchestratedStagger, cardItem, scrollReveal } from '../lib/motion'
import { CollapsibleSection } from '../components/CollapsibleSection'

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

  // ── State ──
  const [myDevices, setMyDevices] = useState<string[]>([])
  const [selectedMac, setSelectedMac] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [readings, setReadings] = useState<Readings | null>(null)
  const [targetSoil, setTargetSoil] = useState(2800)
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
  const [resetRequestedAt, setResetRequestedAtRaw] = useState(() => {
    const stored = localStorage.getItem('spp_reset_at')
    if (!stored) return 0
    const ts = Number(stored)
    // Expire after 5 minutes so a stale flag never locks the UI
    if (ts > 0 && Math.floor(Date.now() / 1000) - ts > 300) {
      localStorage.removeItem('spp_reset_at')
      return 0
    }
    return ts
  })
  const setResetRequestedAt = (v: number) => {
    setResetRequestedAtRaw(v)
    if (v > 0) localStorage.setItem('spp_reset_at', String(v))
    else localStorage.removeItem('spp_reset_at')
  }
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

  // ── Firebase listeners ──

  useEffect(() => {
    if (!user) return
    return onValue(ref(firebaseDb, `users/${user.uid}/devices`), (snap) => {
      const val = snap.val()
      const list = val ? Object.keys(val) as string[] : []
      setMyDevices(list)
      if (list.length && !list.includes(selectedMac)) {
        const next = list[0]
        setSelectedMac(next)
        localStorage.setItem(STORAGE_KEY, next)
      }
    })
  }, [user, selectedMac])

  useEffect(() => {
    if (!user) return
    return onValue(ref(firebaseDb, `users/${user.uid}/plantProfiles`), (snap) => {
      const val = snap.val()
      setProfiles((val && typeof val === 'object') ? val as Record<string, PlantProfile> : {})
    })
  }, [user])

  useEffect(() => {
    if (!user || !selectedMac) { setLinkedProfileId(null); return }
    return onValue(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), (snap) => {
      const id = snap.val()
      setLinkedProfileId(typeof id === 'string' ? id : null)
    })
  }, [user, selectedMac])

  useEffect(() => {
    if (!selectedMac) { setReadings(null); return }
    return onValue(ref(firebaseDb, `devices/${selectedMac}/readings`), (snap) => {
      setReadings(snap.val() ?? null)
    })
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) return
    return onValue(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), (snap) => {
      const v = snap.val()
      if (typeof v === 'number' && v >= 0) { setTargetSoil(v); setTargetSoilInput(String(v)) }
    })
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setCalibration({ boneDry: null, submerged: null }); return }
    return onValue(ref(firebaseDb, `devices/${selectedMac}/calibration`), (snap) => {
      const val = snap.val()
      if (val && typeof val === 'object') {
        const o = val as Record<string, unknown>
        setCalibration({ boneDry: typeof o.boneDry === 'number' ? o.boneDry : null, submerged: typeof o.submerged === 'number' ? o.submerged : null })
      } else { setCalibration({ boneDry: null, submerged: null }) }
    })
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setLastAlert(null); return }
    return onValue(ref(firebaseDb, `devices/${selectedMac}/alerts/lastAlert`), (snap) => {
      const val = snap.val()
      if (val && typeof val === 'object') {
        const o = val as Record<string, unknown>
        setLastAlert({ timestamp: typeof o.timestamp === 'number' ? o.timestamp : 0, type: typeof o.type === 'string' ? o.type : 'alert', message: typeof o.message === 'string' ? o.message : '—' })
      } else { setLastAlert(null) }
    })
  }, [selectedMac])

  useEffect(() => {
    if (!selectedMac) { setPumpActive(false); return }
    return onValue(ref(firebaseDb, `devices/${selectedMac}/readings/pumpRunning`), (snap) => setPumpActive(snap.val() === true))
  }, [selectedMac])

  useEffect(() => {
    if (!user) return
    return onValue(ref(firebaseDb, `users/${user.uid}/invites`), (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') { setInvitedList([]); return }
      setInvitedList(
        (Object.values(val) as { email?: string }[]).map((v) => v.email).filter((e): e is string => typeof e === 'string')
      )
    })
  }, [user])

  // ── Handlers ──

  function handleSaveTarget() {
    const n = parseInt(targetSoilInput, 10)
    if (isNaN(n) || n < 0) return
    set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), n).catch(console.error)
    setTargetSoil(n)
  }

  async function handleCopyUrl() {
    try { await navigator.clipboard.writeText(appUrl); setCopyOk(true); setTimeout(() => setCopyOk(false), 2000) }
    catch { setCopyOk(false) }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !user) return
    await set(ref(firebaseDb, `users/${user.uid}/invites/${email.replace(/[.#$[\]]/g, '_')}`), { email, at: Date.now() }).catch(console.error)
    setInviteEmail('')
  }

  function openEditPlant(profileId: string | null) {
    setEditPresetId(null)
    if (profileId && profiles[profileId]) {
      setEditingProfileId(profileId)
      setEditForm({ name: profiles[profileId].name, type: profiles[profileId].type })
    } else { setEditingProfileId(null); setEditForm({ name: '', type: '' }) }
    setEditModalOpen(true)
  }

  function closeEditPlant() { setEditModalOpen(false); setEditingProfileId(null); setEditForm({ name: '', type: '' }); setEditPresetId(null) }

  async function saveEditPlant(andLinkToDevice: boolean) {
    const name = editForm.name.trim(); const type = editForm.type.trim()
    if (!name || !user) return
    const now = Date.now()
    if (editingProfileId) {
      await set(ref(firebaseDb, `users/${user.uid}/plantProfiles/${editingProfileId}`), { name, type: type || '—', createdAt: profiles[editingProfileId]?.createdAt ?? now }).catch(console.error)
      if (selectedMac && editPresetId) {
        const preset = EXAMPLE_PLANTS.find((p) => p.id === editPresetId)
        if (preset) { await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error); setTargetSoil(preset.targetSoil); setTargetSoilInput(String(preset.targetSoil)) }
      }
    } else {
      const newRef = push(ref(firebaseDb, `users/${user.uid}/plantProfiles`)); const id = newRef.key; if (!id) return
      await set(newRef, { name, type: type || '—', createdAt: now }).catch(console.error)
      if (andLinkToDevice && selectedMac) {
        await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), id).catch(console.error)
        if (editPresetId) { const preset = EXAMPLE_PLANTS.find((p) => p.id === editPresetId); if (preset) { await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error); setTargetSoil(preset.targetSoil); setTargetSoilInput(String(preset.targetSoil)) } }
      }
    }
    closeEditPlant()
  }

  async function linkProfileToDevice(profileId: string) { if (!user || !selectedMac) return; await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), profileId).catch(console.error) }

  async function deleteProfile(profileId: string) {
    if (!user) return
    await remove(ref(firebaseDb, `users/${user.uid}/plantProfiles/${profileId}`)).catch(console.error)
    if (linkedProfileId === profileId && selectedMac) await set(ref(firebaseDb, `users/${user.uid}/devicePlant/${selectedMac}`), null).catch(console.error)
  }

  async function handleResetDeviceWiFi() {
    if (!selectedMac || resetRequestedAt > 0) return
    const now = Math.floor(Date.now() / 1000)
    // Set local state FIRST so the UI transitions immediately to "syncing"
    setResetRequestedAt(now)
    await Promise.all([
      set(ref(firebaseDb, `devices/${selectedMac}/control/resetProvisioning`), true),
      set(ref(firebaseDb, `devices/${selectedMac}/readings`), null),
    ]).catch(console.error)
  }

  async function handleMarkDry() { if (!selectedMac || readings?.soilRaw == null) return; await set(ref(firebaseDb, `devices/${selectedMac}/calibration/boneDry`), readings.soilRaw).catch(console.error) }
  async function handleMarkWet() { if (!selectedMac || readings?.soilRaw == null) return; await set(ref(firebaseDb, `devices/${selectedMac}/calibration/submerged`), readings.soilRaw).catch(console.error) }

  async function handleTriggerPump() {
    if (!selectedMac || pumpCooldown) return
    await set(ref(firebaseDb, `devices/${selectedMac}/control/pumpRequest`), true).catch(console.error)
    setPumpCooldown(true); setTimeout(() => setPumpCooldown(false), 8000)
  }

  async function handleAckAlert() { if (!selectedMac) return; await set(ref(firebaseDb, `devices/${selectedMac}/alerts/lastAlert/ackAt`), Math.floor(Date.now() / 1000)).catch(console.error); setLastAlert(null) }

  async function handleToggleNotifications() {
    if (notificationsEnabled) { setNotificationsEnabled(false); localStorage.setItem('notif_enabled', 'false'); return }
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') { setNotificationsEnabled(true); localStorage.setItem('notif_enabled', 'true') }
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
    const name = newProfileName.trim(); const type = newProfileType.trim()
    if (!name || !user) return
    const newRef = push(ref(firebaseDb, `users/${user.uid}/plantProfiles`)); const id = newRef.key; if (!id) return
    await set(newRef, { name, type: type || '—', createdAt: Date.now() }).catch(console.error)
    if (newProfilePresetId && selectedMac) { const preset = EXAMPLE_PLANTS.find((p) => p.id === newProfilePresetId); if (preset) { await set(ref(firebaseDb, `devices/${selectedMac}/control/targetSoil`), preset.targetSoil).catch(console.error); setTargetSoil(preset.targetSoil); setTargetSoilInput(String(preset.targetSoil)) } }
    setNewProfileName(''); setNewProfileType(''); setNewProfilePresetId(null)
  }

  // ── Derived values ──

  const currentPlant = linkedProfileId ? profiles[linkedProfileId] : null
  const soil = readings?.soilRaw != null ? soilStatus(readings.soilRaw) : null
  const soilLabel = soil != null ? soilStatusLabel(soil) : '—'
  const gaugePct = readings?.soilRaw != null ? soilRawToGaugeCalibrated(readings.soilRaw, calibration.boneDry, calibration.submerged) * 100 : 0
  const temp = readings?.temperature

  useEffect(() => { const to = temp != null && !Number.isNaN(temp) ? temp : 0; const c = animate(displayTemp, to, { duration: 0.6, onUpdate: (v) => setDisplayTemp(v) }); return () => c.stop() }, [temp])
  useEffect(() => { const c = animate(displayGaugePct, gaugePct, { duration: 0.7, onUpdate: (v) => setDisplayGaugePct(v) }); return () => c.stop() }, [gaugePct])

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => { const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 2000); return () => clearInterval(id) }, [])

  const deviceStatus = getDeviceStatus(readings, nowSec, resetRequestedAt)
  const meta = STATUS_META[deviceStatus]

  useEffect(() => {
    if (resetRequestedAt > 0 && deviceStatus === 'live') {
      setShowSyncedBanner(true)
      // Show the "Back online" banner for 4s, then clear the reset state
      const timer = setTimeout(() => { setResetRequestedAt(0); setShowSyncedBanner(false) }, 4000)
      return () => clearTimeout(timer)
    }
    // Auto-expire stale reset if somehow left hanging for > 5 min
    if (resetRequestedAt > 0 && Math.floor(Date.now() / 1000) - resetRequestedAt > 300) {
      setResetRequestedAt(0)
    }
  }, [deviceStatus, resetRequestedAt])
  useEffect(() => { prevStatusRef.current = deviceStatus }, [deviceStatus])

  const isResetGuide = resetRequestedAt > 0 && deviceStatus === 'syncing'
  const dataUntrusted = deviceStatus === 'offline' || deviceStatus === 'syncing' || deviceStatus === 'wifi_connected' || deviceStatus === 'no_data'
  const isDelayed = deviceStatus === 'delayed'
  const healthOk = (readings?.health ?? '').toLowerCase() === 'ok'
  const lastSeenSec = readings?.timestamp ?? 0
  const tsValid = lastSeenSec > 1577836800
  const secondsAgo = tsValid ? nowSec - lastSeenSec : Infinity
  const lastSeenLabel = formatSecondsAgo(secondsAgo, tsValid)
  const lastUpdated = readings?.timestamp != null && tsValid ? new Date(readings.timestamp * 1000).toLocaleTimeString() : null
  const showProTip = temp != null && !Number.isNaN(temp) && temp > 28

  const statusDescription: Record<DeviceStatus, string> = {
    live: `Receiving data — updated ${lastSeenLabel}`,
    delayed: `Last data ${lastSeenLabel} — device may be slow to respond`,
    offline: `Last seen ${lastSeenLabel} — device is not sending data`,
    syncing: resetRequestedAt > 0 ? 'Device is restarting into setup mode…' : 'Waiting for sensor data…',
    wifi_connected: 'Connected to WiFi — waiting for sensor data…',
    no_data: 'This device has never sent readings',
  }

  // ── Render ──
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.header
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-4 py-3 shadow-card backdrop-blur-md sm:px-6 sm:py-4"
          style={{ border: '1px solid rgba(27,47,39,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm"
              style={{ background: 'linear-gradient(135deg, #4a9b6d 0%, #2f6347 65%, #1c3d2c 100%)' }}
            >
              <PlantIcon className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="font-display text-lg font-bold tracking-tight text-forest sm:text-xl">Smart Plant Pro</h1>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden items-center gap-2 rounded-xl border border-forest/5 bg-surface px-3 py-1.5 sm:flex">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate text-xs text-forest-400">{user.displayName || user.email || 'Account'}</span>
              </div>
            )}
            <Link to="/claim" className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-xs"><PlusIcon className="h-3.5 w-3.5" /><span className="hidden sm:inline">Add device</span></Link>
            <button onClick={() => signOut()} className="btn-ghost flex items-center gap-1.5 !py-2 !px-3 !text-xs text-forest/45 hover:text-red-500"><LogoutIcon className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </motion.header>

        {myDevices.length === 0 ? (
          <motion.div variants={fadeSlideUp} initial="hidden" animate="visible" className="section-card flex flex-col items-center justify-center p-14 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-glow ring-1 ring-primary/10"><PlusIcon className="h-7 w-7 text-primary" /></div>
            <p className="mb-2 font-display text-lg font-bold text-forest">No devices yet</p>
            <p className="mb-6 text-sm text-forest-400">Add your first plant monitor to get started.</p>
            <Link to="/claim" className="btn-primary">Add a device</Link>
          </motion.div>
        ) : (
          <>
            <DeviceStatusBar
              devices={myDevices}
              selectedMac={selectedMac}
              onSelectMac={(mac) => { setSelectedMac(mac); localStorage.setItem(STORAGE_KEY, mac) }}
              onResetWiFi={handleResetDeviceWiFi}
              isResetPending={resetRequestedAt > 0}
              deviceStatus={deviceStatus}
              meta={meta}
              statusDescription={statusDescription[deviceStatus]}
              readings={readings}
              lastUpdated={lastUpdated}
            />

            {/* Reset guide */}
            {isResetGuide && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] bg-white p-6 shadow-card sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-forest">Device WiFi reset</h2>
                    <p className="text-sm text-forest-400">Your device is restarting into setup mode</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-forest-500">No data will appear here until the device reconnects to WiFi. Follow these steps:</p>
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
                      <div><p className="text-sm font-medium text-forest">{step.title}</p><p className="text-xs text-forest-400">{step.desc}</p></div>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                  <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" /></span>
                  <p className="text-sm text-forest-500">Waiting for device to reconnect…</p>
                </div>
                <button type="button" onClick={() => setResetRequestedAt(0)} className="mt-4 rounded-2xl border border-forest/10 bg-white px-4 py-2 text-sm font-medium text-forest-400 transition hover:bg-sage-50 hover:text-forest">Dismiss and show dashboard</button>
              </motion.div>
            )}

            {!isResetGuide && (<>
              <StatusBanners deviceStatus={deviceStatus} showSyncedBanner={showSyncedBanner} lastSeenLabel={lastSeenLabel} />

              {/* ── Orchestrated entrance: hero → alerts → sensors sequence ── */}
              <motion.div
                variants={orchestratedStagger}
                initial="hidden"
                animate="visible"
                className="space-y-0"
              >
                <motion.div variants={cardItem}>
                  <PlantHero
                    selectedMac={selectedMac}
                    plantName={currentPlant?.name ?? 'Your plant'}
                    plantType={currentPlant?.type ?? ''}
                    deviceStatus={deviceStatus}
                    dataUntrusted={dataUntrusted}
                    isDelayed={isDelayed}
                    health={readings?.health}
                    healthOk={healthOk}
                    onEditPlant={() => openEditPlant(linkedProfileId)}
                  />
                </motion.div>

                {/* Alert + notification toggle */}
                <motion.div variants={cardItem} className="mb-5 space-y-3">
                  {lastAlert && (
                    <div className="flex items-start gap-3 rounded-2xl border border-terracotta/18 bg-red-50/70 px-4 py-3.5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/12">
                        <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.008" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-forest">{lastAlert.message}</p>
                        {lastAlert.timestamp > 0 && <p className="mt-0.5 text-xs text-forest/40">{new Date(lastAlert.timestamp * 1000).toLocaleString()}</p>}
                      </div>
                      <button type="button" onClick={handleAckAlert} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-terracotta transition hover:bg-terracotta/10">Dismiss</button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-2xl border border-forest/5 bg-white/70 px-4 py-3">
                    <svg className="h-4 w-4 shrink-0 text-forest/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                    <span className="flex-1 text-xs text-forest-400">{'Notification' in window && Notification.permission === 'denied' ? 'Notifications blocked by browser' : 'Notify me when plant health drops'}</span>
                    <button type="button" onClick={handleToggleNotifications} disabled={'Notification' in window && Notification.permission === 'denied'} className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${notificationsEnabled ? 'bg-primary shadow-glow' : 'bg-forest/12'} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="Toggle browser notifications">
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </motion.div>

                <motion.div variants={cardItem}>
                  <SensorGrid
                    deviceStatus={deviceStatus}
                    dataUntrusted={dataUntrusted}
                    isDelayed={isDelayed}
                    displayTemp={displayTemp}
                    temp={temp}
                    displayGaugePct={displayGaugePct}
                    soilLabel={soilLabel}
                    readings={readings}
                    selectedMac={selectedMac}
                  />
                </motion.div>
              </motion.div>

              {/* History chart — scroll-triggered */}
              {selectedMac && !dataUntrusted && (
                <motion.div
                  variants={scrollReveal}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                >
                  <HistoryChart deviceMac={selectedMac} />
                </motion.div>
              )}

              {/* Pump control */}
              <motion.div
                variants={scrollReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                className="mt-5 flex items-center gap-4 section-card !p-5"
              >
                <div className={`icon-pill shrink-0 transition-all duration-300 ${pumpActive ? '!bg-primary/18 ring-1 ring-primary/20' : ''}`}>
                  <svg className={`h-5 w-5 transition-colors duration-300 ${pumpActive ? 'text-primary' : 'text-forest/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-forest">Water pump</p>
                  <p className="mt-0.5 text-xs text-forest-400">{pumpActive ? 'Pump is running…' : 'Send a manual watering pulse to the device.'}</p>
                </div>
                <button type="button" onClick={handleTriggerPump} disabled={pumpCooldown || dataUntrusted} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${pumpActive ? 'bg-primary/12 text-primary ring-1 ring-primary/20' : pumpCooldown ? 'bg-forest/5 text-forest/30' : 'btn-primary !rounded-xl'} disabled:opacity-50`}>
                  {pumpActive ? 'Running…' : pumpCooldown ? 'Sent ✓' : 'Water now'}
                </button>
              </motion.div>

              {showProTip && (
                <motion.div
                  variants={scrollReveal}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="mt-5 rounded-2xl border border-amber-200/50 bg-amber-50/60 p-4"
                >
                  <p className="text-sm font-semibold text-amber-700">Pro tip</p>
                  <p className="mt-1 text-sm text-forest-500">Temperature is above 28 °C. Consider lowering the target moisture threshold so the plant doesn't get overwatered in the heat.</p>
                </motion.div>
              )}

              {/* ── Collapsible settings (Animate-UI accordion style) ── */}
              <motion.div
                variants={scrollReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                className="mt-6 space-y-3"
              >
                <CollapsibleSection title="Target moisture" subtitle={`Current: ${targetSoil}`} defaultOpen>
                  <p className="mb-4 text-sm text-forest-400">Soil raw below this value = "wet enough". Drag to set.</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <input type="range" min={0} max={4095} value={targetSoil} onChange={(e) => { const v = Number(e.target.value); setTargetSoil(v); setTargetSoilInput(String(v)) }} className="moisture-slider min-w-0 flex-1" aria-label="Target moisture raw value" />
                    <span className="w-16 text-right font-display text-xl font-bold tabular-nums text-forest">{targetSoil}</span>
                    <button onClick={handleSaveTarget} className="btn-primary">Save</button>
                  </div>
                  <p className="mt-3 text-xs text-forest/35">Pump control is optional. When enabled, the device pulses the pump until soilRaw ≤ target.</p>
                </CollapsibleSection>

                <CollapsibleSection title="Calibrate soil sensor" subtitle={calibration.boneDry != null ? `Dry: ${calibration.boneDry} · Wet: ${calibration.submerged ?? '—'}` : 'Not calibrated'}>
                  <p className="mb-3 text-sm text-forest-400">Mark one dry and one wet reading so the gauge uses your exact sensor range. Current raw: <span className="font-mono font-medium text-forest">{readings?.soilRaw ?? '—'}</span></p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleMarkDry} disabled={readings?.soilRaw == null} className="btn-ghost disabled:opacity-40">Mark as dry</button>
                    <button type="button" onClick={handleMarkWet} disabled={readings?.soilRaw == null} className="btn-ghost disabled:opacity-40">Mark as wet</button>
                    {(calibration.boneDry != null || calibration.submerged != null) && (
                      <span className="rounded-lg bg-surface px-2.5 py-1 text-xs text-forest-400">
                        Dry: <span className="font-mono font-medium">{calibration.boneDry ?? '—'}</span> · Wet: <span className="font-mono font-medium">{calibration.submerged ?? '—'}</span>
                      </span>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Plant profiles" subtitle={`${Object.keys(profiles).length} profile${Object.keys(profiles).length !== 1 ? 's' : ''}`}>
                  <p className="mb-4 text-sm text-forest-400">Add profiles for different plants. Link one to this device to track its name and type.</p>
                  <form onSubmit={addNewProfile} className="mb-4 flex flex-wrap items-center gap-2">
                    <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Plant name" className="input-field" />
                    <select value={newProfilePresetId ?? ''} onChange={(e) => { const id = e.target.value || null; setNewProfilePresetId(id); setNewProfileType(id ? EXAMPLE_PLANTS.find((p) => p.id === id)?.label ?? '' : '') }} className="input-field">
                      <option value="">— Example plant —</option>
                      {EXAMPLE_PLANTS.map((p) => <option key={p.id} value={p.id}>{p.label} (target {p.targetSoil})</option>)}
                    </select>
                    <input type="text" value={newProfileType} onChange={(e) => setNewProfileType(e.target.value)} placeholder="Type" className="min-w-[120px] input-field" />
                    <button type="submit" className="btn-primary">Add profile</button>
                  </form>
                  {Object.keys(profiles).length === 0 ? (
                    <p className="text-xs text-forest/35">No plant profiles yet. Add one above.</p>
                  ) : (
                    <ul className="space-y-2">
                      {Object.entries(profiles).sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).map(([id, p]) => (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest/8 bg-surface/60 px-4 py-3 transition-colors hover:bg-white/80">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-forest">{p.name}</span>
                            {p.type && p.type !== '—' && <span className="rounded-md bg-sage-100 px-2 py-0.5 text-xs text-forest-400">{p.type}</span>}
                            {linkedProfileId === id && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Linked</span>}
                          </div>
                          <div className="ml-auto flex items-center gap-1">
                            {linkedProfileId !== id && selectedMac && <button type="button" onClick={() => linkProfileToDevice(id)} className="rounded-xl bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/22">Use for device</button>}
                            <button type="button" onClick={() => openEditPlant(id)} className="rounded-full p-1.5 text-forest/40 transition hover:bg-sage-100 hover:text-forest" aria-label="Edit profile"><PencilIcon className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => deleteProfile(id)} className="rounded-full px-2 py-1 text-xs text-terracotta/70 transition hover:bg-red-50 hover:text-terracotta">Remove</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>
              </motion.div>
            </>)}
          </>
        )}

        {/* Edit plant modal */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/25 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="edit-plant-title" onClick={closeEditPlant}>
            <motion.div variants={fadeScale} initial="hidden" animate="visible" exit="exit" className="glass-card-solid w-full max-w-sm rounded-3xl p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="edit-plant-title" className="mb-4 text-lg font-semibold text-forest">{editingProfileId ? 'Edit plant' : 'Add plant'}</h2>
              <div className="mb-4 space-y-3">
                <label className="block text-sm font-medium text-forest-600">
                  Name
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Living room Monstera" className="mt-1 w-full input-field" />
                </label>
                <label className="block text-sm font-medium text-forest-600">
                  Example plant (sets type & target moisture)
                  <select value={editPresetId ?? ''} onChange={(e) => { const id = e.target.value || null; setEditPresetId(id); const preset = id ? EXAMPLE_PLANTS.find((p) => p.id === id) : null; setEditForm((f) => ({ ...f, type: preset ? preset.label : f.type })) }} className="mt-1 w-full input-field">
                    <option value="">— Custom —</option>
                    {EXAMPLE_PLANTS.map((p) => <option key={p.id} value={p.id}>{p.label} (target {p.targetSoil})</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-forest-600">
                  Type
                  <input type="text" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. Monstera, Succulent" className="mt-1 w-full input-field" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeEditPlant} className="flex-1 btn-ghost">Cancel</button>
                <button type="button" onClick={() => saveEditPlant(!editingProfileId)} className="flex-1 btn-primary">{editingProfileId ? 'Save' : 'Save & link'}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invite section — collapsible, scroll-triggered */}
        <motion.div
          variants={scrollReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-8 mb-8"
        >
          <CollapsibleSection title="Invite user" subtitle={invitedList.length > 0 ? `${invitedList.length} invited` : 'Share access'}>
            <p className="mb-4 text-sm text-forest-400">Share the app link. New users sign up with email and password, then can claim their own devices.</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input type="text" readOnly value={appUrl} className="min-w-0 flex-1 input-field font-mono !text-xs" />
              <button type="button" onClick={handleCopyUrl} className="btn-ghost">{copyOk ? '✓ Copied' : 'Copy link'}</button>
            </div>
            <form onSubmit={handleInvite} className="mb-3 flex flex-wrap items-center gap-2">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email to add to invite list" className="input-field" />
              <button type="submit" className="btn-primary">Invite</button>
            </form>
            {invitedList.length > 0 && <p className="text-xs text-forest/40">Invited: {invitedList.join(', ')}</p>}
          </CollapsibleSection>
        </motion.div>
      </div>
    </div>
  )
}
