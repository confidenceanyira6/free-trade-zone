import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Camera, MapPin } from 'lucide-react'
import { localId, nowStr, pushNote, useCollection } from '../lib/repo'
import { SEED_AGENTS, SEED_ASSIGNMENTS, TXS, seedChat } from '../lib/fixtures'
import type { AgentRec, Assignment, ChatMsg, Report, TaskStatus } from '../lib/types'
import { api } from '../lib/api'
import { ngn } from '../lib/fees'
import { useRole } from '../lib/roles'
import { ConfirmDialog, PageHeader, Tabs, Timeline, Step, useToast } from '../components/kit'
import { FilePick, LockedLocation, Section, StatusBadge, SyncBadge, useSync } from '../components/trust'
import { Badge, btn, btn2, btnS2, card, Empty, input } from '../ui'

const ME = 'a1' // the signed-in agent in the demo. The server derives this from the login.
const KINDS = ['Inspect goods at seller location', 'Inspect another supplier', 'Verify seller warehouse', 'Supervise delivery']
const FLOW: TaskStatus[] = ['Pending', 'Accepted', 'In Progress', 'Inspection Completed', 'Approved']

function FeeBox({ a }: { a: Assignment }) {
  const note = a.status === 'Approved'
    ? "The buyer approved your work, so your fee is released to your account independently of the seller's payment."
    : a.feeStatus === 'reserved' ? "Payment secured: reserved from the buyer's escrow. Released to the agent only after the agreed conditions are completed."
      : a.feeStatus === 'agreed' ? "Agreed. It is reserved from the buyer's escrow when the transaction begins."
        : 'Both parties must agree a fee in the private chat before this task can start.'
  return (
    <div className="rounded-xl bg-emerald/10 p-3">
      <p className="text-xs font-semibold text-muted">Agreed Agent Fee</p>
      <p className="text-xl font-extrabold text-emerald">{a.feeStatus === 'none' ? 'Not agreed yet' : ngn(a.fee)}</p>
      <p className="text-xs text-forest">{note}</p>
    </div>
  )
}

