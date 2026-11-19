import { Link } from 'react-router-dom'
import { Boxes, CheckCircle2, ClipboardList, Clock, Package, ShieldCheck, ShoppingBag, Truck, Wallet } from 'lucide-react'
import { Art } from '../components/Art'
import { SectionTitle, Stat } from '../components/kit'
import { DEMO_PRODUCTS, DEMO_TASKS } from '../lib/demo'
import { ngn } from '../lib/fees'
import { Role } from '../lib/roles'
import { btn, btnAccent, btnS2, card } from '../ui'

function WalletCard({ label, amount, accent }: { label: string; amount: number; accent?: boolean }) {
  return (
    <div className={card}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-2xl font-extrabold">{ngn(amount)}</p>
        <Link to="/wallet/withdraw" className={`${accent ? btnAccent : btn} px-5 py-2`}>Withdraw</Link>
      </div>
    </div>
  )
}

const Row = ({ to, kind, title, sub, tag, tagClass }: { to: string; kind: string; title: string; sub: string; tag: string; tagClass: string }) => (
  <Link to={to} className="flex items-center gap-3 py-2">
    <Art kind={kind} className="h-14 w-14 rounded-lg" />
    <div className="flex-1"><p className="text-sm font-bold">{title}</p><p className="text-xs text-muted">{sub}</p><p className={`text-xs font-bold ${tagClass}`}>{tag}</p></div>
  </Link>
)

export default function RoleDash({ role }: { role: Role }) {
  if (role === 'seller') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Sales" value="5" icon={ShoppingBag} tint="bg-orange-100 text-accent" />
        <Stat label="Pending Orders" value="2" icon={Clock} tint="bg-orange-100 text-accent" />
      </div>
      <WalletCard label="Wallet Balance" amount={3200000} accent />
      <SectionTitle title="Recent Orders" to="/seller/orders" />
      <Row to="/seller/orders" kind="oil" title="Red Oil" sub="Order #SZF8721" tag="Awaiting Agent" tagClass="text-emerald" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Stat label="Total orders" value="7" icon={ClipboardList} tint="bg-orange-100 text-accent" />
        <Stat label="Completed" value="4" icon={CheckCircle2} tint="bg-orange-100 text-accent" />
        <Stat label="Pending payments" value={ngn(125000000)} icon={ShieldCheck} tint="bg-orange-100 text-accent" sub="In escrow, not withdrawable" />
        <Stat label="Active orders" value="2" icon={Truck} tint="bg-orange-100 text-accent" />
      </div>
      <SectionTitle title="Best-selling products" to="/seller/products" />
      <div className="divide-y divide-slate-100">{DEMO_PRODUCTS.slice(0, 3).map((p, i) => (
        <div key={p.id} className="flex items-center gap-3 py-2"><Art kind={p.kind} className="h-10 w-10 rounded-lg" /><p className="flex-1 text-sm font-semibold">{p.name}</p><span className="text-xs text-muted">{[12, 8, 5][i]} orders</span></div>
      ))}</div>
      <div className="grid grid-cols-2 gap-2 pt-1"><Link to="/seller/products" className={btnS2}><Package size={14} />My Products</Link><Link to="/verification" className={btnS2}>Business verification</Link></div>
    </div>
  )

  if (role === 'agent') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="My Deliveries" value="8" icon={Truck} />
        <Stat label="Earnings" value={ngn(420000)} icon={Wallet} />
      </div>
      <Link to="/agent/earnings" className={`${btn} w-full`}>View Performance</Link>
      <SectionTitle title="Recent Tasks" to="/agent/tasks" />
      <Row to="/agent/tasks/k1" kind="timber" title="Inspect Timber" sub="Order #SZF8723" tag="In Progress" tagClass="text-emerald" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Stat label="Available tasks" value={String(DEMO_TASKS.filter((t) => t.status === 'available').length)} icon={ClipboardList} />
        <Stat label="Active inspections" value={String(DEMO_TASKS.filter((t) => t.status === 'active').length)} icon={ShieldCheck} />
        <Stat label="Awaiting delivery" value={String(DEMO_TASKS.filter((t) => t.status === 'delivery').length)} icon={Truck} />
        <Stat label="Pending commissions" value={ngn(100000)} icon={Clock} tone="text-accent" />
      </div>
      <WalletCard label="Available withdrawal balance" amount={320000} />
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Orders" value="3" icon={ClipboardList} />
        <Stat label="On Hold" value={ngn(2500000)} icon={ShieldCheck} />
      </div>
      <WalletCard label="Wallet Balance" amount={850000} />
      <SectionTitle title="Recent Activity" to="/orders" />
      <Row to="/order/track" kind="timber" title="Timber (Teak)" sub="Order #SZF8723" tag="Awaiting Agent" tagClass="text-emerald" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-2">
        {[['Active', 1], ['Awaiting inspection', 1], ['Awaiting delivery', 0], ['Awaiting confirmation', 1], ['Completed', 2]].map(([k, v]) => (
          <span key={k} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{k}: <b>{v}</b></span>
        ))}
      </div>
      <Link to="/marketplace" className={`${btnAccent} w-full`}><Boxes size={16} />Place a new bulk order</Link>
    </div>
  )
}
