import { useState } from 'react'
import { SEED_ASSIGNMENTS, SEED_DISPUTES, SEED_REVIEWS, TXS, FLOW, deliveryOf, ledgerFor } from '../lib/fixtures'
import type { Assignment, Dispute, Review } from '../lib/types'
import { api } from '../lib/api'
import { PLATFORM_FEE_PCT, escrowBreakdown, ngn } from '../lib/fees'
import { useCollection } from '../lib/repo'
import { ConfirmDialog, PageHeader, Stat, Tabs } from '../components/kit'
import { Section, Stars, StatusBadge, useRun } from '../components/trust'
import { Badge, btnS, btnS2, card, input } from '../ui'

const TABS = ['Overview', 'Users', 'Transactions', 'Escrow', 'Inspections', 'Deliveries', 'Disputes', 'Ratings', 'Ledger']
const USERS = [
  { id: 'u1', name: 'Buyer John', role: 'Buyer', v: 'verified' }, { id: 'u2', name: 'Lagos Timber Co.', role: 'Seller', v: 'verified' },
  { id: 'u3', name: 'Chinedu Okafor', role: 'Agent', v: 'verified' }, { id: 'u4', name: 'Amaka Okoro', role: 'Agent', v: 'pending' }, { id: 'u5', name: 'Delta Palm Ltd', role: 'Seller', v: 'pending' },
]

