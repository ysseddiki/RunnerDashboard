import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchMe, type AuthUser } from './auth'
import { AuthContext, useAuth } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (user === undefined) {
    return (
      <div className="auth-boot">
        <p>Chargement…</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}
