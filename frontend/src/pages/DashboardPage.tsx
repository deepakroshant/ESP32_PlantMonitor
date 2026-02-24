import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ref, onValue, set } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { soilStatus, soilStatusLabel, soilStatusBadgeClass, soilRawToGauge } from '../utils/soil'

type Readings = {
  temperature?: number
  soilRaw?: number
  lightBright?: boolean
  pumpRunning?: boolean
  health?: string
  timestamp?: number
}

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

  const soil = readings?.soilRaw != null ? soilStatus(readings.soilRaw) : null
  const soilLabel = soil != null ? soilStatusLabel(soil) : '—'
  const soilBadgeClass = soil != null ? soilStatusBadgeClass(soil) : ''
  const gaugePct = readings?.soilRaw != null ? soilRawToGauge(readings.soilRaw) * 100 : 0
  const temp = readings?.temperature
  const showProTip = temp != null && !Number.isNaN(temp) && temp > 28
  const healthOk = (readings?.health ?? '').toLowerCase() === 'ok'
  const lastUpdated = readings?.timestamp != null
    ? new Date(readings.timestamp * 1000).toLocaleTimeString()
    : null

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Smart Plant Pro
          </h1>
          <div className="flex items-center gap-2">
            <Link
              to="/claim"
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Claim device
            </Link>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </header>

        {myDevices.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-8 text-center shadow-lg">
            <p className="text-slate-400">No devices claimed yet.</p>
            <Link
              to="/claim"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-500"
            >
              Claim a device
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Device
              </label>
              <select
                value={selectedMac}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedMac(v)
                  localStorage.setItem(STORAGE_KEY, v)
                }}
                className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 font-mono text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {myDevices.map((mac) => (
                  <option key={mac} value={mac}>
                    {mac}
                  </option>
                ))}
              </select>
            </div>

            {lastUpdated && (
              <p className="mb-4 text-xs text-slate-500">
                Last reading: {lastUpdated}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Temperature
                </p>
                <p className="text-3xl font-semibold tabular-nums text-slate-100">
                  {temp != null && !Number.isNaN(temp)
                    ? `${temp.toFixed(1)} °C`
                    : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm lg:col-span-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Soil moisture
                </p>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-slate-100">
                    {readings?.soilRaw != null ? readings.soilRaw : '—'}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${soilBadgeClass}`}
                  >
                    {soilLabel}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${gaugePct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Dry ← moisture → Wet
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Light
                </p>
                <p className="text-xl font-semibold text-slate-100">
                  {readings?.lightBright === true
                    ? 'Bright'
                    : readings?.lightBright === false
                      ? 'Dim'
                      : '—'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Health
              </p>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  healthOk
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                }`}
              >
                {readings?.health ?? '—'}
              </span>
            </div>

            {showProTip && (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
                <p className="text-sm font-medium text-amber-200">
                  Pro tip
                </p>
                <p className="mt-1 text-sm text-amber-200/90">
                  Temperature is above 28 °C. Consider lowering the target moisture threshold so the plant doesn’t get overwatered in the heat.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                Target moisture (raw threshold)
              </p>
              <p className="mb-3 text-sm text-slate-400">
                Soil raw below this = “wet enough”. Current target: {targetSoil}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={4095}
                  value={targetSoilInput}
                  onChange={(e) => setTargetSoilInput(e.target.value)}
                  className="w-28 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  onClick={handleSaveTarget}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  Save
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Pump control is optional (no hardware). When enabled, the device pulses the pump until soilRaw ≤ target.
              </p>
            </div>
          </>
        )}

        {/* Invite user section */}
        <section className="mt-10 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">
            Invite user
          </h2>
          <p className="mb-3 text-sm text-slate-400">
            Share the app link. New users sign up with email and password, then can claim their own devices.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={appUrl}
              className="flex-1 min-w-0 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
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
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Add to invite list
            </button>
          </form>
          {invitedList.length > 0 && (
            <p className="text-xs text-slate-500">
              Invited: {invitedList.join(', ')} (they still need to sign up at the link above).
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
