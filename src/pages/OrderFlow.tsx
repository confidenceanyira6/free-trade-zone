import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, CheckCircle2, MapPin, Minus, Phone, Plus, User } from 'lucide-react'
import { DEMO_ORDER, DEMO_PRODUCTS } from '../lib/demo'
import { loadDraft, saveDraft } from '../lib/draft'
import { breakdown, ngn } from '../lib/fees'
import { getConfirm, resetConfirm, setConfirm } from '../lib/orderState'
import { Art } from '../components/Art'
import { BreakdownTable, ConfirmDialog, EscrowNote, PageHeader, Step, Timeline, useToast } from '../components/kit'
import { Badge, btn, btn2, btnAccent, btnS2, card, input } from '../ui'

const Label = ({ children }: { children: string }) => <p className="mb-1.5 mt-4 text-sm font-bold">{children}</p>

// The buyer's own agent is paid by the buyer directly, so escrow holds only the goods amount
// plus Saage's platform fee, and everything except the fee goes to the seller.
function calc(productId: string, qty: number) {
  const product = DEMO_PRODUCTS.find((x) => x.id === productId) ?? DEMO_PRODUCTS[0]
  return { product, b: breakdown({ product: product.price * qty, agent: 0, delivery: 0 }) }
}

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
        {([['agent', 'Send My Agent (Inspect & Deliver)'], ['direct', 'Direct Shipping']] as const).map(([v, t]) => (
          <label key={v} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name="mode" className="h-5 w-5 accent-emerald" checked={mode === v} onChange={() => setMode(v)} />{t}
          </label>
        ))}
      </div>
      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-muted">{mode === 'agent' ? 'You send your own agent to inspect the goods at the seller, then deliver them to you.' : 'The seller ships directly. No agent inspection.'}</p>

      <Label>Delivery Destination</Label>
      <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Warehouse / port / city, country" aria-label="Delivery destination" />
      {tried && addrErr && <p role="alert" className="mt-1 text-xs text-red-600">{addrErr}</p>}

      <Label>Special Request (Optional)</Label>
      <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any special instruction..." />

      <button className={`${btn} mt-5 w-full`} onClick={next}>Continue</button>
    </div>
  )
}

/* ---------------- Assign your own agent ---------------- */
const CHECKS = ['Quality Check', 'Quantity Check', 'Condition Check', 'Specifications', 'Authenticity', 'Photos & Report']

export function SendAgent() {
  const nav = useNavigate()
  const toast = useToast()
  const d = loadDraft()
  const [agent, setAgent] = useState(d.agent)
  const [checks, setChecks] = useState(d.checks)
  const [address, setAddress] = useState(d.address)
  const [note, setNote] = useState(d.note)
  const [tried, setTried] = useState(false)

  const c = agent.contact.trim()
  const contactOk = /^\S+@\S+\.\S+$/.test(c) || c.replace(/\D/g, '').length >= 7
  const nameErr = agent.name.trim().length < 2 ? "Enter your agent's full name." : null
  const contactErr = !contactOk ? "Enter your agent's phone number or Saage email." : null

  function send() {
    setTried(true)
    if (nameErr || contactErr) return
    if (checks.length === 0) return toast('Select at least one inspection check.', 'err')
    if (!address.trim()) return toast('Delivery destination is required.', 'err')
    saveDraft({ agent, checks, address, note, mode: 'agent' })
    nav('/order/pay')
  }

  return (
    <div>
      <PageHeader title="Send Your Agent" />
      <p className="rounded-xl bg-emerald/10 p-3 text-xs text-forest">Your agent inspects the goods at the seller's location, then collects and delivers them to you. You agree the agent's fee and pay your agent directly. It is not part of escrow.</p>

      <Label>Your Agent</Label>
      <div className="space-y-2">
        <div className="relative"><User size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className={`${input} pl-9`} placeholder="Agent full name" aria-label="Agent full name" value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} /></div>
        {tried && nameErr && <p role="alert" className="text-xs text-red-600">{nameErr}</p>}
        <div className="relative"><Phone size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className={`${input} pl-9`} placeholder="Agent phone or Saage email" aria-label="Agent phone or email" value={agent.contact} onChange={(e) => setAgent({ ...agent, contact: e.target.value })} /></div>
        {tried && contactErr && <p role="alert" className="text-xs text-red-600">{contactErr}</p>}
        <div className="relative"><MapPin size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className={`${input} pl-9`} placeholder="Agent location (optional)" aria-label="Agent location" value={agent.location} onChange={(e) => setAgent({ ...agent, location: e.target.value })} /></div>
      </div>

      <Label>Inspection Details</Label>
      <div className="space-y-2.5">
        {CHECKS.map((k) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 rounded accent-emerald" checked={checks.includes(k)} onChange={(e) => setChecks(e.target.checked ? [...checks, k] : checks.filter((x) => x !== k))} />{k}
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
  const { b, product } = calc(d.productId, d.qty)
  const [agree, setAgree] = useState(false)
  const [dlg, setDlg] = useState(false)
  return (
    <div className="space-y-4">
      <PageHeader title="Payment Summary" />
      <div className={card}>
        <p className="text-sm font-bold">{product.name} — {d.qty.toLocaleString()} {product.unit}</p>
        <p className="text-xs text-muted">Deliver to {d.address}{d.mode === 'agent' ? ` · Your agent: ${d.agent.name || 'not set'}` : ' · Direct shipping (no agent)'}</p>
        <BreakdownTable rows={[
          ['Product amount', ngn(b.product), `${d.qty.toLocaleString()} × ${ngn(product.price)}`],
          [`Saage platform transaction fee (${b.pct}%)`, ngn(b.platform)],
        ]} total={ngn(b.total)} totalLabel="Total amount" />
      </div>
      <div className={card}>
        <p className="mb-1 text-sm font-bold">When both of you confirm</p>
        <BreakdownTable rows={[['Seller receives', ngn(b.sellerPayout), 'Full product amount, into the seller\'s wallet'], ['Saage platform fee', ngn(b.platformPayout)]]} />
      </div>
      <EscrowNote>Your money stays on hold in escrow and the seller cannot withdraw it. It goes to the seller's account only after your agent has inspected and delivered the goods and both you and the seller confirm the transaction.</EscrowNote>
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted">{d.mode === 'agent' ? "Your agent's fee is agreed with your agent and paid by you directly. It is not included here." : 'Direct shipping: delivery is arranged with the seller.'}</p>
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Payment is not connected in this build. No money is charged and escrow is not secured until a verified payment backend responds.</p>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have reviewed the payment breakdown and agree to the escrow terms.</label>
      <button className={`${btnAccent} w-full`} disabled={!agree} onClick={() => setDlg(true)}>Proceed to payment</button>
      <ConfirmDialog open={dlg} title="Payment provider not connected" confirmLabel="View order preview"
        body="No payment was made and escrow has not been secured. You can continue to preview how order tracking will look."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); resetConfirm(); nav('/order/track') }} />
    </div>
  )
}

