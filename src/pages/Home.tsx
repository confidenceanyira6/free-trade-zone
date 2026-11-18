import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Cog, Droplets, Search, TreePine, UserCheck, Wallet, Wheat, ClipboardList, Boxes, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useRole } from '../lib/roles'
import { Logo } from '../components/Logo'
import { SectionTitle, Thumb, Tile } from '../components/kit'
import { btnAccent, Loading } from '../ui'

function Welcome() {
  const icons = [TreePine, Droplets, Wheat, Cog]
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-forest via-[#0d4a2a] to-[#1d2f1a] px-8 pb-10 pt-16 text-center text-white">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-emerald/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="animate-fade-up relative space-y-4">
        <Logo size={96} dark stacked />
        <p className="text-lg font-medium text-white/90">Trade Globally.<br />Grow Together.</p>
        <p className="text-xs uppercase tracking-widest text-white/60">Raw materials · Bulk trade · Trusted agents</p>
      </div>
      <div className="relative my-8 flex gap-3">
        {icons.map((I, i) => <span key={i} className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20"><I size={26} /></span>)}
      </div>
      <div className="relative w-full max-w-sm space-y-3">
        <Link to="/register" className={`${btnAccent} w-full py-3.5 text-base`}>Get Started</Link>
        <Link to="/login" className="inline-flex w-full items-center justify-center rounded-xl border-2 border-white/80 py-3 text-base font-semibold hover:bg-white/10">Sign In</Link>
        <Link to="/marketplace" className="block pt-1 text-sm text-white/80 underline underline-offset-4">Browse the marketplace as a guest</Link>
        <p className="pt-3 text-xs text-white/60">Trusted • Secure • Transparent</p>
      </div>
    </div>
  )
}

function BuyerHome() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const go = (e: FormEvent) => { e.preventDefault(); nav(`/marketplace${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) }
  const top = [['Timber', 'timber'], ['Red Oil', 'oil'], ['Cocoa', 'grain'], ['Rubber', 'rubber'], ['Charcoal', 'charcoal'], ['Coffee', 'coffee']]
  return (
    <div>
      <form onSubmit={go} className="relative mb-4" role="search">
        <Search size={18} className="absolute left-3 top-3 text-slate-400" />
        <input aria-label="Search raw materials" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search raw materials…" className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/30" />
      </form>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest via-[#0d5a31] to-emerald p-6 text-white shadow-lg">
        <TreePine className="absolute -bottom-4 -right-3 h-36 w-36 text-white/10" />
        <h1 className="text-2xl font-extrabold leading-tight md:text-4xl">Global Trade<br />in Raw Materials</h1>
        <p className="mt-2 text-sm text-white/80">Buy • Sell • Trade in Bulk</p>
        <Link to="/marketplace" className={`${btnAccent} mt-4`}>Explore Products <ArrowRight size={16} /></Link>
      </section>

      <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">
        <Tile to="/marketplace" icon={Boxes} label="Browse Products" tint="bg-orange-100 text-accent" />
        <Tile to="/marketplace" icon={Building2} label="Find Suppliers" tint="bg-violet-100 text-violet-600" />
        <Tile to="/orders" icon={ClipboardList} label="My Orders" tint="bg-amber-100 text-amber-600" />
        <Tile to="/order/agent" icon={UserCheck} label="Agents" tint="bg-emerald/10 text-emerald" />
        <Tile to="/wallet" icon={Wallet} label="Wallet" tint="bg-blue-100 text-blue-600" />
        <Tile to="/profile" icon={MoreHorizontal} label="More" tint="bg-indigo-100 text-indigo-600" />
      </div>

      <SectionTitle title="Top Raw Materials" to="/marketplace" />
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {top.map(([name, kind]) => (
          <Link key={name} to={`/marketplace?q=${encodeURIComponent(name)}`} className="flex shrink-0 flex-col items-center gap-1 text-xs font-semibold">
            <Thumb kind={kind} className="h-20 w-20" />{name}
          </Link>
        ))}
      </div>

      <SectionTitle title="Your active order" to="/order/track" action="Track" />
      <Link to="/order/track" className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
        <Thumb kind="timber" /><div className="flex-1"><p className="font-semibold">Timber (Teak)</p><p className="text-xs text-muted">Order #SZF8723 · preview</p></div><span className="text-xs font-semibold text-accent">Awaiting confirmation ›</span>
      </Link>
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
