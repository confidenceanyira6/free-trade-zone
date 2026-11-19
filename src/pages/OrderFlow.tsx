import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Camera, CheckCircle2, MapPin, Minus, Plus, Star } from 'lucide-react'
import { DEMO_AGENTS, DEMO_ORDER, DEMO_PRODUCTS, orderBreakdown } from '../lib/demo'
import { loadDraft, saveDraft } from '../lib/draft'
import { ngn } from '../lib/fees'
import { BreakdownTable, ConfirmDialog, DemoBanner, EscrowNote, PageHeader, Step, Thumb, Timeline, useToast } from '../components/kit'
import { Badge, btn, btn2, btnAccent, card, input } from '../ui'

const Label = ({ children }: { children: string }) => <p className="mb-1 mt-4 text-sm font-semibold">{children}</p>

/* ---------------- Place order ---------------- */
export function PlaceOrder() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const d0 = loadDraft()
  const pid = sp.get('p') ?? d0.productId
  const product = DEMO_PRODUCTS.find((p) => p.id === pid) ?? DEMO_PRODUCTS[0]
  const fresh = pid !== d0.productId
  const [qty, setQty] = useState(fresh ? product.minQty : d0.qty)
  const [mode, setMode] = useState<'agent' | 'direct'>(d0.mode)
  const [address, setAddress] = useState(d0.address)
  const [note, setNote] = useState(d0.note)
  const [tried, setTried] = useState(false)

  const qtyErr = qty < product.minQty ? `Minimum order is ${product.minQty.toLocaleString()} ${product.unit}.` : qty > product.stock ? `Only ${product.stock.toLocaleString()} ${product.unit} available.` : null
  const addrErr = !address.trim() ? 'Delivery destination is required.' : null

  function next() {
    setTried(true)
    if (qtyErr || addrErr) return
    saveDraft({ productId: product.id, qty, mode, address, note })
    nav(mode === 'agent' ? '/order/agent' : '/order/pay')
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Place Order" />
      <div className={`${card} flex items-center gap-3`}>
        <Thumb kind={product.kind} className="h-20 w-20" />
        <div className="min-w-0">
          <p className="font-bold">{product.name}</p>
          <p className="font-extrabold text-emerald">{ngn(product.price)} <span className="text-xs font-normal text-muted">/ {product.unit}</span></p>
          <p className="text-xs text-muted">Available: {product.stock.toLocaleString()} {product.unit}+ · MOQ {product.minQty.toLocaleString()} {product.unit}</p>
          <p className="text-xs text-muted">Seller: {product.seller}</p>
        </div>
      </div>

      <Label>Quantity</Label>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Decrease quantity" className="grid h-11 w-11 place-items-center rounded-xl bg-white ring-1 ring-slate-200" onClick={() => setQty(Math.max(0, qty - product.step))}><Minus size={18} /></button>
        <input aria-label="Quantity" inputMode="numeric" className={`${input} text-center font-bold`} value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
        <button type="button" aria-label="Increase quantity" className="grid h-11 w-11 place-items-center rounded-xl bg-white ring-1 ring-slate-200" onClick={() => setQty(qty + product.step)}><Plus size={18} /></button>
        <span className="rounded-xl bg-emerald/10 px-3 py-2.5 text-sm font-bold text-emerald">{product.unit}</span>
      </div>
      {(tried || qty > 0) && qtyErr && <p role="alert" className="mt-1 text-xs text-red-600">{qtyErr}</p>}
      <p className="mt-1 text-xs text-muted">Goods amount: <b>{ngn(qty * product.price)}</b></p>

      <Label>Delivery Mode</Label>
      <div className="space-y-2">
        {([['agent', 'Send Agent (Inspect & Deliver)', 'Recommended: an independent agent inspects, collects and delivers the goods.'], ['direct', 'Direct Shipping', 'The seller ships directly. No independent inspection.']] as const).map(([v, t, s]) => (
          <label key={v} className={`${card} flex cursor-pointer items-start gap-3 ${mode === v ? 'border-emerald ring-1 ring-emerald' : ''}`}>
            <input type="radio" name="mode" className="mt-1 accent-emerald" checked={mode === v} onChange={() => setMode(v)} />
            <span><span className="block text-sm font-semibold">{t}</span><span className="text-xs text-muted">{s}</span></span>
          </label>
        ))}
      </div>

      <Label>Delivery Destination</Label>
      <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Warehouse / port / city, country" aria-label="Delivery destination" />
      {tried && addrErr && <p role="alert" className="mt-1 text-xs text-red-600">{addrErr}</p>}

      <Label>Special Request (Optional)</Label>
      <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any special instruction…" />

      <button className={`${btn} mt-5 w-full py-3`} onClick={next}>Continue</button>
    </div>
  )
}

