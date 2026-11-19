import { ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { MENU, NAV, useRole } from '../lib/roles'
import { Logo } from './Logo'

// Every screen renders inside a phone-shaped frame (full screen on phones).
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-slate-200 md:flex md:items-center md:justify-center md:py-6">
    <div className="relative flex min-h-screen w-full max-w-[430px] flex-col bg-white md:h-[min(900px,calc(100vh-3rem))] md:min-h-0 md:overflow-y-auto md:rounded-[2rem] md:shadow-2xl md:ring-8 md:ring-slate-900">
      {children}
    </div>
  </div>
)

const BAR_TITLES: Record<string, string> = { '/wallet': 'Wallet', '/agent/earnings': 'Agent Earnings' }

export default function Layout() {
  const { session, isAdmin, signOut } = useAuth()
  const role = useRole()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false) }, [pathname])

  const isDemo = !!(session?.user as any)?.demo
  const bare = !session && ['/', '/login', '/register'].includes(pathname)
  if (bare) return <Frame><Outlet /></Frame>

  const tabs = session ? NAV[role] : []
  const adminPage = pathname.startsWith('/admin')
  const isDash = pathname === '/dashboard'
  const showBar = !!session && (pathname === '/' || isDash || pathname in BAR_TITLES)
  const showBottom = !!session && !adminPage
  const seller = role === 'seller'
  const barBg = seller && isDash ? 'bg-accent' : 'bg-gradient-to-r from-forest to-emerald'
  const name: string = (session?.user as any)?.user_metadata?.full_name || session?.user?.email || 'User'
  const items = MENU[role]

  const bell = (
    <Link to="/notifications" aria-label="Notifications" className="relative rounded-full p-2"><Bell size={20} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-white/60" /></Link>
  )

  return (
    <Frame>
      {isDemo && <div className="bg-amber-100 px-3 py-1 text-center text-[11px] font-semibold text-amber-800">Test mode · demo data, no real payments</div>}

      {showBar && (
        <header className={`safe-top sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 text-white ${barBg}`}>
          {isDash ? (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/25 text-sm font-bold">{role.charAt(0).toUpperCase()}</span>
              <span className="flex-1 text-base font-bold capitalize">{role} Dashboard</span>
            </>
          ) : (
            <>
              <button aria-label="Open menu" className="rounded-full p-2" onClick={() => setMenu(true)}><Menu size={22} /></button>
              <div className="flex flex-1 justify-center">{pathname === '/' ? <Logo size={28} dark /> : <span className="text-base font-bold">{BAR_TITLES[pathname]}</span>}</div>
            </>
          )}
          {isDash && <button aria-label="Open menu" className="rounded-full p-2" onClick={() => setMenu(true)}><Menu size={20} /></button>}
          {bell}
        </header>
      )}

      {!session && (
        <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-forest to-emerald px-4 py-2.5 text-white">
          <Link to="/" aria-label="Saage Free Trade Zone home"><Logo size={30} dark /></Link>
          <Link to="/login" className="rounded-lg bg-accent px-4 py-1.5 text-sm font-bold">Sign in</Link>
        </header>
      )}

      <main className="flex-1 animate-fade-up px-4 py-4">
        <Outlet />
      </main>

      {showBottom && (
        <nav aria-label="Primary" className="safe-bottom sticky bottom-0 z-30 border-t border-slate-200 bg-white">
          <ul className="grid grid-cols-5">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? (seller ? 'text-accent' : 'text-emerald') : 'text-slate-500'}`}>
                  {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.6 : 2} fill={isActive && label === 'Home' ? 'currentColor' : 'none'} />{label}</>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 flex bg-black/50" onClick={() => setMenu(false)}>
          <aside className="animate-fade-up flex h-full w-72 max-w-[80%] flex-col overflow-y-auto bg-white p-4" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="mb-3 flex items-center justify-between"><Logo size={32} /><button aria-label="Close menu" onClick={() => setMenu(false)} className="rounded-full p-2"><X size={20} /></button></div>
            <p className="mb-3 truncate text-xs text-muted">{name} · <span className="capitalize">{role}</span></p>
            <ul className="flex-1">
              {items.map(([label, to]) => (
                <li key={to}><Link to={to} className="flex items-center justify-between border-b border-slate-100 py-3 text-sm font-semibold">{label}<ChevronRight size={16} className="text-slate-400" /></Link></li>
              ))}
              {(isAdmin || isDemo) && <li><Link to="/admin" className="flex items-center justify-between border-b border-slate-100 py-3 text-sm font-semibold text-accent">Admin dashboard (preview)<ChevronRight size={16} /></Link></li>}
            </ul>
            <button className="mt-4 flex items-center gap-2 py-3 text-sm font-bold text-red-600" onClick={async () => { await signOut(); nav('/') }}><LogOut size={18} />Log Out</button>
          </aside>
        </div>
      )}
    </Frame>
  )
}
