import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Outlet } from 'react-router-dom'
import { db } from '../db'

function navClass({ isActive }: { isActive: boolean }) {
  return `flex flex-1 items-center justify-center gap-2 border-b-2 px-2.5 py-2.5 text-sm font-medium md:flex-none md:justify-between md:rounded-sm md:border-b-0 md:border-l-2 ${
    isActive
      ? 'border-primary bg-base-100 text-base-content'
      : 'border-transparent text-base-content/60 hover:text-base-content'
  }`
}

function NavCount({ value }: { value: number | undefined }) {
  if (!value) return null
  return <span className="hidden font-mono text-xs font-normal md:inline">{value}</span>
}

export function Layout() {
  const counts = useLiveQuery(async () => {
    const [mistakes, mates, toReview, matesToTrain] = await Promise.all([
      db.mistakes.count(),
      db.missedMates.count(),
      db.mistakes.filter((m) => m.reviewed === false).count(),
      db.missedMates.filter((m) => m.reviewed === false).count(),
    ])
    return { all: mistakes + mates, toReview, matesToTrain }
  }, [])

  return (
    <div className="min-h-screen bg-base-200 md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
      <header className="flex flex-col gap-2.5 border-b border-base-300 bg-neutral px-4 pt-3.5 md:sticky md:top-0 md:h-screen md:gap-7 md:border-r md:border-b-0 md:py-5">
        <div className="font-display text-[17px] leading-tight font-bold tracking-wide">
          Chess <span className="text-primary md:block">Blunder Bank</span>
        </div>
        <nav aria-label="Main" className="flex md:flex-col md:gap-0.5">
          <NavLink to="/" end className={navClass}>
            Import
          </NavLink>
          <NavLink to="/list" className={navClass}>
            List
            <NavCount value={counts?.all} />
          </NavLink>
          <NavLink to="/review" className={navClass}>
            Review
            <NavCount value={counts?.toReview} />
          </NavLink>
          <NavLink to="/mates" className={navClass}>
            Mates
            <NavCount value={counts?.matesToTrain} />
          </NavLink>
        </nav>
      </header>
      <main className="bg-ruled min-w-0 p-4 md:px-7 md:py-6">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
