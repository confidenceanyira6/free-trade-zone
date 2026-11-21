import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Bell, Lock, MapPin, Trash2 } from 'lucide-react'
import { localId, nowStr, pushNote, useCollection } from '../lib/repo'
import { SEED_DISPUTES, SEED_NOTES, SEED_REVIEWS, TXS } from '../lib/fixtures'
import type { Dispute, LocationRec, Note, Review } from '../lib/types'
import { api } from '../lib/api'
import { useRole } from '../lib/roles'
import { PageHeader, Tabs, useToast } from '../components/kit'
import { FilePick, Section, StarInput, Stars, StatusBadge, SyncBadge, useSync } from '../components/trust'
import { Badge, btn, btn2, card, Empty, input } from '../ui'

/* ======================= Precise locations ======================= */
const LOC_TYPES: Record<string, string[]> = {
  seller: ['Warehouse location', 'Factory location', 'Goods collection location'],
  buyer: ['Delivery destination'],
  agent: ['Inspection location (when required)'],
}

export function LocationsPage() {
  const role = useRole()
  const toast = useToast()
  const sync = useSync()
  const [locs, setLocs] = useCollection<LocationRec>('locations', [])
  const [label, setLabel] = useState(LOC_TYPES[role][0])
  const [precise, setPrecise] = useState('')
  const [approx, setApprox] = useState('')
  const mine = locs.filter((l) => l.role === role)
  async function save() {
    if (precise.trim().length < 8) return toast('Enter the full precise address.', 'err')
    if (!approx.trim()) return toast('Enter the general area (city and country).', 'err')
    const rec: LocationRec = { id: localId('LOC'), role, label, precise: precise.trim(), approx: approx.trim(), synced: false }
    setLocs((p) => [rec, ...p]); setPrecise(''); setApprox('')
    await sync(() => api.saveLocation(rec), 'Location saved securely.')
  }
  return (
    <div className="space-y-4">
      <PageHeader title="My Locations" back={false} />
      <div className="flex gap-2 rounded-xl bg-emerald/10 p-3 text-xs text-forest"><Lock size={16} className="mt-0.5 shrink-0" /><span><b>Privacy rule.</b> Your precise address is hidden by default. It is revealed only to the people who need it, after both parties accept a transaction and it starts. Other users only ever see the general area. This is enforced by the server, not just this screen.</span></div>
      <Section title="Add a location">
        {LOC_TYPES[role].length > 1 && <select className={input} aria-label="Location type" value={label} onChange={(e) => setLabel(e.target.value)}>{LOC_TYPES[role].map((l) => <option key={l}>{l}</option>)}</select>}
        {LOC_TYPES[role].length === 1 && <p className="text-sm font-semibold">{label}</p>}
        <input className={input} placeholder="Precise address (private)" aria-label="Precise address" value={precise} onChange={(e) => setPrecise(e.target.value)} />
        <input className={input} placeholder="General area shown to others (e.g. Ikorodu, Lagos)" aria-label="General area" value={approx} onChange={(e) => setApprox(e.target.value)} />
        <button className={`${btn} w-full`} onClick={save}>Save location</button>
      </Section>
      {mine.length === 0 ? <Empty text="No saved locations yet." /> : (
        <ul className="space-y-2">{mine.map((l) => (
          <li key={l.id} className={`${card} flex items-start gap-3`}><MapPin size={18} className="mt-0.5 text-emerald" /><div className="min-w-0 flex-1 text-sm"><p className="font-bold">{l.label}</p><p className="text-xs">{l.precise}</p><p className="text-xs text-muted">Public area: {l.approx}</p>{!l.synced && <SyncBadge synced={false} />}</div>
            <button aria-label="Delete location" className="p-1 text-red-600" onClick={() => setLocs((p) => p.filter((x) => x.id !== l.id))}><Trash2 size={16} /></button></li>
        ))}</ul>
      )}
    </div>
  )
}

/* ======================= Disputes ======================= */
const D_TYPES = ['Damaged goods', 'Missing quantity', 'Substituted goods', 'Failed delivery', 'Goods different from the listing', 'Seller refuses to cooperate']