/* ---------------- Select inspection agent ---------------- */
const CHECKS = ['Quality Check', 'Quantity Check', 'Condition Check', 'Specifications', 'Authenticity', 'Photos & Report']

export function SendAgent() {
  const nav = useNavigate()
  const toast = useToast()
  const d = loadDraft()
  const [agentId, setAgentId] = useState(d.agentId)
  const [checks, setChecks] = useState(d.checks)
  const [address, setAddress] = useState(d.address)
  const [note, setNote] = useState(d.note)

  function send() {
    if (checks.length === 0) return toast('Select at least one inspection check.', 'err')
    if (!address.trim()) return toast('Delivery destination is required.', 'err')
    saveDraft({ agentId, checks, address, note, mode: 'agent' })
    nav('/order/pay')
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Send Agent Request" />
      <p className="mb-2 text-sm font-semibold">Select Agent</p>
      <div className="space-y-2" role="radiogroup" aria-label="Inspection agents">
        {DEMO_AGENTS.map((a) => (
          <label key={a.id} className={`${card} flex cursor-pointer items-center gap-3 ${agentId === a.id ? 'border-emerald ring-1 ring-emerald' : ''}`}>
            <input type="radio" name="agent" className="accent-emerald" checked={agentId === a.id} onChange={() => setAgentId(a.id)} />
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald/10 font-bold text-emerald">{a.name.charAt(0)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-bold">{a.name}{a.verified && <BadgeCheck size={15} className="text-emerald" aria-label="Verified" />}</span>
              <span className="flex items-center gap-1 text-xs text-muted"><Star size={12} className="fill-accent text-accent" />{a.rating} ({a.jobs} inspections) · <MapPin size={12} />{a.location}</span>
              <span className="block text-xs">Inspection fee <b>{ngn(a.fee)}</b> · Delivery <b>{ngn(a.delivery)}</b></span>
            </span>
          </label>
        ))}
      </div>

      <Label>Inspection Details</Label>
      <div className="grid grid-cols-2 gap-2">
        {CHECKS.map((c) => (
          <label key={c} className="flex items-center gap-2 rounded-xl bg-white p-2.5 text-xs font-medium ring-1 ring-slate-200">
            <input type="checkbox" className="accent-emerald" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} />{c}
          </label>
        ))}
      </div>
      <Label>Delivery Address</Label>
      <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Delivery address" />
      <Label>Additional Note</Label>
      <textarea className={input} rows={2} placeholder="e.g. deliver to warehouse" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={`${btn} mt-5 w-full py-3`} onClick={send}>Send Request</button>
    </div>
  )
}

