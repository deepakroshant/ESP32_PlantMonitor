import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, set, get, onValue } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

const ONLINE_THRESHOLD_SEC = 2 * 60

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

  useEffect(() => {
    const deviceListRef = ref(firebaseDb, 'deviceList')
    const unsub = onValue(deviceListRef, (snap) => {
      const val = snap.val()
      if (!val || typeof val !== 'object') { setDevices([]); return }
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
    setError(''); setSuccess('')
    const normalized = macToClaim.trim().toUpperCase().replace(/-/g, ':')
    if (!normalized.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)) {
      setError('Invalid MAC address format'); return
    }
    if (!user) return
    try {
      const userDevicesPath = `users/${user.uid}/devices/${normalized}`
      const existing = await get(ref(firebaseDb, userDevicesPath))
      if (existing.exists()) {
        setSuccess('Device already claimed. Going to dashboard…')
        setTimeout(() => navigate('/'), 1500); return
      }
      await set(ref(firebaseDb, userDevicesPath), { claimedAt: Date.now() })
      await set(ref(firebaseDb, `deviceList/${normalized}/claimedBy`), user.uid)
      setSuccess('Device claimed! Going to dashboard…')
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
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-forest">Add device</h1>
            <p className="mt-1 text-sm text-forest/45">Claim an ESP32 plant monitor to your account</p>
          </div>
          <button type="button" onClick={() => navigate('/')} className="btn-ghost">
            Dashboard
          </button>
        </header>

        {/* Discover devices */}
        <section className="section-card mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <svg className="h-4.5 w-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-forest">Discover devices</h2>
              <p className="text-xs text-forest/45">Online = seen in last 2 min. Claim available devices below.</p>
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-forest/10 bg-surface/60 p-6 text-center">
              <p className="text-sm text-forest/40">No devices found yet. Power on an ESP32 and wait for it to sync.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => {
                const isOnline = d.lastSeen != null && nowSec - d.lastSeen <= ONLINE_THRESHOLD_SEC
                const isYours = d.claimedBy === user?.uid
                const isClaimedByOther = d.claimedBy != null && d.claimedBy !== user?.uid
                const isAvailable = !d.claimedBy
                return (
                  <li
                    key={d.mac}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/5 bg-white/60 px-4 py-3 transition ${
                      isClaimedByOther ? 'opacity-50' : 'hover:bg-white/80 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-primary' : 'bg-forest/20'}`} />
                      <span className="font-mono text-sm text-forest">{d.mac}</span>
                      <span className={`text-[11px] font-medium uppercase tracking-wider ${isOnline ? 'text-primary' : 'text-forest/30'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAvailable && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                          Available
                        </span>
                      )}
                      {isYours && (
                        <span className="rounded-full bg-mint-dark px-2.5 py-0.5 text-[11px] font-semibold text-forest/70">
                          Yours
                        </span>
                      )}
                      {isClaimedByOther && (
                        <span className="text-[11px] text-forest/35">Claimed</span>
                      )}
                      {isAvailable && (
                        <button type="button" onClick={() => handleClaim(d.mac)} className="btn-primary !py-1.5 !px-3 !text-xs">
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

        {/* Manual entry */}
        <section className="section-card">
          <h2 className="stat-label mb-3">Or enter MAC manually</h2>
          <p className="mb-4 text-sm text-forest/45">
            Find the MAC in Serial Monitor: "Device ID (MAC): …"
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={mac}
              onChange={(e) => setMac(e.target.value)}
              placeholder="D4:E9:F4:BD:36:CC"
              className="input-field font-mono"
            />
            {error && <p className="text-sm text-terracotta">{error}</p>}
            {success && <p className="text-sm font-medium text-primary">{success}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Claim</button>
              <button type="button" onClick={() => navigate('/')} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
