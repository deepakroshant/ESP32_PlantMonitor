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
    <div className="min-h-screen bg-surface p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between border-b border-forest/10 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-forest">Claim device</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full border border-forest/10 bg-white px-4 py-2 text-sm font-medium text-forest shadow-card transition hover:bg-mint/50"
          >
            Dashboard
          </button>
        </header>

        {/* Discover devices - always at top so it's visible */}
        <section
          id="discover-devices"
          className="mb-8 min-h-[120px] rounded-[32px] bg-white p-5 shadow-card"
          aria-label="Discover devices"
        >
          <h2 className="mb-1 text-base font-semibold text-forest">
            Discover devices
          </h2>
          <p className="mb-4 text-sm text-forest/70">
            Devices that have recently synced appear here. Online = seen in the last 2 minutes. Claim only available devices.
          </p>
          {devices.length === 0 ? (
            <p className="rounded-2xl border border-forest/10 bg-mint/30 p-4 text-center text-sm text-forest/70">
              No devices seen yet. Power on an ESP32 with updated firmware and wait for it to sync, or enter a MAC in the form below.
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
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3 transition hover:bg-mint/30 ${
                      greyedOut ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          isOnline ? 'bg-primary' : 'bg-forest/30'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                      <span className="font-mono text-sm text-forest">{d.mac}</span>
                      <span className="text-xs text-forest/60">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAvailable && (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Available
                        </span>
                      )}
                      {isYours && (
                        <span className="rounded-full border border-primary/40 bg-mint px-2 py-0.5 text-xs font-medium text-forest">
                          Yours
                        </span>
                      )}
                      {isClaimedByOther && (
                        <span className="rounded-full border border-forest/20 bg-forest/5 px-2 py-0.5 text-xs font-medium text-forest/60">
                          Claimed by someone else
                        </span>
                      )}
                      {isAvailable && (
                        <button
                          type="button"
                          onClick={() => handleClaim(d.mac)}
                          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
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
              <label htmlFor="mac" className="block text-sm font-medium text-forest/80">
                Device MAC
              </label>
              <input
                id="mac"
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="D4:E9:F4:BD:36:CC"
                className="mt-1.5 w-full rounded-2xl border border-forest/10 bg-white px-3 py-2 font-mono text-forest placeholder-forest/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {error && <p className="text-sm text-terracotta">{error}</p>}
            {success && <p className="text-sm text-primary">{success}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-2xl bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
              >
                Claim
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-2xl border border-forest/10 bg-mint/50 px-4 py-2 text-forest transition hover:bg-mint focus:outline-none focus:ring-2 focus:ring-primary/20"
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
