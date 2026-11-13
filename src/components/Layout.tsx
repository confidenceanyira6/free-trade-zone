import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Globe2, Menu, X } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { session, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const links = [
    ['/marketplace', 'Marketplace'],
    ['/rfqs', 'RFQs'],
    ...(session ? [['/dashboard', 'Dashboard'], ['/orders', 'Orders'], ['/messages', 'Messages']] : []),
    ...(isAdmin ? [['/admin', 'Admin']] : []),
  ]
  const cls = ({ isActive }: { isActive: boolean }) => `text-sm font-medium ${isActive ? 'text-emerald' : 'text-white/90 hover:text-white'}`
  return (
    <div className="min-h-screen">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-white"><Globe2 className="text-emerald" /> Saage Free Trade Zone</Link>
          <nav className="hidden items-center gap-6 md:flex">
            {links.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
            {session
              ? <button className="text-sm text-white/90" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
              : <Link to="/login" className="rounded-lg bg-emerald px-3 py-1.5 text-sm font-semibold text-white">Sign in</Link>}
          </nav>
          <button className="text-white md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <nav className="flex flex-col gap-3 px-4 pb-4 md:hidden" onClick={() => setOpen(false)}>
            {links.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
            {session ? <button className="text-left text-sm text-white/90" onClick={() => signOut()}>Sign out</button> : <NavLink to="/login" className={cls}>Sign in</NavLink>}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
      <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-muted">
        Saage Free Trade Zone is a trade marketplace. It is not a bank and does not hold customer funds. Payments are processed by approved providers.
      </footer>
    </div>
  )
}
