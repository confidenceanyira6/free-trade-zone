import { Link } from 'react-router-dom'
import { Banknote, CheckCircle2, ClipboardList, Clock, Package, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { DEMO_ORDER, DEMO_PRODUCTS, DEMO_TASKS, orderBreakdown } from '../lib/demo'
import { ngn } from '../lib/fees'
import { Role } from '../lib/roles'
import { DemoBanner, SectionTitle, Stat, Thumb } from '../components/kit'
import { Badge, btn, btnAccent, card } from '../ui'

function WalletCard({ label, amount, tone }: { label: string; amount: number; tone: 'green' | 'orange' }) {
  return (
    <div className={`${card} flex items-center justify-between`}>
      <div><p className="text-xs font-medium text-muted">{label}</p><p className="text-2xl font-extrabold">{ngn(amount)}</p></div>
      <Link to="/wallet/withdraw" className={tone === 'orange' ? btnAccent : btn}>Withdraw</Link>
    </div>
  )
}

export default function RoleDash({ role }: { role: Role }) {
  const ob = orderBreakdown(DEMO_ORDER.productId, DEMO_ORDER.qty, DEMO_ORDER.agentId)

  if (role === 'seller') return (
    <div className="space-y-4">
      <DemoBanner />
      <div className="grid grid-cols-2 gap-3"><Stat label="Total Sales" value="5" icon={Banknote} /><Stat label="Pending Orders" value="2" icon={Clock} tone="text-accent" /></div>
      <WalletCard label="Available Balance" amount={3200000} tone="orange" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total orders" value="7" icon={ClipboardList} /><Stat label="Active orders" value="2" icon={Truck} />
        <Stat label="Completed" value="4" icon={CheckCircle2} /><Stat label="Pending payments" value={ngn(ob.b.sellerPayout)} icon={ShieldCheck} sub="In escrow, not withdrawable" />
      </div>
      <SectionTitle title="Recent Orders" to="/seller/orders" />
      <Link to="/seller/orders" className={`${card} flex items-center gap-3`}><Thumb kind="timber" /><div className="flex-1"><p className="font-semibold">Timber (Teak)</p><p className="text-xs text-muted">Order {DEMO_ORDER.ref}</p></div><Badge tone="amber">Awaiting agent</Badge></Link>
      <SectionTitle title="Best-selling products" to="/seller/products" />
      <div className="space-y-2">{DEMO_PRODUCTS.slice(0, 3).map((p, i) => (
        <div key={p.id} className={`${card} flex items-center gap-3 py-3`}><Thumb kind={p.kind} className="h-12 w-12" /><p className="flex-1 text-sm font-semibold">{p.name}</p><span className="text-xs text-muted">{[12, 8, 5][i]} orders</span></div>
      ))}</div>
    </div>
  )

  if (role === 'agent') return (
    <div className="space-y-4">
      <DemoBanner />
      <div className="grid grid-cols-2 gap-3"><Stat label="My Deliveries" value="8" icon={Truck} /><Stat label="Earnings" value={ngn(420000)} icon={Wallet} /></div>
      <Link to="/agent/earnings" className={`${btn} w-full`}>View Performance</Link>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Available tasks" value={String(DEMO_TASKS.filter((t) => t.status === 'available').length)} icon={ClipboardList} />
        <Stat label="Active inspections" value={String(DEMO_TASKS.filter((t) => t.status === 'active').length)} icon={ShieldCheck} />
        <Stat label="Awaiting delivery" value={String(DEMO_TASKS.filter((t) => t.status === 'delivery').length)} icon={Truck} />
        <Stat label="Pending commissions" value={ngn(450000)} icon={Clock} tone="text-accent" />
      </div>
      <WalletCard label="Available withdrawal balance" amount={320000} tone="green" />
      <SectionTitle title="Recent Tasks" to="/agent/tasks" />
      {DEMO_TASKS.slice(0, 2).map((t) => (
        <Link key={t.id} to={`/agent/tasks/${t.id}`} className={`${card} flex items-center gap-3`}><Package className="text-emerald" /><div className="flex-1"><p className="font-semibold">{t.product}</p><p className="text-xs text-muted">Order {t.order} · earn {ngn(t.commission)}</p></div><Badge tone={t.status === 'active' ? 'green' : 'amber'}>{t.status}</Badge></Link>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <DemoBanner />
      <div className="grid grid-cols-2 gap-3"><Stat label="Total Orders" value="3" icon={ClipboardList} /><Stat label="On Hold (escrow)" value={ngn(ob.b.total)} icon={ShieldCheck} tone="text-accent" /></div>
      <WalletCard label="Wallet Balance" amount={850000} tone="green" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Active orders" value="1" /><Stat label="Awaiting inspection" value="0" /><Stat label="Awaiting delivery" value="0" /><Stat label="Awaiting confirmation" value="1" tone="text-accent" /><Stat label="Completed" value="2" />
      </div>
      <SectionTitle title="Recent Activity" to="/orders" />
      <Link to="/order/track" className={`${card} flex items-center gap-3`}><Thumb kind="timber" /><div className="flex-1"><p className="font-semibold">Timber (Teak)</p><p className="text-xs text-muted">Order {DEMO_ORDER.ref}</p></div><Badge tone="orange">Awaiting confirmation</Badge></Link>
      <Link to="/marketplace" className={`${btnAccent} w-full`}>Place a new bulk order</Link>
    </div>
  )
}
