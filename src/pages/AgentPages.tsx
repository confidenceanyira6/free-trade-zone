import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, MessageSquare, Phone, Star } from 'lucide-react'
import { DEMO_TASKS, DEMO_TX, DEMO_WALLET, DemoTask } from '../lib/demo'
import { PLATFORM_FEE_PCT, ngn } from '../lib/fees'
import { ConfirmDialog, DemoBanner, PageHeader, SectionTitle, Stat, Tabs, Timeline, Step, useToast } from '../components/kit'
import { Badge, btn, btn2, btnAccent, card, Empty, input } from '../ui'

const TABS: Record<string, DemoTask['status']> = { Available: 'available', Active: 'active', Deliveries: 'delivery', Completed: 'done' }

export function AgentTasks({ initial = 'Available' }: { initial?: string }) {
  const toast = useToast()
  const [tab, setTab] = useState(initial)
  const [tasks, setTasks] = useState(DEMO_TASKS)
  const [dlg, setDlg] = useState<{ id: string; kind: 'accept' | 'reject' } | null>(null)
  const list = tasks.filter((t) => t.status === TABS[tab])
  const target = tasks.find((t) => t.id === dlg?.id)

  function apply() {
    if (!dlg) return
    setTasks(dlg.kind === 'accept' ? tasks.map((t) => (t.id === dlg.id ? { ...t, status: 'active' } : t)) : tasks.filter((t) => t.id !== dlg.id))
    toast(dlg.kind === 'accept' ? 'Task accepted (preview). Open it to start the inspection.' : 'Task declined (preview).')
    setDlg(null)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={initial === 'Deliveries' ? 'Deliveries' : 'Tasks'} back={false} />
      <DemoBanner />
      <Tabs tabs={Object.keys(TABS)} value={tab} onChange={setTab} />
      {list.length === 0 ? <Empty text="Nothing here right now." /> : (
        <div className="space-y-3">
          {list.map((t) => (
            <div key={t.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">Inspect {t.product}</p><p className="text-xs text-muted">Order {t.order} · {t.qty}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin size={12} />{t.location} → {t.destination}</p></div>
                <Badge tone={t.status === 'available' ? 'amber' : 'green'}>{t.status === 'delivery' ? 'delivery' : t.status}</Badge>
              </div>
              <p className="mt-3 rounded-xl bg-emerald/10 px-3 py-2 text-sm">You will earn <b className="text-emerald">{ngn(t.commission)}</b> commission</p>
              <div className="mt-3 flex gap-2">
                {t.status === 'available' ? (
                  <>
                    <button className={`${btn} flex-1`} onClick={() => setDlg({ id: t.id, kind: 'accept' })}>Accept</button>
                    <button className={`${btn2} flex-1`} onClick={() => setDlg({ id: t.id, kind: 'reject' })}>Reject</button>
                    <Link to={`/agent/tasks/${t.id}`} className={btn2}>Details</Link>
                  </>
                ) : <Link to={`/agent/tasks/${t.id}`} className={`${btnAccent} flex-1`}>Open task</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!dlg} danger={dlg?.kind === 'reject'} title={dlg?.kind === 'accept' ? 'Accept this task?' : 'Reject this task?'} confirmLabel={dlg?.kind === 'accept' ? 'Accept' : 'Reject'}
        body={dlg?.kind === 'accept' ? `You will inspect and deliver ${target?.product} for a commission of ${ngn(target?.commission ?? 0)}.` : 'This task will be removed from your list.'}
        onCancel={() => setDlg(null)} onConfirm={apply} />
    </div>
  )
}

const CK = ['Inspect product quality', 'Confirm quantity', 'Verify product condition', 'Check specifications', 'Verify authenticity']
const STAGE = ['Inspection', 'Awaiting buyer approval', 'Approved: ready to collect', 'Goods collected', 'In transit', 'Delivered']

export function AgentTask() {
  const { id } = useParams()
  const toast = useToast()
  const task = DEMO_TASKS.find((t) => t.id === id)
  const [checks, setChecks] = useState<string[]>([])
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [videos, setVideos] = useState<string[]>([])
  const [proof, setProof] = useState<string[]>([])
  const [stage, setStage] = useState(0)
  const [dlg, setDlg] = useState(false)

  if (!task) return <Empty text="Task not found." />
  const steps: Step[] = STAGE.map((s, i) => ({ title: s, state: i < stage ? 'done' : i === stage ? 'current' : 'todo' }))

  function submitReport() {
    if (checks.length < CK.length) return toast('Complete every checklist item first.', 'err')
    if (!qty.trim()) return toast('Enter the verified quantity.', 'err')
    if (photos.length === 0) return toast('Upload at least one inspection photo.', 'err')
    setDlg(true)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title={`Task ${task.order}`} />
      <DemoBanner />
      <div className={card}>
        <p className="font-bold">{task.product} · {task.qty}</p>
        <p className="mt-1 text-sm">Commission: <b className="text-emerald">{ngn(task.commission)}</b></p>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted"><MapPin size={12} />Inspection: {task.location}</p>
        <p className="flex items-center gap-1 text-xs text-muted"><MapPin size={12} />Delivery: {task.destination}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[['Seller', task.seller, task.sellerPhone], ['Buyer', task.buyer, task.buyerPhone]].map(([r, n, p]) => (
            <div key={r} className="rounded-xl bg-slate-50 p-2"><p className="text-muted">{r}</p><p className="font-semibold">{n}</p><div className="mt-1 flex gap-3"><a href={`tel:${p}`} aria-label={`Call ${r}`} className="text-emerald"><Phone size={16} /></a><Link to="/messages" aria-label={`Message ${r}`} className="text-emerald"><MessageSquare size={16} /></Link></div></div>
          ))}
        </div>
      </div>

      <div className={card}><Timeline steps={steps} /></div>

      {stage === 0 && (
        <div className={`${card} space-y-3`}>
          <p className="font-bold">Inspection checklist</p>
          {CK.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} />{c}</label>
          ))}
          <p className="text-xs text-muted">{checks.length} of {CK.length} completed</p>
          <input className={input} aria-label="Verified quantity" placeholder={`Verified quantity (${task.qty} expected)`} value={qty} onChange={(e) => setQty(e.target.value)} />
          <textarea className={input} rows={3} placeholder="Condition & specification notes" aria-label="Inspection notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <label className="block text-xs font-medium">Inspection photographs<input type="file" accept="image/*" multiple className="mt-1 block w-full text-xs" onChange={(e) => setPhotos(Array.from(e.target.files ?? []).map((f) => f.name))} /></label>
          <label className="block text-xs font-medium">Inspection videos (optional)<input type="file" accept="video/*" multiple className="mt-1 block w-full text-xs" onChange={(e) => setVideos(Array.from(e.target.files ?? []).map((f) => f.name))} /></label>
          <p className="text-xs text-muted">{photos.length} photo(s), {videos.length} video(s) selected (not uploaded in preview)</p>
          <button className={`${btn} w-full`} onClick={submitReport}>Submit inspection report</button>
        </div>
      )}
      {stage === 1 && (
        <div className={`${card} space-y-3`}><p className="text-sm">Report sent to the buyer. Goods can only be collected after the buyer approves them.</p>
          <button className={`${btn2} w-full`} onClick={() => setStage(2)}>Preview: buyer approved</button></div>
      )}
      {stage === 2 && <button className={`${btn} w-full`} onClick={() => { setStage(3); toast('Goods collection recorded (preview).') }}>Confirm goods collected</button>}
      {stage === 3 && <button className={`${btn} w-full`} onClick={() => { setStage(4); toast('Delivery started (preview).') }}>Start delivery to buyer</button>}
      {stage === 4 && (
        <div className={`${card} space-y-3`}>
          <p className="font-bold">Proof of delivery</p>
          <input type="file" accept="image/*,.pdf" aria-label="Proof of delivery" className="block w-full text-xs" onChange={(e) => setProof(Array.from(e.target.files ?? []).map((f) => f.name))} />
          <button className={`${btn} w-full`} onClick={() => { if (proof.length === 0) return toast('Upload proof of delivery first.', 'err'); setStage(5); toast('Proof recorded (preview). Awaiting buyer and seller confirmation.') }}>Confirm arrival & submit proof</button>
        </div>
      )}
      {stage === 5 && (
        <div className={`${card} space-y-2 text-sm`}>
          <p className="font-bold">Delivered</p>
          <div className="flex justify-between"><span>Buyer confirmation</span><Badge tone="amber">Awaiting</Badge></div>
          <div className="flex justify-between"><span>Seller confirmation</span><Badge tone="amber">Awaiting</Badge></div>
          <p className="text-xs text-muted">Your commission is released after both confirmations and backend checks.</p>
          <Link to="/agent/earnings" className={`${btn2} w-full`}>View earnings</Link>
        </div>
      )}

      <ConfirmDialog open={dlg} title="Submit inspection report?" confirmLabel="Submit" body="The buyer will see your findings, photos and videos. You cannot edit the report afterwards."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); setStage(1); toast('Inspection report submitted (preview).') }} />
    </div>
  )
}

export function AgentEarnings() {
  const w = DEMO_WALLET.agent
  const tx = DEMO_TX.agent
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Earnings" back={false} />
      <DemoBanner />
      <div className="rounded-3xl bg-gradient-to-br from-forest to-emerald p-5 text-white shadow-lg">
        <p className="text-sm text-white/80">Total earnings</p><p className="text-3xl font-extrabold">{ngn(w.total)}</p>
        <p className="mt-3 text-sm text-white/80">Available balance</p><p className="text-xl font-bold">{ngn(w.available)}</p>
        <Link to="/wallet/withdraw" className={`${btnAccent} mt-4 w-full`}>Withdraw</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pending commissions" value={ngn(w.pending)} tone="text-accent" sub="Held until confirmations" />
        <Stat label="Rating" value={<span className="inline-flex items-center gap-1"><Star size={18} className="fill-accent text-accent" />4.8</span>} sub="120 completed inspections" />
      </div>
      <p className="rounded-xl bg-white p-3 text-xs text-muted ring-1 ring-slate-100">Commission is shown on every task before you accept. Saage charges a {PLATFORM_FEE_PCT}% platform fee on the buyer's product amount, not on your commission.</p>
      <SectionTitle title="Transaction History" to="/wallet" />
      <div className="space-y-2">{tx.map((t) => (
        <div key={t.id} className={`${card} flex items-center justify-between`}><div><p className="text-sm font-semibold">{t.title}</p><p className="text-xs text-muted">{t.date}</p></div><b className={t.amount > 0 ? 'text-emerald' : ''}>{t.amount > 0 ? '+' : '−'}{ngn(Math.abs(t.amount))}</b></div>
      ))}</div>
    </div>
  )
}