/* ======================= List (buyer + agent) ======================= */
export function AssignmentsList() {
  const role = useRole()
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const isAgent = role === 'agent'
  const tabs = isAgent ? ['All', 'Upcoming', 'Active', 'Reports', 'Completed'] : ['All', 'Pending', 'Active', 'Reports', 'Closed']
  const [tab, setTab] = useState('All')
  const base = isAgent ? asg.filter((a) => a.agentId === ME) : asg
  const test: Record<string, (a: Assignment) => boolean> = {
    All: () => true, Pending: (a) => a.status === 'Pending', Upcoming: (a) => ['Pending', 'Accepted'].includes(a.status), Active: (a) => a.status === 'In Progress' || (!isAgent && a.status === 'Accepted'),
    Reports: (a) => a.status === 'Inspection Completed', Completed: (a) => a.status === 'Approved', Closed: (a) => ['Approved', 'Rejected', 'Cancelled'].includes(a.status),
  }
  const list = base.filter(test[tab])
  return (
    <div>
      <PageHeader title={isAgent ? 'Assigned Tasks' : 'My Assignments'} back={false} right={!isAgent ? <Link to="/assignments/new" className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-bold text-white">New</Link> : undefined} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {list.length === 0 ? <Empty text="No assignments here." /> : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/assignments/${a.id}`} className={`${card} block`}>
                <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{a.kind}</p><p className="text-xs text-muted">{a.id}</p></div><StatusBadge status={a.status} /></div>
                <p className="mt-1 text-xs text-muted">{a.goods} · {a.seller}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span>{isAgent ? 'Your fee' : `Agent: ${agents.find((x) => x.id === a.agentId)?.name ?? 'Unknown'}`}</span>
                  <b className="text-emerald">{a.feeStatus === 'none' ? 'Fee not agreed' : ngn(a.fee)}{a.feeStatus === 'reserved' ? ' · secured' : ''}</b>
                </div>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">Deadline {a.deadline}{!a.synced && <SyncBadge synced={false} />}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ======================= Create (buyer) ======================= */
export function AssignmentNew() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const toast = useToast()
  const sync = useSync()
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const [, setAsg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const usable = agents.filter((a) => a.status === 'accepted' && a.active)
  const [agentId, setAgentId] = useState(sp.get('agent') ?? usable[0]?.id ?? '')
  const seed = useMemo(() => seedChat(agentId), [agentId])
  const [chat] = useCollection<ChatMsg>(`chat:${agentId}`, seed)
  const agreed = [...chat].reverse().find((m) => m.kind === 'fee' && m.fee?.state === 'accepted')?.fee?.amount ?? 0
  const [f, setF] = useState({ kind: KINDS[0], desc: '', seller: '', goods: '', area: '', precise: '', deadline: '', tx: sp.get('tx') ?? '' })
  const [tried, setTried] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const today = new Date().toISOString().slice(0, 10)
  const err = (k: keyof typeof f) => tried && !String(f[k]).trim() ? 'Required' : null

  async function save() {
    setTried(true)
    if (!agentId) return toast('Choose one of your active agents.', 'err')
    if (!f.desc.trim() || !f.seller.trim() || !f.goods.trim() || !f.area.trim() || !f.deadline) return toast('Please complete all required fields.', 'err')
    if (f.deadline < today) return toast('The deadline cannot be in the past.', 'err')
    const id = localId('ASG')
    const tx = TXS.find((t) => t.id === f.tx)
    const a: Assignment = { id, txRef: tx?.ref, agentId, kind: f.kind, desc: f.desc.trim(), seller: f.seller.trim(), goods: f.goods.trim(), location: f.precise.trim() || `${f.area.trim()} (area)`, deadline: f.deadline, fee: agreed, feeStatus: agreed ? 'agreed' : 'none', status: 'Pending', synced: false, created: nowStr() }
    setAsg((p) => [a, ...p])
    pushNote({ type: 'New task assignment', text: `${f.kind} assigned to ${agents.find((x) => x.id === agentId)?.name}`, to: `/assignments/${id}` })
    await sync(() => api.createAssignment(a), 'Assignment created.')
    nav(`/assignments/${id}`)
  }

  if (usable.length === 0) return <div><PageHeader title="New Assignment" /><Empty text="You have no active agents. Invite or activate an agent first." /><Link to="/agents" className={`${btn} mt-3 w-full`}>Go to My Agents</Link></div>
  return (
    <div className="space-y-3">
      <PageHeader title="New Assignment" />
      <label className="block text-sm font-bold">Assigned agent
        <select className={`${input} mt-1`} value={agentId} onChange={(e) => setAgentId(e.target.value)}>{usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <div className="rounded-xl bg-emerald/10 p-3">
        <p className="text-xs font-semibold text-muted">Agreed Agent Fee</p>
        <p className="text-xl font-extrabold text-emerald">{agreed ? ngn(agreed) : 'Not agreed yet'}</p>
        {!agreed && <p className="text-xs text-forest">The task is created but stays Pending until you and the agent agree a fee in <Link to={`/agents/${agentId}/chat`} className="font-bold underline">the private chat</Link>.</p>}
      </div>
      <label className="block text-sm font-bold">Task type<select className={`${input} mt-1`} value={f.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
      <label className="block text-sm font-bold">Task description<textarea className={`${input} mt-1`} rows={3} placeholder="What must the agent check?" value={f.desc} onChange={set('desc')} />{err('desc') && <span className="text-xs font-normal text-red-600">{err('desc')}</span>}</label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-bold">Seller<input className={`${input} mt-1`} placeholder="Seller name" value={f.seller} onChange={set('seller')} /></label>
        <label className="block text-xs font-bold">Goods<input className={`${input} mt-1`} placeholder="e.g. Teak, 500 m³" value={f.goods} onChange={set('goods')} /></label>
      </div>
      <label className="block text-sm font-bold">Inspection area
        <input className={`${input} mt-1`} placeholder="City / region, e.g. Ikorodu, Lagos" value={f.area} onChange={set('area')} />
        {err('area') && <span className="text-xs font-normal text-red-600">Required</span>}</label>
      <label className="block text-xs font-bold">Precise address (optional)
        <input className={`${input} mt-1`} placeholder="Only if the seller has already shared it with you" value={f.precise} onChange={set('precise')} />
        <span className="mt-1 block text-[11px] font-normal text-muted">Once the transaction starts, the server sends the seller's saved precise location to your agent. You never need to type it. The agent sees it only after accepting the task.</span></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-bold">Inspection deadline<input type="date" min={today} className={`${input} mt-1`} value={f.deadline} onChange={set('deadline')} /></label>
        <label className="block text-xs font-bold">Linked transaction<select className={`${input} mt-1`} value={f.tx} onChange={set('tx')}><option value="">None yet</option>{TXS.map((t) => <option key={t.id} value={t.id}>{t.ref}</option>)}</select></label>
      </div>
      <button className={`${btn} w-full`} onClick={save}>Create assignment</button>
    </div>
  )
}

/* ======================= Detail (buyer + agent) ======================= */
export function AssignmentDetail() {
  const { id } = useParams()
  const role = useRole()
  const toast = useToast()
  const sync = useSync()
  const [asg, setAsg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const a = asg.find((x) => x.id === id)
  const isAgent = role === 'agent'
  const [rep, setRep] = useState({ goodsExist: false, quality: '', quantity: '', measurements: '', comments: '', recommendation: 'approve' as 'approve' | 'reject' })
  const [photos, setPhotos] = useState<string[]>([])
  const [videos, setVideos] = useState<string[]>([])
  const [docs, setDocs] = useState<string[]>([])
  const [evid, setEvid] = useState<string[]>([])
  const [clar, setClar] = useState('')
  const [dlg, setDlg] = useState<null | { action: 'approve' | 'reject' | 'reinspect' | 'cancel' | 'decline'; title: string; body: string }>(null)

  if (!a) return <Empty text="Assignment not found." />
  // UI mirror of the server rule: an agent can only open tasks assigned to them.
  if (isAgent && a.agentId !== ME) return <div><PageHeader title="Assignment" /><Empty text="You do not have access to this assignment." /></div>
  const agent = agents.find((x) => x.id === a.agentId)
  const patch = (p: Partial<Assignment>) => setAsg((all) => all.map((x) => (x.id === a.id ? { ...x, ...p, synced: false } : x)))
  const accepted = a.status !== 'Pending' && a.status !== 'Cancelled'
  const steps: Step[] = FLOW.map((s, i) => ({ title: s, state: a.status === 'Rejected' || a.status === 'Cancelled' ? 'todo' : i < FLOW.indexOf(a.status) ? 'done' : i === FLOW.indexOf(a.status) ? 'current' : 'todo' }))

  const agentAct = {
    accept: async () => { if (a.feeStatus === 'none') return toast('A fee must be agreed in the chat before you can accept.', 'err'); patch({ status: 'Accepted' }); pushNote({ type: 'Agent acceptance', text: `${agent?.name ?? 'Agent'} accepted ${a.id}`, to: `/assignments/${a.id}` }); await sync(() => api.respondAssignment(a.id, 'accept'), 'Task accepted.') },
    start: async () => { patch({ status: 'In Progress' }); pushNote({ type: 'Inspection update', text: `${a.id} inspection started`, to: `/assignments/${a.id}` }); await sync(() => api.startAssignment(a.id), 'Inspection started.') },
  }

  async function submitReport() {
    if (!rep.goodsExist) return toast('Confirm that the goods exist at the location.', 'err')
    if (rep.quality.trim().length < 5) return toast('Describe the quality you found.', 'err')
    if (!rep.quantity.trim()) return toast('Enter the verified quantity.', 'err')
    if (photos.length === 0) return toast('Upload at least one inspection photograph.', 'err')
    const report: Report = { ...rep, photos, videos, docs, submittedAt: nowStr(), clarifications: [] }
    patch({ status: 'Inspection Completed', report })
    pushNote({ type: 'Inspection update', text: `Inspection report submitted for ${a!.id}`, to: `/assignments/${a!.id}` })
    await sync(() => api.submitReport(a!.id, report), 'Inspection report submitted.')
  }

  async function confirmDialog() {
    const d = dlg!; setDlg(null)
    const map = { approve: 'Approved', reject: 'Rejected', reinspect: 'In Progress', cancel: 'Cancelled', decline: 'Cancelled' } as const
    patch({ status: map[d.action] })
    pushNote({ type: d.action === 'approve' ? 'Inspection approval' : 'Inspection update', text: `${a!.id}: ${d.title}`, to: `/assignments/${a!.id}` })
    await sync(() => (d.action === 'decline' ? api.respondAssignment(a!.id, 'decline') : api.decideReport(a!.id, d.action as any)), 'Updated.')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Assignment" />
      <div className={card}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-extrabold">{a.kind}</p><p className="text-xs text-muted">{a.id}{a.txRef ? ` · ${a.txRef}` : ''}</p></div><div className="flex flex-col items-end gap-1"><StatusBadge status={a.status} />{!a.synced && <SyncBadge synced={false} />}</div></div>
        <p className="mt-2 text-sm">{a.desc}</p>
        <dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between"><dt className="text-muted">Assigned agent</dt><dd className="font-semibold">{agent?.name ?? 'Unknown'}</dd></div><div className="flex justify-between"><dt className="text-muted">Seller</dt><dd className="font-semibold">{a.seller}</dd></div><div className="flex justify-between"><dt className="text-muted">Goods</dt><dd className="font-semibold">{a.goods}</dd></div><div className="flex justify-between"><dt className="text-muted">Deadline</dt><dd className="font-semibold">{a.deadline}</dd></div></dl>
      </div>
      <FeeBox a={a} />
      <LockedLocation visible={isAgent ? accepted : true} label={isAgent ? 'Inspection location (assigned to you)' : 'Inspection location'} value={a.location} approx="shown after you accept the task" />
      <div className={card}><Timeline steps={steps} /></div>

      {/* Agent actions */}
      {isAgent && a.status === 'Pending' && <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={agentAct.accept}>Accept task</button><button className={btn2} onClick={() => setDlg({ action: 'decline', title: 'Task declined', body: 'The buyer will be told you declined this task.' })}>Decline</button></div>}
      {isAgent && a.status === 'Accepted' && <button className={`${btn} w-full`} onClick={agentAct.start}>Start inspection</button>}
      {isAgent && a.status === 'In Progress' && (
        <Section title="Inspection report">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-emerald" checked={rep.goodsExist} onChange={(e) => setRep({ ...rep, goodsExist: e.target.checked })} />I confirm the goods exist at the location</label>
          <label className="block text-xs font-bold">Quality report<textarea className={`${input} mt-1`} rows={2} placeholder="Grade, moisture, defects…" value={rep.quality} onChange={(e) => setRep({ ...rep, quality: e.target.value })} /></label>
          <label className="block text-xs font-bold">Quantity verification<input className={`${input} mt-1`} placeholder="e.g. 498 m³ counted on site" value={rep.quantity} onChange={(e) => setRep({ ...rep, quantity: e.target.value })} /></label>
          <label className="block text-xs font-bold">Measurements<input className={`${input} mt-1`} placeholder="Dimensions, stack counts…" value={rep.measurements} onChange={(e) => setRep({ ...rep, measurements: e.target.value })} /></label>
          <label className="block text-xs font-bold">Comments<textarea className={`${input} mt-1`} rows={2} value={rep.comments} onChange={(e) => setRep({ ...rep, comments: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2 text-sm">{(['approve', 'reject'] as const).map((r) => <label key={r} className={`flex items-center gap-2 rounded-xl border p-2.5 ${rep.recommendation === r ? 'border-emerald bg-emerald/5' : 'border-slate-200'}`}><input type="radio" name="rec" className="accent-emerald" checked={rep.recommendation === r} onChange={() => setRep({ ...rep, recommendation: r })} />Recommend {r}</label>)}</div>
          <FilePick label="Photographs" accept="image/*" names={photos} onChange={setPhotos} />
          <FilePick label="Videos" accept="video/*" names={videos} onChange={setVideos} />
          <FilePick label="Documents (quality report, certificates)" accept=".pdf,.doc,.docx" names={docs} onChange={setDocs} />
          <button className={`${btn} w-full`} onClick={submitReport}>Submit inspection report</button>
        </Section>
      )}
      {isAgent && a.txRef && accepted && a.status !== 'Cancelled' && (
        <Section title="Delivery supervision">
          <p className="text-xs text-muted">If you supervise the delivery, upload evidence along the way.</p>
          <FilePick label="Delivery evidence (photos, videos, documents)" names={evid} onChange={setEvid} />
          <button className={`${btnS2} w-full py-2.5`} onClick={async () => { if (!evid.length) return toast('Choose evidence to upload.', 'err'); patch({ deliveryEvidence: [...(a.deliveryEvidence ?? []), ...evid] }); pushNote({ type: 'Delivery update', text: `Delivery evidence added to ${a.id}`, to: `/assignments/${a.id}` }); setEvid([]); await sync(() => api.uploadDeliveryEvidence(a.id, { files: evid }), 'Evidence added.') }}><Camera size={14} />Add evidence</button>
          {(a.deliveryEvidence ?? []).length > 0 && <p className="text-xs text-muted">{a.deliveryEvidence!.length} item(s): {a.deliveryEvidence!.join(', ')}</p>}
        </Section>
      )}

      {/* Report (both) */}
      {a.report && (
        <Section title="Inspection report">
          <div className="flex items-center gap-2 text-sm"><span className="text-xs text-muted">Goods exist at the location</span><Badge tone={a.report.goodsExist ? 'green' : 'red'}>{a.report.goodsExist ? 'Confirmed' : 'Not confirmed'}</Badge></div>
          <dl className="space-y-2 text-sm">{([['Quality', a.report.quality], ['Quantity', a.report.quantity], ['Measurements', a.report.measurements], ['Comments', a.report.comments]] as const).map(([k, v]) => v ? <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div> : null)}</dl>
          <div className="flex items-center gap-2"><span className="text-xs text-muted">Agent recommends</span><Badge tone={a.report.recommendation === 'approve' ? 'green' : 'red'}>{a.report.recommendation}</Badge></div>
          <p className="text-xs text-muted">{a.report.photos.length} photo(s), {a.report.videos.length} video(s), {a.report.docs.length} document(s): {[...a.report.photos, ...a.report.videos, ...a.report.docs].join(', ')}</p>
          {a.report.clarifications.length > 0 && <div className="rounded-lg bg-amber-50 p-2 text-xs"><b>Clarification requests</b>{a.report.clarifications.map((c, i) => <p key={i}>{c}</p>)}</div>}
        </Section>
      )}

      {/* Buyer decisions */}
      {!isAgent && a.status === 'Inspection Completed' && (
        <Section title="Your decision">
          <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setDlg({ action: 'approve', title: 'Goods approved', body: 'Approving tells the seller they can dispatch. The seller cannot skip this step.' })}>Approve</button><button className={btn2} onClick={() => setDlg({ action: 'reject', title: 'Goods rejected', body: 'The transaction will not proceed to delivery. Refund rules apply to what you already funded.' })}>Reject</button></div>
          <button className={`${btn2} w-full`} onClick={() => setDlg({ action: 'reinspect', title: 'Another inspection requested', body: 'The agent will be asked to inspect again.' })}>Request another inspection</button>
          <div className="flex gap-2"><input className={input} placeholder="Ask the agent a question…" aria-label="Clarification" value={clar} onChange={(e) => setClar(e.target.value)} /><button className={btnS2} onClick={async () => { if (!clar.trim()) return toast('Write your question first.', 'err'); patch({ report: { ...a.report!, clarifications: [...a.report!.clarifications, clar.trim()] } }); pushNote({ type: 'Inspection update', text: `Clarification requested on ${a.id}`, to: `/assignments/${a.id}` }); setClar(''); await sync(() => api.decideReport(a.id, 'clarify', clar), 'Question sent.') }}>Ask</button></div>
        </Section>
      )}
      {!isAgent && (a.status === 'Pending' || a.status === 'Accepted') && <button className={`${btn2} w-full text-red-600`} onClick={() => setDlg({ action: 'cancel', title: 'Assignment cancelled', body: 'Cancelling follows the transaction cancellation and refund rules. Any reserved agent fee is handled by the server.' })}>Cancel assignment</button>}
      <p className="flex items-start gap-1 text-[11px] text-muted"><MapPin size={12} className="mt-0.5 shrink-0" />Status changes here are saved on this device until the backend is connected. Payments and escrow are never changed from the app.</p>

      <ConfirmDialog open={!!dlg} danger={dlg?.action === 'reject' || dlg?.action === 'cancel' || dlg?.action === 'decline'} title={dlg?.title ?? ''} body={dlg?.body} confirmLabel="Confirm" onCancel={() => setDlg(null)} onConfirm={confirmDialog} />
    </div>
  )
}
