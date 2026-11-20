import { ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Lock } from 'lucide-react'
import { localId, nowStr, pushNote, useCollection } from '../lib/repo'
import { DEMO_PRODUCTS } from '../lib/demo'
import { FLOW, LocalTx, SEED_AGENTS, SEED_ASSIGNMENTS, TXS, Tx, deliveryOf, ledgerFor, seedChat } from '../lib/fixtures'
import type { AgentRec, Assignment, ChatMsg } from '../lib/types'
import { DELIVERY_STATUSES } from '../lib/types'
import { api } from '../lib/api'
import { escrowBreakdown, ngn } from '../lib/fees'
import { useRole } from '../lib/roles'
import { Art } from '../components/Art'
import { BreakdownTable, ConfirmDialog, PageHeader, SectionTitle, Step, Tabs, Timeline, useToast } from '../components/kit'
import { FilePick, LockedLocation, Section, StatusBadge, SyncBadge, useRun, useSync } from '../components/trust'
import { Badge, btn, btn2, btnS2, card, Empty, input } from '../ui'

/* ======================= List ======================= */
export function TransactionsList() {
  const role = useRole()
  const [reqs] = useCollection<LocalTx>('txRequests', [])
  const all: (Tx & { synced?: boolean })[] = [...reqs, ...TXS.filter((t) => role !== 'agent' || t.agentId === 'a1')]
  const tabs = ['All', 'Requests', 'Active', 'Completed', 'On Hold']
  const [tab, setTab] = useState('All')
  const test: Record<string, (t: Tx) => boolean> = { All: () => true, Requests: (t) => t.stage === 0, Active: (t) => t.stage > 0 && t.stage < 10 && !t.hold, Completed: (t) => t.stage >= 10, 'On Hold': (t) => !!t.hold }
  const list = all.filter(test[tab])
  const title = role === 'seller' ? 'Incoming Orders' : role === 'agent' ? 'Deliveries' : 'Transactions'
  const amount = (t: Tx) => { const b = escrowBreakdown(t); return role === 'seller' ? ['You receive', b.sellerNet] as const : role === 'agent' ? ['Your fee', b.agentPayout] as const : ['Buyer funds', b.buyerTotal] as const }
  return (
    <div>
      <PageHeader title={title} back={false} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {list.length === 0 ? <Empty text="No transactions here." /> : (
        <ul className="space-y-3">
          {list.map((t) => {
            const [label, val] = amount(t)
            return (
              <li key={t.id}>
                <Link to={`/transactions/${t.id}`} className={`${card} flex items-center gap-3`}>
                  <Art kind={t.kind} className="h-14 w-14 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{t.product}</p>
                    <p className="text-xs text-muted">{t.ref} · {t.qty}</p>
                    <p className="text-xs text-muted">{label}: <b className="text-ink">{ngn(val)}</b></p>
                    <div className="mt-1 flex flex-wrap gap-1">{t.hold ? <StatusBadge status="On Hold" /> : <Badge tone={t.stage >= 10 ? 'green' : 'orange'}>{FLOW[t.stage]}</Badge>}{(t as any).synced === false && <SyncBadge synced={false} />}</div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ======================= New transaction request (buyer) ======================= */
const INSPECT = ['Goods exist and match the listing', 'Quality check', 'Quantity verification', 'Photos and video evidence', 'Warehouse / factory verification']

export function TransactionNew() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const toast = useToast()
  const sync = useSync()
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const [, setReqs] = useCollection<LocalTx>('txRequests', [])
  const usable = agents.filter((a) => a.status === 'accepted' && a.active)
  const [pid, setPid] = useState(sp.get('p') ?? 'p1')
  const product = DEMO_PRODUCTS.find((p) => p.id === pid) ?? DEMO_PRODUCTS[0]
  const [qty, setQty] = useState(product.minQty)
  const [goods, setGoods] = useState<string | null>(null)
  const [delivery, setDelivery] = useState('0')
  const [specs, setSpecs] = useState('')
  const [reqs, setChecks] = useState<string[]>(['Quality check', 'Quantity verification'])
  const [agentId, setAgentId] = useState(usable[0]?.id ?? '')
  const [dest, setDest] = useState('')
  const [area, setArea] = useState('Lagos, Nigeria')
  const [tried, setTried] = useState(false)
  const seed = useMemo(() => seedChat(agentId), [agentId])
  const [chat] = useCollection<ChatMsg>(`chat:${agentId}`, seed)
  const agentFee = agentId ? [...chat].reverse().find((m) => m.kind === 'fee' && m.fee?.state === 'accepted')?.fee?.amount ?? 0 : 0

  const goodsVal = goods !== null ? Number(goods) : product.price * qty
  const delVal = Number(delivery) || 0
  const b = escrowBreakdown({ goods: goodsVal, delivery: delVal, agentFee })
  const qtyErr = qty < product.minQty ? `Minimum order is ${product.minQty.toLocaleString()} ${product.unit}.` : qty > product.stock ? `Only ${product.stock.toLocaleString()} ${product.unit} available.` : null

  async function submit() {
    setTried(true)
    if (qtyErr || goodsVal <= 0 || !dest.trim() || !area.trim()) return toast('Please fix the highlighted fields.', 'err')
    const id = localId('TXREQ')
    const t: LocalTx = { id, ref: id, product: product.name, kind: product.kind, qty: `${qty.toLocaleString()} ${product.unit}`, goods: goodsVal, delivery: delVal, agentFee, seller: product.seller, sellerId: 's-demo', buyer: 'You', agentId: agentId || null, agentName: agents.find((a) => a.id === agentId)?.name ?? null, approxFrom: product.origin, approxTo: area.trim(), sellerLocation: '', buyerLocation: dest.trim(), stage: 0, inspectionRequired: !!agentId, synced: false }
    setReqs((p) => [t, ...p])
    pushNote({ type: 'Transaction request', text: `Request prepared for ${product.name}`, to: `/transactions/${id}` })
    await sync(() => api.requestTransaction({ ...t, specs, inspection: reqs }), 'Request sent to the seller.')
    nav(`/transactions/${id}`)
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Transaction Request" />
      <label className="block text-sm font-bold">Goods
        <select className={`${input} mt-1`} value={pid} onChange={(e) => { setPid(e.target.value); const p = DEMO_PRODUCTS.find((x) => x.id === e.target.value)!; setQty(p.minQty); setGoods(null) }}>{DEMO_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Art kind={product.kind} className="h-12 w-12 rounded-lg" /><div className="text-xs"><p className="font-bold">{product.seller}</p><p className="text-muted">List price {ngn(product.price)} / {product.unit}. Seller location stays hidden until the transaction starts.</p></div></div>

      <label className="block text-sm font-bold">Required quantity ({product.unit})
        <input className={`${input} mt-1`} inputMode="numeric" value={qty || ''} onChange={(e) => { setQty(Number(e.target.value.replace(/\D/g, '')) || 0); setGoods(null) }} />
        {qtyErr && <span role="alert" className="text-xs font-normal text-red-600">{qtyErr}</span>}</label>
      <label className="block text-sm font-bold">Goods specifications<textarea className={`${input} mt-1`} rows={2} placeholder="Grade, size, moisture, packaging…" value={specs} onChange={(e) => setSpecs(e.target.value)} /></label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-bold">Proposed goods price (₦)<input className={`${input} mt-1`} inputMode="numeric" value={goodsVal ? goodsVal.toLocaleString() : ''} onChange={(e) => setGoods(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="block text-xs font-bold">Delivery allocation (₦)<input className={`${input} mt-1`} inputMode="numeric" value={delVal ? delVal.toLocaleString() : ''} onChange={(e) => setDelivery(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <p className="text-[11px] text-muted">The seller is responsible for delivery. The delivery allocation is part of the seller's agreed proceeds. It is not an extra charge added later.</p>

      <p className="text-sm font-bold">Inspection requirements</p>
      <div className="space-y-2">{INSPECT.map((k) => <label key={k} className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-emerald" checked={reqs.includes(k)} onChange={(e) => setChecks(e.target.checked ? [...reqs, k] : reqs.filter((x) => x !== k))} />{k}</label>)}</div>

      <label className="block text-sm font-bold">Your assigned agent
        <select className={`${input} mt-1`} value={agentId} onChange={(e) => setAgentId(e.target.value)}><option value="">No agent (not recommended)</option>{usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {agentId && !agentFee && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">No fee agreed with this agent yet. <Link to={`/agents/${agentId}/chat`} className="font-bold underline">Negotiate it in the private chat</Link> before funding.</p>}
      {usable.length === 0 && <p className="text-xs text-muted">You have no active agents. <Link to="/agents" className="font-bold text-emerald">Add one</Link>.</p>}

      <label className="block text-sm font-bold">Delivery destination (private)
        <input className={`${input} mt-1`} placeholder="Precise address" value={dest} onChange={(e) => setDest(e.target.value)} />
        {tried && !dest.trim() && <span role="alert" className="text-xs font-normal text-red-600">Required</span>}
        <span className="block text-[11px] font-normal text-muted">Hidden from the seller until both of you accept and the transaction starts. Enforced by the server.</span></label>
      <label className="block text-xs font-bold">Delivery area (visible to the seller)<input className={`${input} mt-1`} value={area} onChange={(e) => setArea(e.target.value)} /></label>

      <Section title="What you would fund">
        <BreakdownTable rows={[['Goods payment', ngn(b.goods)], ['Delivery allocation', ngn(b.delivery)], ['Agent fee (reserved separately)', ngn(b.agentFee)]]} total={ngn(b.buyerTotal)} totalLabel="Total buyer payment" />
        <p className="text-[11px] text-muted">Saage's {b.pct}% fee is deducted from the seller's proceeds. Final amounts are calculated by the server.</p>
      </Section>
      <button className={`${btn} w-full`} onClick={submit}>Send request to seller</button>
    </div>
  )
}

/* ======================= Detail ======================= */
const Row = ({ k, v, ok }: { k: string; v?: ReactNode; ok?: boolean }) => (
  <li className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? 'bg-emerald text-white' : 'bg-slate-200 text-slate-500'}`}><Check size={12} /></span>{k}</span>{v}</li>
)

export function TransactionDetail() {
  const { id } = useParams()
  const role = useRole()
  const run = useRun()
  const toast = useToast()
  const [reqs] = useCollection<LocalTx>('txRequests', [])
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const fx = TXS.find((t) => t.id === id)
  const tx: Tx | undefined = fx ?? reqs.find((r) => r.id === id)
  const [stage, setStage] = useState(tx?.stage ?? 0)
  const [dlg, setDlg] = useState<null | { title: string; body: string; call: () => Promise<any>; ok: string; danger?: boolean }>(null)
  const [terms, setTerms] = useState({ price: '', delivery: '' })
  const [disp, setDisp] = useState({ details: '', date: '', transport: '', ref: '' })
  const [evid, setEvid] = useState<string[]>([])
  const [dispEvid, setDispEvid] = useState<string[]>([])
  const [ledger, setLedger] = useState(false)

  if (!tx) return <div><PageHeader title="Transaction" /><Empty text="Transaction not found, or you do not have access to it." /></div>
  const b = escrowBreakdown(tx)
  const funded = stage >= 2, released = stage >= 10
  const dstat = deliveryOf(stage)
  const linked = asg.find((a) => a.txRef === tx.ref)
  const steps: Step[] = FLOW.map((t, i) => ({ title: t, state: i < stage ? 'done' : i === stage ? (i === 10 ? 'done' : 'current') : 'todo' }))
  const tag = released ? 'Released' : funded ? 'Reserved' : 'Not funded'
  const ask = (title: string, body: string, ok: string, call: () => Promise<any>, danger?: boolean) => setDlg({ title, body, call, ok, danger })

  // Locations: revealed only once the transaction has started (escrow funded). The server enforces this too.
  const started = stage >= 2
  const locs = role === 'buyer'
    ? [['Seller collection location', tx.sellerLocation, tx.approxFrom, started], ['Your delivery destination', tx.buyerLocation, tx.approxTo, true]] as const
    : role === 'seller'
      ? [['Your collection location', tx.sellerLocation, tx.approxFrom, true], ['Buyer delivery destination', tx.buyerLocation, tx.approxTo, stage >= 5]] as const
      : [['Inspection location (assigned to you)', tx.sellerLocation, tx.approxFrom, started], ['Delivery destination', tx.buyerLocation, tx.approxTo, stage >= 5]] as const

  return (
    <div className="space-y-4">
      <PageHeader title="Transaction" />
      <div className={card}>
        <div className="flex items-start gap-3">
          <Art kind={tx.kind} className="h-14 w-14 rounded-lg" />
          <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{tx.product}</p><p className="text-xs text-muted">{tx.ref} · {tx.qty}</p><p className="text-xs text-muted">Buyer {tx.buyer} · Seller <Link to={`/sellers/${tx.sellerId}`} className="font-semibold text-emerald">{tx.seller}</Link></p><p className="text-xs text-muted">Agent: {tx.agentName ?? 'none'}</p></div>
          <div className="flex flex-col items-end gap-1">{tx.hold ? <StatusBadge status="On Hold" /> : <Badge tone={released ? 'green' : 'orange'}>{FLOW[stage]}</Badge>}{(tx as any).synced === false && <SyncBadge synced={false} />}</div>
        </div>
      </div>

      {tx.hold && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><b>On hold.</b> A dispute is open, so the escrow funds stay held. They are not refunded or released until an admin resolves it. The agent's fee for completed inspection work is handled separately.</span></div>}

      <Section title="Escrow">
        <BreakdownTable rows={[
          ['Goods payment', ngn(b.goods), tag], ['Delivery allocation', ngn(b.delivery), tag], ['Agent fee (reserved separately)', ngn(b.agentFee), tag],
        ]} total={ngn(b.buyerTotal)} totalLabel="Buyer funds" />
        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <p className="mb-1 font-bold">On release (calculated by the server)</p>
          <p className="flex justify-between"><span>Seller receives (goods + delivery, less {b.pct}% platform fee)</span><b>{ngn(b.sellerNet)}</b></p>
          <p className="flex justify-between"><span>Platform fee</span><b>{ngn(b.platformFee)}</b></p>
          <p className="flex justify-between"><span>Agent receives</span><b>{ngn(b.agentPayout)}</b></p>
        </div>
        <p className="text-[11px] text-muted">Held funds are not in anyone's withdrawable balance. The agent's fee is reserved on its own so the seller's payment can never use it.</p>
      </Section>

      <div className={card}><p className="mb-3 text-sm font-bold">Progress</p><Timeline steps={steps} /></div>

      <Section title="Locations (private)">
        {locs.map(([label, value, approx, vis]) => <LockedLocation key={label} label={label} value={value || 'Not provided'} approx={approx} visible={vis} />)}
        <p className="flex items-center gap-1 text-[11px] text-muted"><Lock size={11} />Precise locations are released only to the people who need them, after both parties accept and the transaction starts. The server decides, not this screen.</p>
      </Section>

      {stage >= 3 && (
        <Section title="Inspection">
          <p className="text-sm">{stage === 3 ? 'Your agent is inspecting the goods at the seller location.' : 'Inspection report received from the assigned agent.'}</p>
          {stage >= 4 && <ul className="space-y-1 text-sm"><Row k="Goods exist" ok /><Row k="Quality checked" ok /><Row k="Quantity verified" ok /><Row k="Photos and videos uploaded" ok /></ul>}
          {linked && <Link to={`/assignments/${linked.id}`} className={`${btnS2} w-full py-2.5`}>Open assignment {linked.id}</Link>}
          {role === 'buyer' && stage === 4 && !tx.hold && (
            <div className="grid grid-cols-2 gap-2">
              <button className={btn} onClick={() => ask('Approve the goods?', 'The seller can then dispatch. The seller cannot bypass this approval.', 'Goods approved.', () => api.inspectionDecision(tx.id, 'approve'))}>Approve</button>
              <button className={btn2} onClick={() => ask('Reject the goods?', 'The transaction stops and refund rules apply to what you funded.', 'Goods rejected.', () => api.inspectionDecision(tx.id, 'reject'), true)}>Reject</button>
              <button className={btn2} onClick={() => ask('Request another inspection?', 'Your agent will be asked to inspect again.', 'Re-inspection requested.', () => api.inspectionDecision(tx.id, 'reinspect'))}>Re-inspect</button>
              <button className={btn2} onClick={() => ask('Ask for clarification?', 'Your agent will get a message asking for details.', 'Clarification requested.', () => api.inspectionDecision(tx.id, 'clarify', 'Please clarify the report.'))}>Clarify</button>
            </div>
          )}
          {role === 'seller' && stage < 5 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">You cannot dispatch until the buyer approves the inspection.</p>}
        </Section>
      )}

      {dstat && (
        <Section title="Delivery">
          <div className="flex flex-wrap gap-1">{DELIVERY_STATUSES.map((s) => <Badge key={s} tone={s === dstat ? 'green' : 'slate'}>{s}</Badge>)}</div>
          {role === 'seller' && stage === 5 && (
            <div className="space-y-2">
              <p className="text-xs font-bold">Dispatch details (you are responsible for delivery)</p>
              <input className={input} placeholder="Delivery details (vehicle, driver, route)" aria-label="Delivery details" value={disp.details} onChange={(e) => setDisp({ ...disp, details: e.target.value })} />
              <div className="grid grid-cols-2 gap-2"><input type="date" className={input} aria-label="Expected delivery date" value={disp.date} onChange={(e) => setDisp({ ...disp, date: e.target.value })} /><input className={input} placeholder="Transport info" aria-label="Transport information" value={disp.transport} onChange={(e) => setDisp({ ...disp, transport: e.target.value })} /></div>
              <FilePick label="Evidence of dispatch (photos, waybill)" names={evid} onChange={setEvid} />
              <button className={`${btn} w-full`} onClick={() => { if (disp.details.trim().length < 5 || !disp.date || evid.length === 0) return toast('Add delivery details, an expected date and dispatch evidence.', 'err'); run(() => api.dispatch(tx.id, { ...disp, evidence: evid }), 'Dispatch recorded.') }}>Mark as dispatched</button>
            </div>
          )}
          {role === 'seller' && (stage === 6 || stage === 7) && <button className={`${btn2} w-full`} onClick={() => run(() => api.updateDelivery(tx.id, stage === 6 ? 'In Transit' : 'Arrived at Destination'), 'Delivery updated.')}>{stage === 6 ? 'Mark in transit' : 'Mark arrived at destination'}</button>}
          {role === 'agent' && stage >= 6 && stage <= 8 && (
            <div className="space-y-2"><FilePick label="Delivery evidence (supervising agent)" names={evid} onChange={setEvid} /><button className={`${btnS2} w-full py-2.5`} onClick={() => { if (!evid.length) return toast('Choose evidence to upload.', 'err'); run(() => api.updateDelivery(tx.id, 'evidence', evid), 'Evidence submitted.') }}>Upload evidence</button></div>
          )}
        </Section>
      )}

      {stage >= 8 && (
        <Section title="Confirmations">
          <ul className="space-y-2"><Row k="Buyer confirms receipt and satisfaction" ok={stage >= 9} v={<Badge tone={stage >= 9 ? 'green' : 'amber'}>{stage >= 9 ? 'Confirmed' : 'Awaiting'}</Badge>} /><Row k="Seller confirms successful delivery" ok={stage >= 9} v={<Badge tone={stage >= 9 ? 'green' : 'amber'}>{stage >= 9 ? 'Confirmed' : 'Awaiting'}</Badge>} /><Row k="Agent delivery confirmation (optional)" ok={stage >= 9} v={<Badge tone={stage >= 9 ? 'green' : 'slate'}>{stage >= 9 ? 'Submitted' : 'Optional'}</Badge>} /></ul>
          {stage === 8 && !tx.hold && role === 'buyer' && <button className={`${btn} w-full`} onClick={() => ask('Confirm receipt?', 'Confirm that the goods arrived and you are satisfied. Funds are only released after the seller also confirms and the server completes its checks.', 'Confirmation recorded.', () => api.confirm(tx.id, 'buyer'))}>Confirm receipt</button>}
          {stage === 8 && !tx.hold && role === 'seller' && <button className={`${btn} w-full`} onClick={() => ask('Confirm delivery?', 'Confirm that you delivered the goods successfully.', 'Confirmation recorded.', () => api.confirm(tx.id, 'seller'))}>Confirm delivery completed</button>}
          {stage === 8 && !tx.hold && role === 'agent' && <button className={`${btn2} w-full`} onClick={() => ask('Submit delivery confirmation?', 'Your confirmation and evidence are sent to the buyer and admin.', 'Delivery confirmation sent.', () => api.confirm(tx.id, 'agent'))}>Submit delivery confirmation</button>}
        </Section>
      )}

      <Section title="When is money released?">
        <ul className="space-y-2"><Row k="Inspection approved by the buyer" ok={stage >= 5} /><Row k="Goods arrived at the destination" ok={stage >= 8} /><Row k="Buyer and seller both confirmed" ok={stage >= 9} /><Row k="No dispute or hold" ok={!tx.hold} /></ul>
        <p className="text-[11px] text-muted">The server releases funds in a single atomic, idempotent operation, so nobody can be paid twice. The app can only request it.</p>
      </Section>

      <div className="space-y-2">
        {role === 'buyer' && stage === 0 && <button className={`${btn2} w-full`} onClick={() => ask('Cancel this request?', 'The seller has not accepted yet, so nothing has been charged.', 'Request cancelled.', () => api.cancelTransaction(tx.id), true)}>Cancel request</button>}
        {role === 'buyer' && stage === 1 && <button className={`${btn} w-full`} onClick={() => ask('Fund escrow?', `You will pay ${ngn(b.buyerTotal)} into escrow inside Saage. It is held (goods ${ngn(b.goods)}, delivery ${ngn(b.delivery)}, agent ${ngn(b.agentFee)}) and is not available to the seller yet.`, 'Escrow funded.', () => api.fundEscrow(tx.id))}>Fund escrow ({ngn(b.buyerTotal)})</button>}
        {role === 'buyer' && stage >= 2 && stage < 6 && <button className={`${btn2} w-full`} onClick={() => ask('Cancel this transaction?', 'Cancellation and refunds follow the transaction rules and are processed by the server.', 'Cancellation requested.', () => api.cancelTransaction(tx.id), true)}>Cancel (per refund rules)</button>}
        {role === 'seller' && stage === 0 && (
          <Section title="Respond to this request">
            <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => ask('Accept these terms?', 'You agree to the goods price, delivery allocation and inspection requirements. You are responsible for delivery costs.', 'Terms accepted.', () => api.respondTransaction(tx.id, 'accept'))}>Accept</button><button className={btn2} onClick={() => ask('Reject this request?', 'The buyer will be told you declined.', 'Request rejected.', () => api.respondTransaction(tx.id, 'reject'), true)}>Reject</button></div>
            <div className="grid grid-cols-2 gap-2"><input className={input} inputMode="numeric" placeholder="Counter goods price (₦)" aria-label="Counter goods price" value={terms.price} onChange={(e) => setTerms({ ...terms, price: e.target.value.replace(/\D/g, '') })} /><input className={input} inputMode="numeric" placeholder="Delivery allocation (₦)" aria-label="Counter delivery allocation" value={terms.delivery} onChange={(e) => setTerms({ ...terms, delivery: e.target.value.replace(/\D/g, '') })} /></div>
            <button className={`${btn2} w-full`} onClick={() => { if (!Number(terms.price)) return toast('Enter a counter price.', 'err'); run(() => api.respondTransaction(tx.id, 'negotiate', { price: Number(terms.price), delivery: Number(terms.delivery) || 0 }), 'Counter-offer sent.') }}>Negotiate terms</button>
          </Section>
        )}
        {stage >= 2 && stage < 10 && role !== 'agent' && <Link to={`/disputes?tx=${tx.ref}`} className={`${btn2} w-full text-red-600`}>Report a problem / open a dispute</Link>}
        {role === 'buyer' && stage === 10 && <Link to="/reviews" className={`${btn} w-full`}>Rate this transaction</Link>}
        {role === 'seller' && stage === 10 && <Link to="/reviews" className={`${btn} w-full`}>Rate the buyer</Link>}
      </div>

      <button className="text-xs font-semibold text-emerald" onClick={() => setLedger(!ledger)} aria-expanded={ledger}>{ledger ? 'Hide' : 'Show'} ledger (read-only) ›</button>
      {ledger && (
        <Section title="Ledger (append-only on the server)">
          {ledgerFor(tx, stage).length === 0 ? <p className="text-xs text-muted">No entries yet. Entries appear when escrow is funded.</p> : <ul className="space-y-1 text-xs">{ledgerFor(tx, stage).map((r) => <li key={r.ref} className="flex justify-between gap-2"><span><b>{r.ref}</b> {r.text}</span><span className="font-semibold">{r.amount ? ngn(r.amount) : ''}</span></li>)}</ul>}
          <p className="text-[11px] text-muted">Sample references. Real financial references and IDs are issued by the server.</p>
        </Section>
      )}

      {fx && (
        <label className="block rounded-xl border border-dashed border-slate-300 p-3 text-xs font-medium text-muted">Demo only: preview another stage of this sample transaction (read-only, nothing is saved)
          <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-ink" value={stage} onChange={(e) => setStage(Number(e.target.value))}>{FLOW.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}</select></label>
      )}

      <ConfirmDialog open={!!dlg} danger={dlg?.danger} title={dlg?.title ?? ''} body={dlg?.body} confirmLabel="Confirm" onCancel={() => setDlg(null)} onConfirm={async () => { const d = dlg!; setDlg(null); await run(d.call, d.ok) }} />
    </div>
  )
}

/* ======================= Escrow wallet / status ======================= */
export function EscrowPage() {
  const role = useRole()
  const list = TXS.filter((t) => t.stage >= 2 && (role !== 'agent' || t.agentId === 'a1'))
  const held = list.filter((t) => t.stage < 10)
  const sum = (f: (b: ReturnType<typeof escrowBreakdown>) => number, ts: Tx[]) => ts.reduce((s, t) => s + f(escrowBreakdown(t)), 0)
  const heading = role === 'seller' ? 'Escrow Status' : role === 'agent' ? 'Secured Payments' : 'Escrow Wallet'
  const pick = (b: ReturnType<typeof escrowBreakdown>) => (role === 'seller' ? b.sellerNet : role === 'agent' ? b.agentPayout : b.buyerTotal)
  return (
    <div className="space-y-4">
      <PageHeader title={heading} back={false} />
      <div className="grid grid-cols-2 gap-3">
        <div className={card}><p className="text-xs text-muted">{role === 'buyer' ? 'Held in escrow' : 'Secured, not yet released'}</p><p className="text-lg font-extrabold text-accent">{ngn(sum(pick, held))}</p></div>
        <div className={card}><p className="text-xs text-muted">{role === 'buyer' ? 'Released' : 'Paid out'}</p><p className="text-lg font-extrabold text-emerald">{ngn(sum(pick, list.filter((t) => t.stage >= 10)))}</p></div>
      </div>
      <p className="rounded-xl bg-emerald/10 p-3 text-xs text-forest">Escrow money is never in a withdrawable balance. Amounts below are sample data. In production they are calculated and controlled only by the server.</p>
      <SectionTitle title="By transaction" />
      {list.length === 0 ? <Empty text="No funded transactions yet." /> : (
        <ul className="space-y-3">
          {list.map((t) => {
            const b = escrowBreakdown(t)
            return (
              <li key={t.id}><Link to={`/transactions/${t.id}`} className={`${card} block`}>
                <div className="flex items-center justify-between"><p className="text-sm font-bold">{t.ref}</p>{t.hold ? <StatusBadge status="On Hold" /> : <Badge tone={t.stage >= 10 ? 'green' : 'orange'}>{t.stage >= 10 ? 'Released' : 'Held'}</Badge>}</div>
                <p className="text-xs text-muted">{t.product}</p>
                <dl className="mt-2 space-y-0.5 text-xs">
                  {role !== 'agent' && <div className="flex justify-between"><dt className="text-muted">Goods</dt><dd>{ngn(b.goods)}</dd></div>}
                  {role !== 'agent' && <div className="flex justify-between"><dt className="text-muted">Delivery allocation</dt><dd>{ngn(b.delivery)}</dd></div>}
                  {role !== 'seller' && <div className="flex justify-between"><dt className="text-muted">Agent fee (secured)</dt><dd>{ngn(b.agentFee)}</dd></div>}
                  {role === 'seller' && <div className="flex justify-between"><dt className="text-muted">After {b.pct}% platform fee</dt><dd>{ngn(b.sellerNet)}</dd></div>}
                </dl>
              </Link></li>
            )
          })}
        </ul>
      )}
      {role === 'buyer' && <Link to="/wallet" className={`${btn2} w-full`}>Open wallet</Link>}
    </div>
  )
}
