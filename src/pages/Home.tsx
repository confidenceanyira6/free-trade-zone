import { Link } from 'react-router-dom'
import { Globe2, FileText, ShieldCheck, Truck } from 'lucide-react'
import { btn, btn2, card } from '../ui'

export default function Home() {
  const items = [
    [Globe2, 'Global marketplace', 'Discover products from verified suppliers worldwide.'],
    [FileText, 'Request for quotation', 'Publish what you need and compare supplier offers.'],
    [ShieldCheck, 'Verified businesses', 'Every verification is reviewed by our team.'],
    [Truck, 'Logistics and tracking', 'Request freight quotes and follow your shipments.'],
  ] as const
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-navy p-8 text-white md:p-14">
        <p className="text-sm font-semibold text-emerald">Connect · Trade · Grow Globally</p>
        <h1 className="mt-2 text-3xl font-bold md:text-5xl">Global trade. Boundless opportunities.</h1>
        <p className="mt-3 max-w-xl text-white/80">A B2B marketplace connecting African and international importers, exporters, manufacturers and logistics companies.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/marketplace" className={btn}>Browse marketplace</Link>
          <Link to="/register" className={btn2}>Create business account</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([Icon, t, d]) => (
          <div key={t} className={card}><Icon className="text-emerald" /><h3 className="mt-2 font-semibold">{t}</h3><p className="text-sm text-muted">{d}</p></div>
        ))}
      </section>
    </div>
  )
}
