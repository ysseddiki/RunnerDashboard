import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { apiFetch, logout } from '../auth'
import { useAuth } from '../authContext'
import type { HealthResponse } from '../types'

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-4.25v-6h-4.5v6H5.5a1 1 0 0 1-1-1v-9.5Z"
      />
    </svg>
  )
}

function IconActivities({ active }: { active?: boolean }) {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M5 7.5h14M5 12h14M5 16.5h10"
      />
      {active ? <circle cx="18.5" cy="16.5" r="1.6" fill="currentColor" /> : null}
    </svg>
  )
}

function IconPredictions({ active }: { active?: boolean }) {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 16.5 9 11l3.5 3.5L19.5 7.5"
      />
      <path
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        d="M16.5 7.5h3v3"
      />
    </svg>
  )
}

function IconCoach({ active }: { active?: boolean }) {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        d="M5 6.5h14a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H10l-3.5 2.5V16H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z"
      />
    </svg>
  )
}

function IconMore({ open }: { open?: boolean }) {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.5" cy="12" r={open ? 1.7 : 1.45} fill="currentColor" />
      <circle cx="12" cy="12" r={open ? 1.7 : 1.45} fill="currentColor" />
      <circle cx="17.5" cy="12" r={open ? 1.7 : 1.45} fill="currentColor" />
    </svg>
  )
}

export function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const morePanelId = useId()
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (user?.role !== 'admin') return
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
  }, [user?.role])

  useEffect(() => {
    if (!moreOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
      setUser(null)
      setMoreOpen(false)
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  const displayName =
    user?.display_name ||
    [user?.firstname, user?.lastname].filter(Boolean).join(' ') ||
    'Athlète'

  const moreActive =
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/docs') ||
    location.pathname.startsWith('/admin')

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand-btn" end aria-label="RunningDashboard — Accueil">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">RunningDashboard</span>
        </NavLink>
        <nav className="nav nav-desktop" aria-label="Navigation principale">
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

        <div className="topbar-aside topbar-aside-desktop">
          <div className="topbar-status" aria-label="Compte">
            <span className="status-pill compact" title={displayName}>
              <span className="status-dot on" />
              <span className="status-pill-text">{displayName}</span>
            </span>
            {user?.role === 'admin' && health && (
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
            {loggingOut ? '…' : 'Déconnexion'}
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      {moreOpen ? (
        <button
          type="button"
          className="bottom-nav-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      <div className={`bottom-nav-sheet${moreOpen ? ' is-open' : ''}`} id={morePanelId} hidden={!moreOpen}>
        <div className="bottom-nav-sheet-handle" aria-hidden="true" />
        <p className="bottom-nav-sheet-title">{displayName}</p>
        <nav className="bottom-nav-sheet-links" aria-label="Plus d’options">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? 'bottom-nav-sheet-link active' : 'bottom-nav-sheet-link'
            }
            onClick={() => setMoreOpen(false)}
          >
            Profil
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }) =>
              isActive ? 'bottom-nav-sheet-link active' : 'bottom-nav-sheet-link'
            }
            onClick={() => setMoreOpen(false)}
          >
            Docs
          </NavLink>
          {user?.role === 'admin' ? (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? 'bottom-nav-sheet-link active' : 'bottom-nav-sheet-link'
              }
              onClick={() => setMoreOpen(false)}
            >
              Admin
              {health ? <span className="bottom-nav-sheet-meta">API · {health.palier}</span> : null}
            </NavLink>
          ) : null}
          <button
            type="button"
            className="bottom-nav-sheet-link is-action"
            onClick={() => void onLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? 'Déconnexion…' : 'Déconnexion'}
          </button>
        </nav>
      </div>

      <nav className="bottom-nav" aria-label="Navigation mobile">
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? 'bottom-nav-link active' : 'bottom-nav-link')}
        >
          {({ isActive }) => (
            <>
              <IconHome active={isActive} />
              <span>Accueil</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/activities"
          className={({ isActive }) => (isActive ? 'bottom-nav-link active' : 'bottom-nav-link')}
        >
          {({ isActive }) => (
            <>
              <IconActivities active={isActive} />
              <span>Sorties</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/predictions"
          className={({ isActive }) => (isActive ? 'bottom-nav-link active' : 'bottom-nav-link')}
        >
          {({ isActive }) => (
            <>
              <IconPredictions active={isActive} />
              <span>Prévisions</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/coach"
          className={({ isActive }) => (isActive ? 'bottom-nav-link active' : 'bottom-nav-link')}
        >
          {({ isActive }) => (
            <>
              <IconCoach active={isActive} />
              <span>Coach</span>
            </>
          )}
        </NavLink>
        <button
          ref={moreButtonRef}
          type="button"
          className={`bottom-nav-link bottom-nav-more${moreOpen || moreActive ? ' active' : ''}`}
          aria-expanded={moreOpen}
          aria-controls={morePanelId}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <IconMore open={moreOpen} />
          <span>Plus</span>
        </button>
      </nav>
    </div>
  )
}
