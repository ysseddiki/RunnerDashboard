import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { HealthResponse, StravaStatus } from '../types'

export function Layout() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetch('/api/health'), fetch('/api/strava/status')])
      .then(async ([healthRes, statusRes]) => {
        if (!healthRes.ok || !statusRes.ok) return
        const [h, s] = await Promise.all([
          healthRes.json() as Promise<HealthResponse>,
          statusRes.json() as Promise<StravaStatus>,
        ])
        if (cancelled) return
        setHealth(h)
        setStrava(s)
      })
      .catch(() => {
        /* statut non bloquant */
      })
    return () => {
      cancelled = true
    }
  }, [])

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
            Prévisions
          </NavLink>
          <NavLink
            to="/coach"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Coach
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
            <span
              className="status-pill compact"
              title={
                strava?.connected
                  ? `Strava connecté${strava.athlete_name ? ` — ${strava.athlete_name}` : ''}`
                  : 'Strava déconnecté'
              }
            >
              <span className={`status-dot ${strava?.connected ? 'on' : ''}`} />
              <span className="status-pill-text">
                {strava?.connected ? 'Strava' : 'Strava off'}
              </span>
            </span>
            {health && (
              <span
                className="status-pill compact"
                title={`API ${health.status} · ${health.palier} · ${health.version}`}
              >
                <span className={`status-dot ${health.status === 'ok' ? 'on' : ''}`} />
                <span className="status-pill-text">
                  API · {health.palier}
                </span>
              </span>
            )}
          </div>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-admin active' : 'nav-link nav-admin'
            }
          >
            Admin
          </NavLink>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