/* ---------------- Track order ---------------- */
const STAGES = ['Payment secured', 'Your agent assigned', 'Inspection in progress', 'Inspection completed', 'Goods collected', 'In transit', 'Delivered to buyer', 'Awaiting buyer & seller confirmation', 'Payment released to seller']
const TIMES = ['Nov 17, 2026 · 9:40 AM', 'Nov 17, 2026 · 10:15 AM', 'Nov 17, 2026 · 11:30 AM', 'Nov 17, 2026 · 12:30 PM', 'Nov 18, 2026 · 8:00 AM', 'Nov 18, 2026 · 9:10 AM', 'Nov 18, 2026 · 1:45 PM', 'Waiting for both confirmations', 'Released after both confirmations']

export function TrackOrder() {
  const toast = useToast()
  const [raw, setRaw] = useState(7)
  const [conf, setConf] = useState(getConfirm())
  const [verdict, setVerdict] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [dlg, setDlg] = useState<null | 'approve' | 'reject'>(null)
  const d = loadDraft()
  const { b, product } = calc(DEMO_ORDER.productId, DEMO_ORDER.qty)
  const both = conf.buyer && conf.seller
  const stage = both ? 8 : Math.min(raw, 7)
  const steps: Step[] = STAGES.map((t, i) => ({ title: t, time: i <= stage ? TIMES[i] : undefined, state: i < stage ? 'done' : i === stage ? (i === 8 ? 'done' : 'current') : 'todo' }))
  const agentName = d.agent.name || 'Your agent'

  return (
    <div className="space-y-4">
      <PageHeader title={`Order ${DEMO_ORDER.ref}`} />
      <div className="flex justify-center"><span className="rounded-xl bg-emerald/10 px-8 py-2 text-lg font-extrabold text-emerald">{both ? 'Completed' : 'In Progress'}</span></div>

      <div className={`${card} flex items-center justify-between`}>
        <div><p className="text-xs text-muted">{both ? 'Released to seller' : 'Held in escrow (not withdrawable)'}</p><p className="text-lg font-extrabold text-emerald">{ngn(both ? b.sellerPayout : b.total)}</p><p className="text-xs text-muted">{product.name} · {DEMO_ORDER.qty} {product.unit} · Agent: {agentName}</p></div>
        <Badge tone="green">{both ? 'Payment released' : 'Payment secured'}</Badge>
      </div>

      <Timeline steps={steps} />

      <label className="block text-xs font-medium text-muted">Demo: preview another status
        <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-ink" value={stage} onChange={(e) => { setRaw(Number(e.target.value)); if (Number(e.target.value) < 8) { resetConfirm(); setConf(getConfirm()) } }}>{STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
      </label>

      {stage >= 3 && (
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Inspection report</p><Badge tone={verdict === 'approved' ? 'green' : verdict === 'rejected' ? 'red' : 'amber'}>{verdict === 'pending' ? 'Awaiting your approval' : verdict}</Badge></div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Art key={i} kind="timber" className="aspect-square w-full rounded-lg" />)}</div>
          <ul className="space-y-1 text-sm">
            {['Quality: Grade A teak, moisture within spec', `Quantity: ${DEMO_ORDER.qty} ${product.unit} verified`, 'Condition: no visible damage', 'Authenticity: documents match listing'].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" />{t}</li>)}
          </ul>
          <p className="flex items-center gap-1 text-xs text-muted"><Camera size={14} /> 3 photos, 1 video (sample report from your agent)</p>
          {verdict === 'pending' ? (
            <div className="grid grid-cols-3 gap-2">
              <button className={btn} onClick={() => setDlg('approve')}>Approve</button>
              <button className={btn2} onClick={() => setDlg('reject')}>Reject</button>
              <Link to="/disputes" className={btn2}>Complain</Link>
            </div>
          ) : <button className="text-xs font-semibold text-emerald" onClick={() => setVerdict('pending')}>Reset preview</button>}
        </div>
      )}

      {stage >= 6 && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>Buyer confirmation</span><Badge tone={conf.buyer ? 'green' : 'amber'}>{conf.buyer ? 'Confirmed' : 'Awaiting'}</Badge></div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>Seller confirmation</span><Badge tone={conf.seller ? 'green' : 'amber'}>{conf.seller ? 'Confirmed' : 'Awaiting'}</Badge></div>
        </div>
      )}

      {both ? (
        <div className="rounded-xl bg-emerald/10 p-3 text-sm text-forest"><b>{ngn(b.sellerPayout)}</b> goes to the seller's wallet. Preview only: the real release is done and verified by the backend.<button className="mt-2 block text-xs font-semibold text-emerald" onClick={() => { resetConfirm(); setConf(getConfirm()); setRaw(7) }}>Reset preview</button></div>
      ) : stage >= 6 && (
        <>
          {!conf.buyer && <Link to="/order/confirm" className={`${btn} w-full`}>Confirm Receipt</Link>}
          {conf.buyer && !conf.seller && (
            <div className="space-y-2"><p className="text-xs text-muted">You have confirmed. Waiting for the seller to confirm before the money is released to them.</p>
              <button className={`${btnS2} w-full py-2.5`} onClick={() => { setConfirm('seller'); setConf(getConfirm()); toast('Seller confirmation simulated (demo only).', 'warn') }}>Demo: simulate seller confirmation</button></div>
          )}
        </>
      )}
      <Link to="/messages" className={`${btn2} w-full`}>Contact My Agent</Link>

      <ConfirmDialog open={dlg === 'approve'} title="Approve the goods?" body="Your agent will be cleared to collect and deliver them to you. You can still dispute on arrival." confirmLabel="Approve"
        onCancel={() => setDlg(null)} onConfirm={() => { setVerdict('approved'); setDlg(null); toast('Goods approved (preview, not sent to a server).') }} />
      <ConfirmDialog open={dlg === 'reject'} danger title="Reject the goods?" body="Rejecting pauses the order. You can then raise a dispute so Saage can review the evidence." confirmLabel="Reject"
        onCancel={() => setDlg(null)} onConfirm={() => { setVerdict('rejected'); setDlg(null); toast('Goods rejected. Raise a dispute to continue.', 'warn') }} />
    </div>
  )
}