/* ---------------- Payment summary ---------------- */
export function ConfirmPay() {
  const nav = useNavigate()
  const d = loadDraft()
  const o = orderBreakdown(d.productId, d.qty, d.mode === 'agent' ? d.agentId : null)
  const [agree, setAgree] = useState(false)
  const [dlg, setDlg] = useState(false)
  const { b, product, agent } = o
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Confirm & Pay" />
      <DemoBanner text="Payment is not connected in this build. No money is charged and escrow is not secured until a verified payment backend responds." />
      <div className={card}>
        <p className="text-sm font-bold">{product.name} — {d.qty.toLocaleString()} {product.unit}</p>
        <p className="text-xs text-muted">Deliver to {d.address}{agent ? ` · Agent: ${agent.name}` : ' · Direct shipping (no inspection agent)'}</p>
        <BreakdownTable rows={[
          ['Product amount', ngn(b.product), `${d.qty.toLocaleString()} × ${ngn(product.price)}`],
          ['Agent commission (inspection)', ngn(b.agent)],
          ['Delivery charges', ngn(b.delivery)],
          [`Saage platform transaction fee (${b.pct}%)`, ngn(b.platform)],
        ]} total={ngn(b.total)} totalLabel="Total amount" />
      </div>
      <div className={card}>
        <p className="mb-1 text-sm font-bold">When escrow is released</p>
        <BreakdownTable rows={[['Seller receives', ngn(b.sellerPayout)], ['Agent receives', ngn(b.agentPayout)], ['Saage platform commission', ngn(b.platformPayout)]]} />
      </div>
      <EscrowNote>The seller's money stays on hold in escrow and is not withdrawable. It is released only after inspection, delivery, and both buyer and seller confirmations.</EscrowNote>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have reviewed the payment breakdown and agree to the escrow terms.</label>
      <button className={`${btnAccent} w-full py-3`} disabled={!agree} onClick={() => setDlg(true)}>Proceed to payment</button>
      <ConfirmDialog open={dlg} title="Payment provider not connected" confirmLabel="View order preview"
        body="No payment was made and escrow has not been secured. You can continue to preview how order tracking will look."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); nav('/order/track') }} />
    </div>
  )
}

/* ---------------- Track order ---------------- */
const STAGES = ['Payment secured', 'Agent assigned', 'Inspection in progress', 'Inspection completed', 'Goods collected', 'In transit', 'Arrived at destination', 'Awaiting buyer confirmation']
const TIMES = ['Nov 17, 2026 · 9:40 AM', 'Nov 17, 2026 · 10:15 AM', 'Nov 17, 2026 · 11:30 AM', 'Nov 17, 2026 · 12:30 PM', 'Nov 18, 2026 · 8:00 AM', 'Nov 18, 2026 · 9:10 AM', 'Nov 18, 2026 · 1:45 PM', 'Nov 18, 2026 · 1:50 PM']

