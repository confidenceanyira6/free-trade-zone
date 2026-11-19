import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Boxes, Building2, ChevronLeft, ClipboardList, MoreHorizontal, UserCheck, Wallet } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useRole } from '../lib/roles'
import { Logo } from '../components/Logo'
import { Art, HeroArt, SplashArt } from '../components/Art'
import { SectionTitle, Tile } from '../components/kit'
import { btnAccent, btn2, Loading } from '../ui'

function Welcome() {
  const nav = useNavigate()
  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-gradient-to-b from-[#0b3d22] via-[#0d4a2a] to-[#07301a] text-white md:min-h-full">
      <button aria-label="Back" onClick={() => nav(-1)} className="absolute left-3 top-4 z-10 rounded-full p-2"><ChevronLeft size={22} /></button>
      <div className="animate-fade-up flex flex-col items-center px-6 pt-14 text-center">
        <Logo size={104} dark stacked />
        <p className="mt-4 text-lg font-medium leading-snug text-white/95">Trade Globally.<br />Grow Together.</p>
      </div>
      <div className="flex flex-1 items-end px-2"><SplashArt className="w-full" /></div>
      <div className="space-y-3 px-6 pb-8 pt-4">
        <Link to="/register" className={`${btnAccent} w-full`}>Get Started</Link>
        <Link to="/login" className="inline-flex w-full items-center justify-center rounded-xl border-2 border-white/90 py-3 text-sm font-bold hover:bg-white/10">Sign In</Link>
        <p className="pt-1 text-center text-xs text-white/70">Trusted • Secure • Transparent</p>
        <Link to="/marketplace" className="block text-center text-xs text-white/60 underline underline-offset-4">Browse as guest</Link>
      </div>
    </div>
  )
}

function BuyerHome() {
  const top: [string, string][] = [['Timber', 'timber'], ['Red Oil', 'oil'], ['Cocoa', 'cocoa'], ['Charcoal', 'charcoal']]
  return (
    <div>
      <section className="relative h-44 overflow-hidden rounded-2xl bg-forest text-white">
        <HeroArt className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/60 to-transparent" />
        <div className="relative p-4">
          <h1 className="text-2xl font-extrabold leading-tight">Global Trade<br />in Raw Materials</h1>
          <p className="mt-1 text-xs text-white/90">Buy • Sell • Trade in Bulk</p>
          <Link to="/marketplace" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald px-3 py-2 text-xs font-bold">Explore Products <ArrowRight size={14} /></Link>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile to="/marketplace" icon={Boxes} label="Browse Products" tint="bg-orange-100 text-accent" />
        <Tile to="/marketplace" icon={Building2} label="Find Suppliers" tint="bg-violet-100 text-violet-600" />
        <Tile to="/orders" icon={ClipboardList} label="My Orders" tint="bg-orange-100 text-accent" />
        <Tile to="/order/agent" icon={UserCheck} label="Agents" tint="bg-emerald/10 text-emerald" />
        <Tile to="/wallet" icon={Wallet} label="Wallet" tint="bg-blue-100 text-blue-600" />
        <Tile to="/dashboard" icon={MoreHorizontal} label="More" tint="bg-indigo-100 text-indigo-600" />
      </div>

      <SectionTitle title="Top Raw Materials" to="/marketplace" />
      <div className="grid grid-cols-4 gap-2">
        {top.map(([name, kind]) => (
          <Link key={name} to={`/marketplace?q=${encodeURIComponent(name)}`} aria-label={name} className="block">
            <Art kind={kind} className="aspect-square w-full rounded-lg" />
          </Link>
        ))}
      </div>

      <Link to="/order/track" className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        <Art kind="timber" className="h-12 w-12 rounded-lg" />
        <div className="flex-1"><p className="text-sm font-bold">Timber (Teak)</p><p className="text-xs text-muted">Order #SZF8723</p></div>
        <span className="text-xs font-bold text-accent">Track ›</span>
      </Link>
      <Link to="/marketplace" className={`${btn2} mt-4 w-full`}>Browse all raw materials</Link>
    </div>
  )
}

export default function Home() {
  const { session, loading } = useAuth()
  const role = useRole()
  if (loading) return <Loading />
  if (!session) return <Welcome />
  if (role !== 'buyer') return <Navigate to="/dashboard" replace />
  return <BuyerHome />
}