/** Admin console. Every button here only REQUESTS an action: the server checks the admin role, writes the immutable ledger and applies it. */
export default function Admin() {
  const run = useRun()
  const [tab, setTab] = useState('Overview')
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const [disputes] = useCollection<Dispute>('disputes', SEED_DISPUTES)
  const [reviews] = useCollection<Review>('reviews', SEED_REVIEWS)
  const [act, setAct] = useState<null | { title: string; ok: string; call: (note: string) => Promise<any> }>(null)
  const [note, setNote] = useState('')
  const ask = (title: string, ok: string, call: (n: string) => Promise<any>) => { setNote(''); setAct({ title, ok, call }) }

  const held = TXS.filter((t) => t.stage >= 2 && t.stage < 10)
  const sum = (f: (b: ReturnType<typeof escrowBreakdown>) => number, ts = TXS) => ts.reduce((s, t) => s + f(escrowBreakdown(t)), 0)

  return (
    <div>
      <PageHeader title="Admin" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Sample data. Actions are sent to the backend, which must verify the admin role and record every financial action in the append-only ledger. Nothing is changed from this screen.</p>

      {tab === 'Overview' && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Buyers" value="640" /><Stat label="Sellers" value="420" /><Stat label="Agents" value="224" /><Stat label="Transactions" value={String(TXS.length)} />
          <Stat label="Held in escrow" value={ngn(sum((b) => b.buyerTotal, held))} tone="text-accent" />
          <Stat label={`Platform fees (${PLATFORM_FEE_PCT}%)`} value={ngn(sum((b) => b.platformFee, TXS.filter((t) => t.stage >= 10)))} />
          <Stat label="Open disputes" value={String(disputes.length)} tone="text-red-600" /><Stat label="On hold" value={String(TXS.filter((t) => t.hold).length)} />
        </div>
      )}

      {tab === 'Users' && (
        <ul className="space-y-2">{USERS.map((u) => (
          <li key={u.id} className={`${card} flex items-center gap-2`}><div className="flex-1"><p className="text-sm font-bold">{u.name}</p><p className="text-xs text-muted">{u.role}</p></div><Badge tone={u.v === 'verified' ? 'green' : 'amber'}>{u.v}</Badge>
            {u.v !== 'verified' && <><button className={btnS} onClick={() => run(() => api.admin.setVerification(u.id, 'verified'), 'Verified.')}>Verify</button><button className={btnS2} onClick={() => run(() => api.admin.setVerification(u.id, 'rejected'), 'Rejected.')}>Reject</button></>}</li>
        ))}</ul>
      )}

      {tab === 'Transactions' && (
        <ul className="space-y-2">{TXS.map((t) => (
          <li key={t.id} className={card}><div className="flex items-start justify-between"><div><p className="text-sm font-bold">{t.ref}</p><p className="text-xs text-muted">{t.product} · {t.buyer} → {t.seller}</p></div>{t.hold ? <StatusBadge status="On Hold" /> : <Badge tone="orange">{FLOW[t.stage]}</Badge>}</div>
            <button className={`${btnS2} mt-2`} onClick={() => ask(`Freeze ${t.ref}?`, 'Freeze requested.', (n) => api.admin.freezeTransaction(t.id, n))}>Freeze transaction</button></li>
        ))}</ul>
      )}

      {tab === 'Escrow' && (
        <ul className="space-y-2">{TXS.filter((t) => t.stage >= 2).map((t) => { const b = escrowBreakdown(t); return (
          <li key={t.id} className={card}><p className="text-sm font-bold">{t.ref} <span className="text-xs font-normal text-muted">{t.stage >= 10 ? 'released' : t.hold ? 'held (dispute)' : 'held'}</span></p>
            <dl className="mt-1 space-y-0.5 text-xs"><div className="flex justify-between"><dt>Goods</dt><dd>{ngn(b.goods)}</dd></div><div className="flex justify-between"><dt>Delivery</dt><dd>{ngn(b.delivery)}</dd></div><div className="flex justify-between"><dt>Agent fee</dt><dd>{ngn(b.agentFee)}</dd></div><div className="flex justify-between font-bold"><dt>Total</dt><dd>{ngn(b.buyerTotal)}</dd></div></dl>
            {t.stage < 10 && <div className="mt-2 flex gap-2"><button className={btnS} onClick={() => ask(`Authorize release for ${t.ref}?`, 'Release requested.', (n) => api.admin.authorizeRelease(t.id, n))}>Authorize release</button><button className={btnS2} onClick={() => ask(`Authorize refund for ${t.ref}?`, 'Refund requested.', (n) => api.admin.authorizeRefund(t.id, n))}>Authorize refund</button></div>}</li>
        ) })}</ul>
      )}

      {tab === 'Inspections' && (
        <ul className="space-y-2">{asg.map((a) => <li key={a.id} className={card}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{a.id}</p><p className="text-xs text-muted">{a.kind} · {a.goods}</p>{a.report && <p className="text-xs">{a.report.photos.length} photos · {a.report.videos.length} videos · recommends {a.report.recommendation}</p>}</div><StatusBadge status={a.status} /></div></li>)}</ul>
      )}

      {tab === 'Deliveries' && (
        <ul className="space-y-2">{TXS.filter((t) => deliveryOf(t.stage)).map((t) => <li key={t.id} className={`${card} flex items-center justify-between text-sm`}><span><b>{t.ref}</b><span className="block text-xs text-muted">{t.approxFrom} → {t.approxTo}</span></span><Badge tone="orange">{t.hold ? 'Disputed' : deliveryOf(t.stage)}</Badge></li>)}</ul>
      )}

      {tab === 'Disputes' && (
        <ul className="space-y-3">{disputes.map((d) => (
          <li key={d.id} className={`${card} space-y-2`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{d.type}</p><p className="text-xs text-muted">{d.id} · {d.txRef}</p></div><Badge tone="red">{d.status}</Badge></div>
            <p className="text-sm">{d.text}</p><p className="text-xs text-muted">Evidence: {d.evidence.join(', ')}</p>
            <div className="flex flex-wrap gap-2">
              <button className={btnS} onClick={() => ask(`Refund the buyer for ${d.id}?`, 'Resolution requested.', (n) => api.admin.resolveDispute(d.id, 'refund_buyer', n))}>Refund buyer</button>
              <button className={btnS2} onClick={() => ask(`Release to seller for ${d.id}?`, 'Resolution requested.', (n) => api.admin.resolveDispute(d.id, 'release_to_seller', n))}>Release to seller</button>
              <button className={btnS2} onClick={() => ask(`Reject ${d.id}?`, 'Resolution requested.', (n) => api.admin.resolveDispute(d.id, 'reject_dispute', n))}>Reject dispute</button>
            </div>
            <p className="text-[11px] text-muted">A dispute never refunds automatically. The agent's fee for completed inspection work is decided separately.</p></li>
        ))}</ul>
      )}

      {tab === 'Ratings' && (
        <ul className="space-y-2">{reviews.map((r) => <li key={r.id} className={card}><div className="flex items-center justify-between"><Stars value={r.stars} /><span className="text-xs text-muted">{r.date}</span></div><p className="mt-1 text-sm">{r.text}</p><p className="text-xs text-muted">{r.by} about {r.targetName} · {r.txRef}</p></li>)}</ul>
      )}

      {tab === 'Ledger' && (
        <Section title="Transaction ledger (append-only)">
          <ul className="space-y-1 text-xs">{TXS.flatMap((t) => ledgerFor(t, t.stage)).map((r) => <li key={r.ref} className="flex justify-between gap-2"><span><b>{r.ref}</b> {r.text}</span><span className="font-semibold">{r.amount ? ngn(r.amount) : ''}</span></li>)}</ul>
          <p className="text-[11px] text-muted">Sample. In production the ledger can only be appended to, never edited or deleted.</p>
        </Section>
      )}

      <ConfirmDialog open={!!act} title={act?.title ?? ''} confirmLabel="Submit" body={<div className="space-y-2"><p>Every admin action needs a reason and is logged.</p><textarea className={input} rows={3} placeholder="Reason / notes (required, 5+ characters)" aria-label="Reason" value={note} onChange={(e) => setNote(e.target.value)} /></div>} onCancel={() => setAct(null)}
        onConfirm={async () => { if (note.trim().length < 5) return; const a = act!; setAct(null); await run(() => a.call(note), a.ok) }} />
    </div>
  )
}