/* ---------------- Buyer confirms delivery ---------------- */
export function ConfirmRelease() {
  const toast = useToast()
  const nav = useNavigate()
  const { b } = calc(DEMO_ORDER.productId, DEMO_ORDER.qty)
  const [agree, setAgree] = useState(false)
  const [dlg, setDlg] = useState(false)
  return (
    <div className="space-y-4">
      <PageHeader title="Confirm & Pay" />
      <div className="pt-2 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-emerald text-emerald"><CheckCircle2 size={44} /></span>
        <h2 className="mt-3 text-xl font-extrabold">Goods Received!</h2>
        <p className="mx-auto max-w-[17rem] text-sm text-muted">Please confirm the goods arrived. The seller must confirm too before the money is released.</p>
      </div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm the goods delivered by my agent arrived in the agreed quantity and condition.</label>
      <button className={`${btn} w-full`} disabled={!agree} onClick={() => setDlg(true)}>Confirm Receipt</button>
      <div className="text-center text-sm">
        <p className="mb-1 text-muted">After both confirmations, payment goes to:</p>
        <p>• Seller: <b>Full Amount</b> ({ngn(b.sellerPayout)})</p>
        <p className="text-xs text-muted">Saage platform fee: {ngn(b.platformPayout)}</p>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Preview only. Releasing escrow must be performed and verified by the backend; this screen does not move money.</p>
      <Link to="/disputes" className={`${btn2} w-full`}>Raise a dispute instead</Link>
      <ConfirmDialog open={dlg} title="Confirm receipt?" confirmLabel="Confirm" body="Your confirmation is recorded. The money is released to the seller only after the seller also confirms and the backend completes its checks."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); setConfirm('buyer'); toast('Receipt confirmed (preview). Waiting for the seller.'); nav('/order/track') }} />
    </div>
  )
}