export function DisputesPage() {
  const [sp] = useSearchParams()
  const toast = useToast()
  const sync = useSync()
  const [list, setList] = useCollection<Dispute>('disputes', SEED_DISPUTES)
  const [open, setOpen] = useState(!!sp.get('tx'))
  const [f, setF] = useState({ tx: sp.get('tx') ?? TXS[0].ref, type: D_TYPES[0], text: '', refund: true })
  const [ev, setEv] = useState<string[]>([])
  async function submit() {
    if (f.text.trim().length < 15) return toast('Describe what happened (at least 15 characters).', 'err')
    if (ev.length === 0) return toast('Add at least one piece of evidence.', 'err')
    const d: Dispute = { id: localId('DSP'), txRef: f.tx, type: f.type, text: f.text.trim(), evidence: ev, refund: f.refund, status: 'Submitted: funds on hold', synced: false, date: nowStr() }
    setList((p) => [d, ...p]); setOpen(false); setEv([]); setF({ ...f, text: '' })
    pushNote({ type: 'Dispute', text: `Dispute opened for ${f.tx}`, to: '/disputes' })
    await sync(() => api.openDispute(d), 'Dispute opened. The transaction is on hold.')
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Disputes" right={<button className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-bold text-white" onClick={() => setOpen(!open)}>New</button>} />
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Opening a dispute puts the transaction on hold, so the seller is not paid. It does <b>not</b> refund you automatically. An admin reviews the evidence, and money is refunded only if the delivery is found to have failed the agreement. The agent is still paid for inspection work already completed.</p>
      {open && (
        <Section title="Open a dispute">
          <select className={input} aria-label="Transaction" value={f.tx} onChange={(e) => setF({ ...f, tx: e.target.value })}>{TXS.map((t) => <option key={t.id}>{t.ref}</option>)}</select>
          <select className={input} aria-label="Problem type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{D_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <textarea className={input} rows={4} placeholder="Describe what happened…" aria-label="Details" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          <FilePick label="Evidence (photos, videos, documents)" names={ev} onChange={setEv} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald" checked={f.refund} onChange={(e) => setF({ ...f, refund: e.target.checked })} />I am requesting a refund</label>
          <button className={`${btn} w-full`} onClick={submit}>Submit dispute</button>
        </Section>
      )}
      {list.length === 0 ? <Empty text="No disputes." /> : (
        <ul className="space-y-3">{list.map((d) => (
          <li key={d.id} className={card}>
            <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{d.type}</p><p className="text-xs text-muted">{d.id} · {d.txRef}</p></div><Badge tone="red">{d.status}</Badge></div>
            <p className="mt-1 text-sm">{d.text}</p>
            <p className="mt-1 text-xs text-muted">{d.evidence.length} evidence file(s) · {d.refund ? 'Refund requested' : 'No refund requested'} · {d.date}</p>
            {!d.synced && <div className="mt-1"><SyncBadge synced={false} /></div>}
          </li>
        ))}</ul>
      )}
    </div>
  )
}

/* ======================= Reviews ======================= */
export function ReviewsPage() {
  const role = useRole()
  const sync = useSync()
  const toast = useToast()
  const [reviews, setReviews] = useCollection<Review>('reviews', SEED_REVIEWS)
  const [tab, setTab] = useState('To review')
  const [form, setForm] = useState<{ key: string; stars: number; text: string } | null>(null)
  const done = TXS.filter((t) => t.stage >= 10)
  const targets = done.flatMap((t) => role === 'buyer'
    ? [{ t, target: 'seller' as const, id: t.sellerId, name: t.seller }, ...(t.agentId ? [{ t, target: 'agent' as const, id: t.agentId, name: t.agentName ?? 'Agent' }] : [])]
    : role === 'seller' ? [{ t, target: 'buyer' as const, id: 'b1', name: t.buyer }] : [])
  const pending = targets.filter((x) => !reviews.some((r) => r.txRef === x.t.ref && r.target === x.target && r.by === 'You'))
  const shown = reviews.filter((r) => role === 'agent' ? r.target === 'agent' && r.targetId === 'a1' : role === 'seller' ? r.target === 'seller' : true)

  async function submit(x: (typeof targets)[number]) {
    if (!form || form.stars < 1) return toast('Choose a star rating.', 'err')
    if (form.text.trim().length < 10) return toast('Write a short review (at least 10 characters).', 'err')
    const r: Review = { id: localId('REV'), txRef: x.t.ref, target: x.target, targetId: x.id, targetName: x.name, stars: form.stars, text: form.text.trim(), date: new Date().toLocaleDateString(), by: 'You', synced: false }
    setReviews((p) => [r, ...p]); setForm(null)
    pushNote({ type: 'New rating', text: `You rated ${x.name}`, to: '/reviews' })
    await sync(() => api.submitReview(r), 'Review submitted.')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reviews" back={false} />
      <Tabs tabs={role === 'agent' ? ['All reviews'] : ['To review', 'All reviews']} value={role === 'agent' ? 'All reviews' : tab} onChange={setTab} />
      {role !== 'agent' && tab === 'To review' && (pending.length === 0 ? <Empty text="Nothing to review. You can review after a transaction is completed." /> : (
        <ul className="space-y-3">{pending.map((x) => {
          const key = `${x.t.ref}-${x.target}`
          return (
            <li key={key} className={`${card} space-y-2`}>
              <p className="text-sm font-bold">Rate {x.target}: {x.name}</p><p className="text-xs text-muted">Transaction {x.t.ref}</p>
              {form?.key === key ? (
                <>
                  <StarInput value={form.stars} onChange={(s) => setForm({ ...form, stars: s })} />
                  <textarea className={input} rows={3} placeholder="Write your review…" aria-label="Review" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
                  <div className="flex gap-2"><button className={`${btn} flex-1`} onClick={() => submit(x)}>Submit review</button><button className={`${btn2} flex-1`} onClick={() => setForm(null)}>Cancel</button></div>
                </>
              ) : <button className={`${btn2} w-full`} onClick={() => setForm({ key, stars: 0, text: '' })}>Write review</button>}
            </li>
          )
        })}</ul>
      ))}
      {(role === 'agent' || tab === 'All reviews') && (shown.length === 0 ? <Empty text="No reviews yet." /> : (
        <ul className="space-y-3">{shown.map((r) => (
          <li key={r.id} className={card}>
            <div className="flex items-center justify-between"><Stars value={r.stars} /><span className="text-xs text-muted">{r.date}</span></div>
            <p className="mt-1 text-sm">{r.text}</p>
            <p className="text-xs text-muted">{r.by} about {r.targetName} ({r.target}) · {r.txRef}</p>
            {!r.synced && <div className="mt-1"><SyncBadge synced={false} /></div>}
          </li>
        ))}</ul>
      ))}
    </div>
  )
}

