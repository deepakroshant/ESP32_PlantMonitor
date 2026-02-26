import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <svg className="h-7 w-7 animate-pulse text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10" />
            <path d="M12 10c-2.5 0-5 1.5-6 4-.4.8 0 1.6.6 2 1.5.8 3.4.2 4.6-1.2" />
            <path d="M12 10c2.5 0 5 1.5 6 4 .4.8 0 1.6-.6 2-1.5.8-3.4.2-4.6-1.2" />
          </svg>
        </div>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-forest/5">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/40" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
