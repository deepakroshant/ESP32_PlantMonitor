import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, set, get, onValue } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

const ONLINE_THRESHOLD_SEC = 2 * 60 // 2 minutes

type DeviceEntry = {
  mac: string
  lastSeen: number | null
  claimedBy: string | null
}

export function ClaimDevicePage() {
  const [mac, setMac] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const { user } = useAuth()
  const navigate = useNavigate()

  // Live list of devices (deviceList from ESP32 + claimedBy from claim flow)
  useEffect(() => {
    const deviceListRef = ref(firebaseDb, 'deviceList')
    const unsub = onValue(deviceListRef, (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') {
        setDevices([])
        return
      }
      const nowSec = Math.floor(Date.now() / 1000)
      const list: DeviceEntry[] = Object.entries(val).map(([macKey, data]) => {
        const d = data as { lastSeen?: number; claimedBy?: string | null }
        return {
          mac: macKey,
          lastSeen: typeof d.lastSeen === 'number' ? d.lastSeen : null,
          claimedBy: d.claimedBy ?? null,
        }
      })
      setDevices(list)
    })
    return () => unsub()
  }, [])

  async function handleClaim(macToClaim: string) {
    setError('')
    setSuccess('')
    const normalized = macToClaim.trim().toUpperCase().replace(/-/g, ':')
    if (!normalized.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)) {
      setError('Invalid MAC address')
      return
    }
    if (!user) return

    try {
      const userDevicesPath = `users/${user.uid}/devices/${normalized}`
      const existing = await get(ref(firebaseDb, userDevicesPath))
      if (existing.exists()) {
        setSuccess('Device already claimed. Going to dashboard…')
        setTimeout(() => navigate('/'), 1500)
        return
      }
      await set(ref(firebaseDb, userDevicesPath), { claimedAt: Date.now() })
      await set(ref(firebaseDb, `deviceList/${normalized}/claimedBy`), user.uid)
      setSuccess('Device claimed. Going to dashboard…')
      setTimeout(() => navigate('/'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Claim failed')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await handleClaim(mac)
  }

  const nowSec = Math.floor(Date.now() / 1000)

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between border-b border-slate-700/80 pb-4">
          <h1 className="text-xl font-semibold text-slate-100">Claim device</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Dashboard
          </button>
        </header>

        {/* Discover devices */}
        <section className="mb-8 rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">
            Discover devices
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Devices that have recently synced appear here. Online = seen in the last 2 minutes. Claim only available devices.
          </p>
          {devices.length === 0 ? (
            <p className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-center text-sm text-slate-500">
              No devices seen yet. Power on an ESP32 and wait for it to sync, or enter a MAC below.
            </p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => {
                const isOnline = d.lastSeen != null && nowSec - d.lastSeen <= ONLINE_THRESHOLD_SEC
                const isYours = d.claimedBy === user?.uid
                const isClaimedByOther = d.claimedBy != null && d.claimedBy !== user?.uid
                const isAvailable = !d.claimedBy
                const greyedOut = isClaimedByOther

                return (
                  <li
                    key={d.mac}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-3 ${
                      greyedOut ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                      <span className="font-mono text-sm text-slate-200">{d.mac}</span>
                      <span className="text-xs text-slate-500">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAvailable && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          Available
                        </span>
                      )}
                      {isYours && (
                        <span className="rounded-full border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300">
                          Yours
                        </span>
                      )}
                      {isClaimedByOther && (
                        <span className="rounded-full border border-slate-500/40 bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-400">
                          Claimed by someone else
                        </span>
                      )}
                      {isAvailable && (
                        <button
                          type="button"
                          onClick={() => handleClaim(d.mac)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Manual MAC entry */}
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">
            Or enter MAC manually
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            From Serial Monitor: “Device ID (MAC): …”
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="mac" className="block text-sm text-slate-400">
                Device MAC
              </label>
              <input
                id="mac"
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="D4:E9:F4:BD:36:CC"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-emerald-400">{success}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Claim
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
