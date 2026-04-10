import { NavLink, Outlet } from 'react-router-dom'

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  fontWeight: isActive ? 700 : 500,
  textDecoration: isActive ? 'underline' : 'none',
})

export function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <strong className="brand">Sjakkfeil</strong>
        <nav className="nav">
          <NavLink to="/" end style={linkStyle}>
            Import
          </NavLink>
          <NavLink to="/liste" style={linkStyle}>
            Liste
          </NavLink>
          <NavLink to="/gjennomgang" style={linkStyle}>
            Gjennomgang
          </NavLink>
          <NavLink to="/innstillinger" style={linkStyle}>
            Innstillinger
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