/* ======================= Seller profile ======================= */
export function SellerProfile() {
  const { id } = useParams()
  const [reviews] = useCollection<Review>('reviews', SEED_REVIEWS)
  const t = TXS.find((x) => x.sellerId === id)
  const rv = reviews.filter((r) => r.target === 'seller' && r.targetId === id)
  if (!t) return <div><PageHeader title="Seller" /><Empty text="Seller not found." /></div>
  const avg = rv.length ? rv.reduce((s, r) => s + r.stars, 0) / rv.length : 0
  const completed = TXS.filter((x) => x.sellerId === id && x.stage >= 10).length
  return (
    <div className="space-y-4">
      <PageHeader title="Seller Profile" />
      <div className="text-center"><h2 className="flex items-center justify-center gap-1 text-lg font-extrabold">{t.seller}<BadgeCheck size={18} className="text-emerald" /></h2><p className="text-xs text-muted">Area: {t.approxFrom} (precise address hidden)</p><div className="mt-1 flex items-center justify-center gap-2"><Stars value={avg} /><b className="text-sm">{avg ? avg.toFixed(1) : 'New'}</b><span className="text-xs text-muted">({rv.length})</span></div></div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">{[['Completed', completed + 24], ['Business', 'Verified'], ['Reg. no.', 'RC 1234567']].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-muted">{k}</p><p className="text-sm font-extrabold">{v}</p></div>)}</div>
      <p className="text-[11px] text-muted">Business details shown here are sample data until verification records come from the backend.</p>
      {rv.map((r) => <div key={r.id} className={`${card} text-sm`}><div className="flex items-center justify-between"><Stars value={r.stars} /><span className="text-xs text-muted">{r.date}</span></div><p className="mt-1">{r.text}</p><p className="text-xs text-muted">{r.by} · {r.txRef}</p></div>)}
    </div>
  )
}

/* ======================= Notifications ======================= */
export function NotificationsPage() {
  const nav = useNavigate()
  const [notes, setNotes] = useCollection<Note>('notes', SEED_NOTES)
  const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago` }
  return (
    <div>
      <PageHeader title="Notifications" right={<button className="text-xs font-semibold text-emerald" onClick={() => setNotes((p) => p.map((n) => ({ ...n, read: true })))}>Read all</button>} />
      {notes.length === 0 ? <Empty text="You're all caught up." /> : (
        <ul className="divide-y divide-slate-100">{notes.map((n) => (
          <li key={n.id}>
            <button className="flex w-full items-center gap-3 py-3.5 text-left" onClick={() => { setNotes((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x))); nav(n.to) }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-100 text-accent"><Bell size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{n.type}</span><span className={`block text-sm ${n.read ? 'text-muted' : 'font-semibold'}`}>{n.text}</span></span>
              <span className="flex flex-col items-end gap-1 text-xs text-muted">{ago(n.time)}{!n.read && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
            </button>
          </li>
        ))}</ul>
      )}
      <p className="mt-4 text-center text-[11px] text-muted">Covers agent invitations, fee proposals, assignments, transaction requests, escrow, inspections, delivery, confirmations, payments, refunds, disputes and ratings.</p>
    </div>
  )
}

export { StatusBadge, Link }
