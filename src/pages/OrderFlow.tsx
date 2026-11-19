import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Camera, CheckCircle2, MapPin, Minus, Plus, Star } from 'lucide-react'
import { DEMO_AGENTS, DEMO_ORDER, DEMO_PRODUCTS, orderBreakdown } from '../lib/demo'
import { loadDraft, saveDraft } from '../lib/draft'
import { ngn } from '../lib/fees'
import { Art } from '../components/Art'
import { Avatar, BreakdownTable, ConfirmDialog, EscrowNote, PageHeader, Step, Timeline, useToast } from '../components/kit'
import { Badge, btn, btn2, btnAccent, card, input } from '../ui'

const Label = ({ children }: { children: string }) => <p className="mb-1.5 mt-4 text-sm font-bold">{children}</p>

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
    <div>
      <PageHeader title="Place Order" />
      <div className="flex items-center gap-3">
        <Art kind={product.kind} className="h-16 w-16 rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{product.name}</p>
          <p className="text-sm font-extrabold">{ngn(product.price)} <span className="text-xs font-semibold">/ {product.unit}</span></p>
          <p className="text-xs text-muted">Available: {product.stock.toLocaleString()}{product.unit}+</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-bold">Quantity</span>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300" onClick={() => setQty(Math.max(0, qty - product.step))}><Minus size={16} /></button>
          <input aria-label="Quantity" inputMode="numeric" className="w-24 rounded-lg border border-slate-300 py-2 text-center text-sm font-bold" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
          <button type="button" aria-label="Increase quantity" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300" onClick={() => setQty(qty + product.step)}><Plus size={16} /></button>
          <span className="w-8 text-sm font-bold">{product.unit}</span>
        </div>
      </div>
      {qtyErr && <p role="alert" className="mt-1 text-xs text-red-600">{qtyErr}</p>}
      <p className="mt-1 text-xs text-muted">Goods amount: <b>{ngn(qty * product.price)}</b></p>

      <Label>Delivery Mode</Label>
      <div className="space-y-2.5">
        {([['agent', 'Send Agent (Inspect & Deliver)'], ['direct', 'Direct Shipping']] as const).map(([v, t]) => (
          <label key={v} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name="mode" className="h-5 w-5 accent-emerald" checked={mode === v} onChange={() => setMode(v)} />{t}
          </label>
        ))}
      </div>
      {mode === 'direct' && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Direct shipping has no independent inspection. An agent is recommended for bulk orders.</p>}

      <Label>Delivery Destination</Label>
      <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Warehouse / port / city, country" aria-label="Delivery destination" />
      {tried && addrErr && <p role="alert" className="mt-1 text-xs text-red-600">{addrErr}</p>}

      <Label>Special Request (Optional)</Label>
      <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any special instruction..." />

      <button className={`${btn} mt-5 w-full`} onClick={next}>Continue</button>
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
    <div>
      <PageHeader title="Send Agent Request" />
      <p className="mb-2 text-sm font-bold">Select Agent</p>
      <div className="space-y-2" role="radiogroup" aria-label="Inspection agents">
        {DEMO_AGENTS.map((a) => (
          <label key={a.id} className={`${card} flex cursor-pointer items-center gap-3 p-3 ${agentId === a.id ? 'border-emerald ring-1 ring-emerald' : ''}`}>
            <input type="radio" name="agent" className="sr-only" checked={agentId === a.id} onChange={() => setAgentId(a.id)} />
            <Avatar name={a.name} size="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-bold">{a.name}{a.verified && <BadgeCheck size={15} className="text-emerald" aria-label="Verified" />}</span>
              <span className="flex items-center gap-1 text-xs text-muted"><Star size={12} className="fill-accent text-accent" /><b className="text-ink">{a.rating}</b> ({a.jobs} deliveries) · {a.location.split(',')[0]}</span>
              <span className="block text-xs">Inspection {ngn(a.fee)} · Delivery {ngn(a.delivery)}</span>
            </span>
            <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${agentId === a.id ? 'border-emerald bg-emerald text-white' : 'border-slate-300'}`}>{agentId === a.id && <CheckCircle2 size={14} />}</span>
          </label>
        ))}
      </div>

      <Label>Inspection Details</Label>
      <div className="space-y-2.5">
        {CHECKS.map((c) => (
          <label key={c} className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 rounded accent-emerald" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} />{c}
          </label>
        ))}
      </div>
      <Label>Delivery Address</Label>
      <div className="relative"><MapPin size={16} className="absolute left-3 top-3.5 text-emerald" /><input className={`${input} pl-9`} value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Delivery address" /></div>
      <Label>Additional Note</Label>
      <input className={input} placeholder="e.g. deliver to warehouse" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={`${btn} mt-5 w-full`} onClick={send}>Send Request</button>
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
    <div className="space-y-4">
      <PageHeader title="Payment Summary" />
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
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Payment is not connected in this build. No money is charged and escrow is not secured until a verified payment backend responds.</p>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have reviewed the payment breakdown and agree to the escrow terms.</label>
      <button className={`${btnAccent} w-full`} disabled={!agree} onClick={() => setDlg(true)}>Proceed to payment</button>
      <ConfirmDialog open={dlg} title="Payment provider not connected" confirmLabel="View order preview"
        body="No payment was made and escrow has not been secured. You can continue to preview how order tracking will look."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); nav('/order/track') }} />
    </div>
  )
}

/* ---------------- Track order ---------------- */
const STAGES = ['Payment secured', 'Agent assigned', 'Inspection in progress', 'Inspection completed', 'Goods collected', 'In transit', 'Arrived at destination', 'Awaiting buyer confirmation']
const TIMES = ['Nov 17, 2026 · 9:40 AM', 'Nov 17, 2026 · 10:15 AM', 'Nov 17, 2026 · 11:30 AM', 'Nov 17, 2026 · 12:30 PM', 'Nov 18, 2026 · 8:00 AM', 'Nov 18, 2026 · 9:10 AM', 'Nov 18, 2026 · 1:45 PM', 'Awaiting Your Confirmation']

export function TrackOrder() {
  const toast = useToast()
  const [stage, setStage] = useState(7)
  const [verdict, setVerdict] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [dlg, setDlg] = useState<null | 'approve' | 'reject'>(null)
  const o = orderBreakdown(DEMO_ORDER.productId, DEMO_ORDER.qty, DEMO_ORDER.agentId)
  const steps: Step[] = STAGES.map((t, i) => ({ title: t, time: i <= stage ? TIMES[i] : undefined, state: i < stage ? 'done' : i === stage ? 'current' : 'todo' }))

  return (
    <div className="space-y-4">
      <PageHeader title={`Order ${DEMO_ORDER.ref}`} />
      <div className="flex justify-center"><span className="rounded-xl bg-emerald/10 px-8 py-2 text-lg font-extrabold text-emerald">In Progress</span></div>

      <div className={`${card} flex items-center justify-between`}>
        <div><p className="text-xs text-muted">Held in escrow (not withdrawable)</p><p className="text-lg font-extrabold text-emerald">{ngn(o.b.total)}</p></div>
        <Badge tone="green">Payment secured</Badge>
      </div>

      <Timeline steps={steps} />

      <label className="block text-xs font-medium text-muted">Demo: preview another status
        <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-ink" value={stage} onChange={(e) => setStage(Number(e.target.value))}>{STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
      </label>

      {stage >= 3 && (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Inspection report</p><Badge tone={verdict === 'approved' ? 'green' : verdict === 'rejected' ? 'red' : 'amber'}>{verdict === 'pending' ? 'Awaiting your approval' : verdict}</Badge></div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Art key={i} kind="timber" className="aspect-square w-full rounded-lg" />)}</div>
          <ul className="space-y-1 text-sm">
            {['Quality: Grade A teak, moisture within spec', `Quantity: ${DEMO_ORDER.qty} ${o.product.unit} verified`, 'Condition: no visible damage', 'Authenticity: documents match listing'].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" />{t}</li>)}
          </ul>
          <p className="flex items-center gap-1 text-xs text-muted"><Camera size={14} /> 3 photos, 1 video (sample report)</p>
          {verdict === 'pending' ? (
            <div className="grid grid-cols-3 gap-2">
              <button className={btn} onClick={() => setDlg('approve')}>Approve</button>
              <button className={btn2} onClick={() => setDlg('reject')}>Reject</button>
              <Link to="/disputes" className={btn2}>Complain</Link>
            </div>
          ) : <button className="text-xs font-semibold text-emerald" onClick={() => setVerdict('pending')}>Reset preview</button>}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Seller confirmation</span><Badge tone="amber">Awaiting</Badge></div>

      {stage === 7 && <Link to="/order/confirm" className={`${btn} w-full`}>Confirm Receipt</Link>}
      <Link to="/messages" className={`${btn2} w-full`}>Contact Agent</Link>

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
    <div className="space-y-4">
      <PageHeader title="Confirm & Pay" />
      <div className="pt-2 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-emerald text-emerald"><CheckCircle2 size={44} /></span>
        <h2 className="mt-3 text-xl font-extrabold">Goods Received!</h2>
        <p className="mx-auto max-w-[16rem] text-sm text-muted">Please confirm the goods and release payment.</p>
      </div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm the goods arrived in the agreed quantity and condition.</label>
      <button className={`${btn} w-full`} disabled={!agree} onClick={() => setDlg(true)}>Confirm & Pay</button>
      <div className="text-center text-sm">
        <p className="mb-1 text-muted">Payment will be released to:</p>
        <p>• Seller: <b>Full Amount</b> ({ngn(o.b.sellerPayout)})</p>
        <p>• Agent: <b>Commission</b> ({ngn(o.b.agentPayout)})</p>
        <p>• Saage platform: {ngn(o.b.platformPayout)}</p>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Seller confirmation</span><Badge tone="amber">Awaiting</Badge></div>
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Preview only. Releasing escrow must be performed and verified by the backend; this screen does not move money.</p>
      <Link to="/disputes" className={`${btn2} w-full`}>Raise a dispute instead</Link>
      <ConfirmDialog open={dlg} title="Confirm receipt?" confirmLabel="Confirm" body="Your confirmation is recorded. Funds are released only after the seller also confirms and the backend completes its checks."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Receipt confirmed (preview). Waiting for seller confirmation.'); nav('/order/track') }} />
    </div>
  )
}
