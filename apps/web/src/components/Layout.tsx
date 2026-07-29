import { NavLink, Outlet } from 'react-router-dom'

export function Layout() {
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
            to="/admin"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Admin
          </NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
