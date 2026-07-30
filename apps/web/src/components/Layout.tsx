import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { apiFetch, logout } from '../auth'
import { useAuth } from '../authContext'
import type { HealthResponse } from '../types'

export function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    void apiFetch('/api/health')
      .then(async (healthRes) => {
        if (!healthRes.ok) return
        const h = (await healthRes.json()) as HealthResponse
        if (!cancelled) setHealth(h)
      })
      .catch(() => {
        /* statut non bloquant */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
      setUser(null)
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  const displayName =
    user?.display_name ||
    [user?.firstname, user?.lastname].filter(Boolean).join(' ') ||
    'Athlète'

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand-btn" end>
          <span className="brand-mark" aria-hidden="true" />
          RunningDashboard
        </NavLink>
        <nav className="nav" aria-label="Navigation principale">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} end>
            Accueil
          </NavLink>
          <NavLink
            to="/activities"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Activités
          </NavLink>
          <NavLink
            to="/predictions"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Prévisions & bilan
          </NavLink>
          <NavLink
            to="/coach"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Coach
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Profil
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Docs
          </NavLink>
        </nav>

        <div className="topbar-aside">
          <div className="topbar-status" aria-label="État système">
            <span className="status-pill compact" title={displayName}>
              <span className="status-dot on" />
              <span className="status-pill-text">{displayName}</span>
            </span>
            {health && (
              <span
                className="status-pill compact"
                title={`API ${health.status} · ${health.palier} · ${health.version}`}
              >
                <span className={`status-dot ${health.status === 'ok' ? 'on' : ''}`} />
                <span className="status-pill-text">API · {health.palier}</span>
              </span>
            )}
          </div>
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? 'nav-link nav-admin active' : 'nav-link nav-admin'
              }
            >
              Admin
            </NavLink>
          )}
          <button
            type="button"
            className="btn ghost compact"
            onClick={() => void onLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? '…' : 'Logout'}
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