export function TrackOrder() {
  const toast = useToast()
  const [stage, setStage] = useState(7)
  const [verdict, setVerdict] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [dlg, setDlg] = useState<null | 'approve' | 'reject'>(null)
  const d = loadDraft()
  const o = orderBreakdown(DEMO_ORDER.productId, DEMO_ORDER.qty, DEMO_ORDER.agentId)
  const steps: Step[] = STAGES.map((t, i) => ({ title: t, time: i <= stage ? TIMES[i] : undefined, state: i < stage ? 'done' : i === stage ? 'current' : 'todo' }))

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title={`Order ${DEMO_ORDER.ref}`} right={<Badge tone="orange">In progress</Badge>} />
      <DemoBanner text="Preview order. Use the selector below to see each status. Real statuses will come from the backend." />
      <div className={card}>
        <p className="text-xs text-muted">Funds held in escrow (not withdrawable)</p>
        <p className="text-2xl font-extrabold text-emerald">{ngn(o.b.total)}</p>
        <p className="text-xs text-muted">{o.product.name} · {DEMO_ORDER.qty} {o.product.unit} · Agent {o.agent?.name}{d.address ? ` · To ${d.address}` : ''}</p>
      </div>
      <label className="block text-xs font-medium">Preview a status
        <select className={`${input} mt-1`} value={stage} onChange={(e) => setStage(Number(e.target.value))}>{STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
      </label>

      <div className={card}><Timeline steps={steps} /></div>

      {stage >= 3 && (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between"><p className="font-bold">Inspection report</p><Badge tone={verdict === 'approved' ? 'green' : verdict === 'rejected' ? 'red' : 'amber'}>{verdict === 'pending' ? 'Awaiting your approval' : verdict}</Badge></div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Thumb key={i} kind="timber" className="h-20 w-full" />)}</div>
          <ul className="space-y-1 text-sm">
            {['Quality: Grade A teak, moisture within spec', `Quantity: ${DEMO_ORDER.qty} ${o.product.unit} verified`, 'Condition: no visible damage', 'Authenticity: documents match listing'].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" />{t}</li>)}
          </ul>
          <p className="flex items-center gap-1 text-xs text-muted"><Camera size={14} /> 3 photos, 1 video (sample report)</p>
          {verdict === 'pending' && (
            <div className="grid grid-cols-3 gap-2">
              <button className={btn} onClick={() => setDlg('approve')}>Approve</button>
              <button className={btn2} onClick={() => setDlg('reject')}>Reject</button>
              <Link to="/disputes" className={btn2}>Complain</Link>
            </div>
          )}
          {verdict === 'pending' ? null : <button className="text-xs font-semibold text-emerald" onClick={() => setVerdict('pending')}>Reset preview</button>}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100"><span>Seller confirmation</span><Badge tone="amber">Awaiting</Badge></div>

      {stage === 7 ? (
        <div className="space-y-2"><Link to="/order/confirm" className={`${btn} w-full`}>Confirm Receipt</Link><Link to="/messages" className={`${btn2} w-full`}>Contact Agent</Link></div>
      ) : <Link to="/messages" className={`${btn2} w-full`}>Contact Agent</Link>}

      <ConfirmDialog open={dlg === 'approve'} title="Approve the goods?" body="The agent will be cleared to collect and deliver. You can still dispute on arrival." confirmLabel="Approve"
        onCancel={() => setDlg(null)} onConfirm={() => { setVerdict('approved'); setDlg(null); toast('Goods approved (preview, not sent to a server).') }} />
      <ConfirmDialog open={dlg === 'reject'} danger title="Reject the goods?" body="Rejecting pauses the order. You can then raise a dispute so Saage can review the evidence." confirmLabel="Reject"
        onCancel={() => setDlg(null)} onConfirm={() => { setVerdict('rejected'); setDlg(null); toast('Goods rejected. Raise a dispute to continue.', 'warn') }} />
    </div>
  )
}

/* ---------------- Confirm delivery & release ---------------- */
export function ConfirmRelease() {
  const toast = useToast()
  const nav = useNavigate()
  const o = orderBreakdown(DEMO_ORDER.productId, DEMO_ORDER.qty, DEMO_ORDER.agentId)
  const [agree, setAgree] = useState(false)
  const [dlg, setDlg] = useState(false)
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Confirm Delivery" />
      <DemoBanner text="Preview only. Releasing escrow must be performed and verified by the backend; this screen does not move money." />
      <div className={`${card} text-center`}>
        <CheckCircle2 className="mx-auto text-emerald" size={56} />
        <h2 className="mt-2 text-xl font-extrabold">Goods Received?</h2>
        <p className="text-sm text-muted">Please confirm the goods arrived and are acceptable.</p>
      </div>
      <div className={card}>
        <p className="mb-1 text-sm font-bold">Payment will be released to</p>
        <BreakdownTable rows={[['Seller', ngn(o.b.sellerPayout), 'Full agreed product amount'], ['Agent', ngn(o.b.agentPayout), 'Commission + delivery'], ['Saage platform', ngn(o.b.platformPayout), `${o.b.pct}% transaction fee`]]} />
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100"><span>Seller confirmation</span><Badge tone="amber">Awaiting</Badge></div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm the goods arrived in the agreed quantity and condition.</label>
      <button className={`${btn} w-full py-3`} disabled={!agree} onClick={() => setDlg(true)}>Confirm & Release</button>
      <Link to="/disputes" className={`${btn2} w-full`}>Raise a dispute instead</Link>
      <ConfirmDialog open={dlg} title="Confirm receipt?" confirmLabel="Confirm" body="Your confirmation is recorded. Funds are released only after the seller also confirms and the backend completes its checks."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Receipt confirmed (preview). Waiting for seller confirmation.'); nav('/order/track') }} />
    </div>
  )
}
