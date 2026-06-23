import { NavLink, Outlet } from 'react-router-dom'

function navClass({ isActive }: { isActive: boolean }) {
  return `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-base-200">
      <header className="navbar border-b border-base-300 bg-base-100 shadow-md">
        <div className="navbar-start">
          <span className="btn btn-ghost pointer-events-none text-xl font-bold">
            Chess Blunder Bank
          </span>
        </div>
        <div className="navbar-end w-full flex-1 justify-end">
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Import
            </NavLink>
            <NavLink to="/list" className={navClass}>
              List
            </NavLink>
            <NavLink to="/review" className={navClass}>
              Review
            </NavLink>
            <NavLink to="/mates" className={navClass}>
              Mates
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
