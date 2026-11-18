import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, MessageSquare } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { NAV, useRole } from '../lib/roles'
import { Logo } from './Logo'

export default function Layout() {
  const { session, isAdmin, signOut } = useAuth()
  const role = useRole()
  const { pathname } = useLocation()
  const nav = useNavigate()

  // Splash/welcome, sign in and sign up render full-screen without app chrome.
  const bare = !session && ['/', '/login', '/register'].includes(pathname)
  if (bare) return <Outlet />

  const tabs = session ? NAV[role] : []
  const adminPage = pathname.startsWith('/admin')
  const showBottom = !!session && !adminPage
  const deskLink = ({ isActive }: { isActive: boolean }) => `text-sm font-semibold ${isActive ? 'text-white underline decoration-accent decoration-2 underline-offset-8' : 'text-white/80 hover:text-white'}`

  return (
    <div className="min-h-screen">
      <header className="safe-top sticky top-0 z-30 bg-gradient-to-r from-forest to-emerald shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <Link to={session ? tabs[0].to : '/'} aria-label="Saage Free Trade Zone home"><Logo size={34} dark /></Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={deskLink}>{t.label}</NavLink>)}
            {!session && <NavLink to="/marketplace" className={deskLink}>Marketplace</NavLink>}
            {session && <NavLink to="/rfqs" className={deskLink}>RFQs</NavLink>}
            {isAdmin && <NavLink to="/admin" className={deskLink}>Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-1 text-white">
            {session ? (
              <>
                <Link to="/messages" aria-label="Messages" className="rounded-full p-2 hover:bg-white/10"><MessageSquare size={20} /></Link>
                <Link to="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-white/10"><Bell size={20} /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" /></Link>
                <button aria-label="Sign out" className="hidden rounded-full p-2 hover:bg-white/10 md:block" onClick={async () => { await signOut(); nav('/') }}><LogOut size={20} /></button>
              </>
            ) : (
              <Link to="/login" className="rounded-xl bg-accent px-4 py-1.5 text-sm font-semibold">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto animate-fade-up px-4 py-5 ${adminPage ? 'max-w-6xl' : 'max-w-5xl'} ${showBottom ? 'pb-28 md:pb-10' : 'pb-10'}`}><Outlet /></main>

      {showBottom && (
        <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-emerald' : 'text-slate-500'}`}>
                  {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.5 : 2} />{label}</>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <footer className="hidden border-t border-slate-200 py-5 text-center text-xs text-muted md:block">
        Saage Free Trade Zone is a trade marketplace. Escrow and wallet screens are previews until connected to a verified payment provider.
      </footer>
    </div>
  )
}
