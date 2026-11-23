import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Coins, FileText, History, Inbox, ListChecks, MapPin, MessagesSquare, Package, ShieldAlert, ShieldCheck, Star, Truck, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Art } from '../components/Art'
import { SectionTitle, Stat } from '../components/kit'
import { readCollection, useCollection } from '../lib/repo'
import { SEED_AGENTS, SEED_ASSIGNMENTS, TXS, seedChat } from '../lib/fixtures'
import type { AgentRec, Assignment } from '../lib/types'
import { escrowBreakdown, ngn } from '../lib/fees'
import { Role } from '../lib/roles'
import { btn, btnAccent, card } from '../ui'

type Item = [string, string, LucideIcon, (number | string)?]

function Grid({ items, accent }: { items: Item[]; accent?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([label, to, Icon, count]) => (
        <Link key={label} to={to} className="relative flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-3 text-center text-[11px] font-semibold leading-tight transition active:scale-95">
          <span className={`grid h-9 w-9 place-items-center rounded-lg ${accent ? 'bg-orange-100 text-accent' : 'bg-emerald/10 text-emerald'}`}><Icon size={19} /></span>{label}
          {count !== undefined && count !== 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{count}</span>}
        </Link>
      ))}
    </div>
  )
}

function WalletCard({ label, amount, accent }: { label: string; amount: number; accent?: boolean }) {
  return (
    <div className={card}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-center justify-between"><p className="text-2xl font-extrabold">{ngn(amount)}</p><Link to="/wallet/withdraw" className={`${accent ? btnAccent : btn} px-5 py-2`}>Withdraw</Link></div>
    </div>
  )
}

export default function RoleDash({ role }: { role: Role }) {
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const active = TXS.filter((t) => t.stage < 10 && !t.hold && !t.refunded)
  const held = TXS.filter((t) => t.stage >= 2 && t.stage < 10 && !t.refunded)
  const heldTotal = held.reduce((s, t) => s + escrowBreakdown(t).buyerTotal, 0)
  const negotiating = agents.filter((a) => a.status === 'accepted').filter((a) => readCollection<any>(`chat:${a.id}`, seedChat(a.id)).some((m) => m.kind === 'fee' && m.fee?.state === 'proposed')).length
  const mine = asg.filter((a) => a.agentId === 'a1')

  if (role === 'seller') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Incoming Orders" value={String(TXS.filter((t) => t.stage === 0).length)} icon={Inbox} tint="bg-orange-100 text-accent" />
        <Stat label="Active Transactions" value={String(active.length)} icon={Truck} tint="bg-orange-100 text-accent" />
      </div>
      <WalletCard label="Wallet Balance (withdrawable)" amount={3200000} accent />
      <div className={card}><p className="text-xs text-muted">Escrow Status: secured for you, not yet released</p><p className="text-xl font-extrabold text-accent">{ngn(held.reduce((s, t) => s + escrowBreakdown(t).sellerNet, 0))}</p></div>
      <SectionTitle title="Manage your trade" />
      <Grid accent items={[['Incoming Orders', '/seller/orders', Inbox], ['Active Transactions', '/seller/orders', Truck, active.length], ['Buyer Negotiations', '/seller/orders', MessagesSquare], ['Escrow Status', '/escrow', ShieldCheck], ['Delivery Management', '/seller/orders', Package], ['Transaction History', '/seller/orders', History], ['Earnings', '/wallet', Coins], ['Disputes', '/disputes', ShieldAlert], ['Buyer Reviews', '/reviews', Star], ['My Products', '/seller/products', Package], ['My Locations', '/locations', MapPin], ['Messages', '/messages', MessagesSquare]]} />
    </div>
  )

  if (role === 'agent') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3"><Stat label="Assigned Tasks" value={String(mine.length)} icon={ClipboardList} /><Stat label="Earnings" value={ngn(420000)} icon={Wallet} /></div>
      <Link to="/agent/earnings" className={`${btn} w-full`}>View Earnings</Link>
      <SectionTitle title="Your work" />
      <Grid items={[
        ['My Buyer', '/agent/buyer', Users], ['Assigned Tasks', '/agent/tasks', ClipboardList, mine.length], ['Agent-Buyer Chat', '/agent/chat', MessagesSquare], ['Fee Negotiations', '/agent/chat', Coins],
        ['Upcoming Inspections', '/agent/tasks', ListChecks, mine.filter((a) => ['Pending', 'Accepted'].includes(a.status)).length], ['Active Inspections', '/agent/tasks', ShieldCheck, mine.filter((a) => a.status === 'In Progress').length],
        ['Inspection Reports', '/agent/tasks', FileText, mine.filter((a) => a.status === 'Inspection Completed').length], ['Delivery Assignments', '/agent/deliveries', Truck], ['Earnings', '/agent/earnings', Wallet],
        ['Completed Tasks', '/agent/tasks', CheckCircle2], ['Reviews', '/reviews', Star], ['My Locations', '/locations', MapPin],
      ]} />
      <p className="text-xs text-muted">You only see transactions and assignments your buyer gives you. Your fee is secured in escrow and released after the agreed conditions are met.</p>
    </div>
  )

  const next = active[0]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3"><Stat label="Active Transactions" value={String(active.length)} icon={ClipboardList} /><Stat label="Held in Escrow" value={ngn(heldTotal)} icon={ShieldCheck} tone="text-accent" /></div>
      <WalletCard label="Wallet Balance" amount={850000} />
      <SectionTitle title="Your trade" />
      <Grid items={[
        ['My Agents', '/agents', Users, agents.length], ['Agent Negotiations', '/agents', MessagesSquare, negotiating], ['My Assignments', '/assignments', ClipboardList, asg.length],
        ['Active Transactions', '/orders', Truck, active.length], ['Escrow Wallet', '/escrow', ShieldCheck], ['Inspection Reports', '/assignments', FileText, asg.filter((a) => a.status === 'Inspection Completed').length],
        ['Delivery Tracking', '/orders', MapPin], ['Transaction History', '/orders', History], ['Disputes', '/disputes', ShieldAlert], ['Reviews', '/reviews', Star], ['Browse Products', '/marketplace', Package], ['My Locations', '/locations', MapPin],
      ]} />
      {next && (
        <>
          <SectionTitle title="Recent Activity" to="/orders" />
          <Link to={`/transactions/${next.id}`} className="flex items-center gap-3 py-1"><Art kind={next.kind} className="h-14 w-14 rounded-lg" /><div className="flex-1"><p className="text-sm font-bold">{next.product}</p><p className="text-xs text-muted">{next.ref}</p></div><span className="text-xs font-bold text-emerald">Track ›</span></Link>
        </>
      )}
    </div>
  )
}
