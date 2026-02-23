import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, set, get } from 'firebase/database'
import { firebaseDb } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export function ClaimDevicePage() {
  const [mac, setMac] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const normalized = mac.trim().toUpperCase().replace(/-/g, ':')
    if (!normalized.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)) {
      setError('Enter a valid MAC (e.g. D4:E9:F4:BD:36:CC)')
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
      setSuccess('Device claimed. Going to dashboard…')
      setTimeout(() => navigate('/'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Claim failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="mb-2 text-xl font-semibold text-slate-100">
          Claim device
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Enter the device MAC (from Serial Monitor: “Device ID (MAC): …”).
        </p>
        <form onSubmit={handleClaim} className="space-y-4">
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
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Claim
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
