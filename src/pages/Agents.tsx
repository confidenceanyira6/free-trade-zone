import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, ImagePlus, Link2, Mail, MessageSquare, Phone, Plus, Send, Trash2 } from 'lucide-react'
import { localId, nowStr, pushNote, useCollection } from '../lib/repo'
import { SEED_AGENTS, SEED_ASSIGNMENTS, SEED_REVIEWS, seedChat } from '../lib/fixtures'
import type { AgentRec, Assignment, ChatMsg, Review } from '../lib/types'
import { api } from '../lib/api'
import { ngn } from '../lib/fees'
import { Avatar, ConfirmDialog, PageHeader, SectionTitle, useToast } from '../components/kit'
import { Section, Stars, StatusBadge, SyncBadge, useSync } from '../components/trust'
import { Badge, btn, btn2, btnS, btnS2, card, Empty, input } from '../ui'

const VERIF: Record<string, { tone: 'green' | 'amber' | 'slate'; text: string }> = {
  verified: { tone: 'green', text: 'Verified' }, pending: { tone: 'amber', text: 'Verification pending' }, unverified: { tone: 'slate', text: 'Not verified' },
}
const ACTIVE_SET = ['Pending', 'Accepted', 'In Progress', 'Inspection Completed']

/* ======================= Buyer: My Agents ======================= */
export function MyAgents() {
  const [agents, setAgents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const toast = useToast()
  const sync = useSync()
  const [adding, setAdding] = useState(false)
  const [ch, setCh] = useState<'phone' | 'email' | 'link'>('phone')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [rm, setRm] = useState<AgentRec | null>(null)

  async function invite() {
    if (name.trim().length < 2) return toast("Enter the agent's name.", 'err')
    if (ch === 'phone' && contact.replace(/\D/g, '').length < 7) return toast('Enter a valid phone number.', 'err')
    if (ch === 'email' && !/^\S+@\S+\.\S+$/.test(contact)) return toast('Enter a valid email address.', 'err')
    const id = localId('AGT')
    setAgents((p) => [...p, { id, name: name.trim(), contact: ch === 'link' ? 'Invitation link' : contact.trim(), channel: ch, status: 'invited', verification: 'unverified', active: false, rating: 0, completed: 0, area: '-', joined: '-', synced: false }])
    pushNote({ type: 'New agent invitation', text: `Invitation prepared for ${name.trim()}`, to: '/agents' })
    await sync(() => api.inviteAgent({ channel: ch, contact, name }), 'Invitation sent.')
    if (ch === 'link') setLink(`${window.location.origin}/invite/${id} (placeholder: the server will issue the real link)`)
    setName(''); setContact('')
    if (ch !== 'link') setAdding(false)
  }

  const load = (id: string) => asg.filter((a) => a.agentId === id && ACTIVE_SET.includes(a.status)).length
  const toggle = async (a: AgentRec) => {
    setAgents((p) => p.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)))
    await sync(() => api.setAgentActive(a.id, !a.active), a.active ? 'Agent deactivated.' : 'Agent activated.')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="My Agents" back={false} right={<button className={btnS} onClick={() => setAdding(!adding)}><Plus size={14} />Add Agent</button>} />
      <p className="text-xs text-muted">These are your own agents. They work for you, can run several inspections at the same time, and only see the assignments you give them.</p>

      {adding && (
        <Section title="Invite an agent">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1" role="tablist">
            {([['phone', 'Phone', Phone], ['email', 'Email', Mail], ['link', 'Link', Link2]] as const).map(([k, l, I]) => (
              <button key={k} role="tab" aria-selected={ch === k} onClick={() => setCh(k)} className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-xs font-bold ${ch === k ? 'bg-emerald text-white' : ''}`}><I size={13} />{l}</button>
            ))}
          </div>
          <input className={input} placeholder="Agent's full name" aria-label="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
          {ch !== 'link' && <input className={input} type={ch === 'email' ? 'email' : 'tel'} placeholder={ch === 'email' ? 'Agent email' : 'Agent phone number'} aria-label="Agent contact" value={contact} onChange={(e) => setContact(e.target.value)} />}
          {ch === 'link' && <p className="text-xs text-muted">A one-time invitation link is created on the server. Share it with your agent.</p>}
          <button className={`${btn} w-full`} onClick={invite}>{ch === 'link' ? 'Create invitation link' : 'Send invitation'}</button>
          {link && <p className="break-all rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{link}</p>}
        </Section>
      )}

      {agents.length === 0 ? <Empty text="No agents yet. Invite your first agent." /> : (
        <ul className="space-y-3">
          {agents.map((a) => (
            <li key={a.id} className={card}>
              <div className="flex items-start gap-3">
                <Avatar name={a.name} size="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <Link to={`/agents/${a.id}`} className="flex items-center gap-1 text-sm font-bold">{a.name}{a.verification === 'verified' && <BadgeCheck size={15} className="text-emerald" />}</Link>
                  <p className="truncate text-xs text-muted">{a.contact} · {a.area}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge tone={a.status === 'accepted' ? 'green' : 'amber'}>{a.status === 'accepted' ? 'Joined' : 'Invited'}</Badge>
                    <Badge tone={VERIF[a.verification].tone}>{VERIF[a.verification].text}</Badge>
                    {a.synced === false && <SyncBadge synced={false} />}
                  </div>
                  <p className="mt-1 text-xs text-muted">{load(a.id)} active assignment(s) · {a.completed} completed · <Stars value={a.rating} size={11} /></p>
                </div>
                {a.status === 'accepted' && (
                  <button role="switch" aria-checked={a.active} aria-label={`${a.active ? 'Deactivate' : 'Activate'} ${a.name}`} onClick={() => toggle(a)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${a.active ? 'bg-emerald' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${a.active ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/agents/${a.id}`} className={btnS2}>Profile</Link>
                {a.status === 'accepted' && <Link to={`/agents/${a.id}/chat`} className={btnS2}><MessageSquare size={13} />Chat & fee</Link>}
                {a.status === 'accepted' && a.active && <Link to={`/assignments/new?agent=${a.id}`} className={btnS}>Assign task</Link>}
                {a.status === 'invited' && <button className={btnS2} onClick={() => { setAgents((p) => p.map((x) => (x.id === a.id ? { ...x, status: 'accepted', active: true, verification: 'pending', joined: 'Nov 2026' } : x))); pushNote({ type: 'Agent acceptance', text: `${a.name} accepted your invitation`, to: '/agents' }); toast('Demo: agent accepted the invitation.', 'warn') }}>Demo: agent accepts</button>}
                <button className="ml-auto rounded-lg p-1.5 text-red-600" aria-label={`Remove ${a.name}`} onClick={() => setRm(a)}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={!!rm} danger title="Remove this agent?" confirmLabel="Remove" body={`${rm?.name} will lose access to all your assignments. Completed work and ratings stay on record.`}
        onCancel={() => setRm(null)} onConfirm={async () => { const a = rm!; setRm(null); setAgents((p) => p.filter((x) => x.id !== a.id)); await sync(() => api.removeAgent(a.id), 'Agent removed.') }} />
    </div>
  )
}

/* ======================= Agent profile ======================= */
export function AgentProfile() {
  const { id } = useParams()
  const [agents, setAgents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const [reviews] = useCollection<Review>('reviews', SEED_REVIEWS)
  const sync = useSync()
  const a = agents.find((x) => x.id === id)
  if (!a) return <Empty text="Agent not found. They may not be one of your agents." />
  const mine = asg.filter((x) => x.agentId === a.id)
  const rv = reviews.filter((r) => r.target === 'agent' && r.targetId === a.id)
  const avg = rv.length ? rv.reduce((s, r) => s + r.stars, 0) / rv.length : a.rating
  return (
    <div className="space-y-4">
      <PageHeader title="Agent Profile" />
      <div className="flex flex-col items-center gap-1 text-center">
        <Avatar name={a.name} size="h-20 w-20 text-2xl" />
        <h2 className="flex items-center gap-1 text-lg font-extrabold">{a.name}{a.verification === 'verified' && <BadgeCheck size={18} className="text-emerald" />}</h2>
        <p className="text-xs text-muted">{a.area} · {a.contact}</p>
        <div className="flex items-center gap-2"><Stars value={avg} /><b className="text-sm">{avg ? avg.toFixed(1) : 'New'}</b><span className="text-xs text-muted">({rv.length} reviews)</span></div>
        <Badge tone={VERIF[a.verification].tone}>{VERIF[a.verification].text}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {[['Completed', a.completed + mine.filter((x) => x.status === 'Approved').length], ['Active', mine.filter((x) => ACTIVE_SET.includes(x.status)).length], ['Status', a.active ? 'Active' : 'Inactive']].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-muted">{k}</p><p className="text-base font-extrabold">{v}</p></div>)}
      </div>
      {a.status === 'accepted' && (
        <div className="grid grid-cols-2 gap-2">
          <Link to={`/agents/${a.id}/chat`} className={btn2}><MessageSquare size={15} />Chat & fee</Link>
          <Link to={`/assignments/new?agent=${a.id}`} className={btn}>Assign task</Link>
          <button className={`${btn2} col-span-2`} onClick={async () => { setAgents((p) => p.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))); await sync(() => api.setAgentActive(a.id, !a.active), a.active ? 'Agent deactivated.' : 'Agent activated.') }}>{a.active ? 'Deactivate agent' : 'Activate agent'}</button>
        </div>
      )}
      <SectionTitle title="Assignments" />
      {mine.length === 0 ? <p className="text-sm text-muted">No assignments yet.</p> : mine.map((x) => <Link key={x.id} to={`/assignments/${x.id}`} className={`${card} flex items-center justify-between text-sm`}><span><b>{x.id}</b><span className="block text-xs text-muted">{x.kind}</span></span><StatusBadge status={x.status} /></Link>)}
      <SectionTitle title="Reviews" />
      {rv.length === 0 ? <p className="text-sm text-muted">No reviews yet.</p> : rv.map((r) => <div key={r.id} className={`${card} text-sm`}><div className="flex items-center justify-between"><Stars value={r.stars} /><span className="text-xs text-muted">{r.date}</span></div><p className="mt-1">{r.text}</p><p className="text-xs text-muted">{r.by} · {r.txRef}</p></div>)}
    </div>
  )
}

/* ======================= Private chat + fee negotiation ======================= */
export function AgentChat({ as }: { as: 'buyer' | 'agent' }) {
  const params = useParams()
  const agentId = as === 'agent' ? 'a1' : (params.id as string)
  const [agents] = useCollection<AgentRec>('agents', SEED_AGENTS)
  const seed = useMemo(() => seedChat(agentId), [agentId])
  const [msgs, setMsgs] = useCollection<ChatMsg>(`chat:${agentId}`, seed)
  const sync = useSync()
  const toast = useToast()
  const [text, setText] = useState('')
  const [feeIn, setFeeIn] = useState('')
  const [counter, setCounter] = useState<string | null>(null)
  const [counterVal, setCounterVal] = useState('')
  const agent = agents.find((x) => x.id === agentId)
  if (!agent) return <Empty text="Agent not found." />
  if (as === 'buyer' && agent.status !== 'accepted') return <Empty text="This agent has not accepted your invitation yet." />

  const other = as === 'buyer' ? 'agent' : 'buyer'
  const agreed = [...msgs].reverse().find((m) => m.kind === 'fee' && m.fee?.state === 'accepted')
  const add = (m: Omit<ChatMsg, 'id' | 'time'>) => setMsgs((p) => [...p, { ...m, id: localId('MSG'), time: nowStr() }])

  function sendText() {
    if (!text.trim()) return
    add({ from: as, kind: 'text', text: text.trim() }); setText('')
    sync(() => api.sendChat(agentId, { kind: 'text', text }), 'Message sent.')
  }
  function propose(raw: string) {
    const amount = Number(raw.replace(/\D/g, ''))
    if (!amount || amount < 1000) return toast('Enter a fee of at least ₦1,000.', 'err')
    setMsgs((p) => [...p.map((m) => (m.kind === 'fee' && m.fee?.state === 'proposed' && m.from !== as ? { ...m, fee: { ...m.fee!, state: 'countered' as const } } : m)), { id: localId('MSG'), from: as, kind: 'fee', text: as === 'buyer' ? 'Agreed fee entered by buyer' : 'Inspection fee proposal', fee: { amount, state: 'proposed' }, time: nowStr() }])
    pushNote({ type: 'Agent fee proposal', text: `${as === 'buyer' ? 'Buyer' : agent!.name} proposed ${ngn(amount)}`, to: as === 'buyer' ? `/agents/${agentId}/chat` : '/agent/chat' })
    setFeeIn(''); setCounter(null); setCounterVal('')
    sync(() => api.proposeFee(agentId, amount), 'Fee proposal sent.')
  }
  function respond(m: ChatMsg, action: 'accept' | 'reject') {
    setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, fee: { ...x.fee!, state: action === 'accept' ? 'accepted' : 'rejected' } } : x)))
    if (action === 'accept') pushNote({ type: 'Agent fee acceptance', text: `Fee of ${ngn(m.fee!.amount)} agreed`, to: as === 'buyer' ? `/agents/${agentId}/chat` : '/agent/chat' })
    sync(() => api.respondFee(m.id, action), action === 'accept' ? 'Fee accepted.' : 'Fee rejected.')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
        <Avatar name={as === 'buyer' ? agent.name : 'Buyer John'} online />
        <div><p className="text-sm font-bold">{as === 'buyer' ? agent.name : 'Buyer John (your buyer)'}</p><p className="text-xs text-muted">Private chat. Sellers cannot see it.</p></div>
      </div>

      <div className={`${card} border-emerald/40 bg-emerald/5`}>
        <p className="text-xs font-semibold text-muted">Agreed Agent Fee</p>
        {agreed ? (
          <>
            <p className="text-2xl font-extrabold text-emerald">{ngn(agreed.fee!.amount)}</p>
            <p className="text-xs text-muted">Agreed by both of you. When the transaction starts, this amount is reserved from the buyer's escrow for the agent and stays secured until the job is done.</p>
          </>
        ) : <p className="text-sm text-muted">No fee agreed yet. Negotiate below. An assignment cannot start until both of you agree.</p>}
        <div className="mt-3 flex gap-2">
          <input className={input} inputMode="numeric" aria-label={as === 'buyer' ? 'Agreed agent fee' : 'Propose inspection fee'} placeholder={as === 'buyer' ? 'Enter agreed fee (₦)' : 'Propose your fee (₦)'} value={feeIn ? Number(feeIn).toLocaleString() : ''} onChange={(e) => setFeeIn(e.target.value.replace(/\D/g, ''))} />
          <button className={btnS} onClick={() => propose(feeIn)}>{as === 'buyer' ? 'Set fee' : 'Propose'}</button>
        </div>
        {as === 'buyer' && <p className="mt-1 text-[11px] text-muted">The agent must confirm the fee you enter before it becomes active.</p>}
      </div>

      <div className="max-h-[45vh] min-h-[10rem] space-y-2 overflow-y-auto" aria-live="polite">
        {msgs.length === 0 && <p className="py-6 text-center text-sm text-muted">Say hello to start negotiating.</p>}
        {msgs.map((m) => {
          const mine = m.from === as
          if (m.kind === 'fee') return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="w-[85%] rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                <p className="text-xs text-muted">{m.text} · {mine ? 'you' : other}</p>
                <p className="text-lg font-extrabold">{ngn(m.fee!.amount)}</p>
                <Badge tone={m.fee!.state === 'accepted' ? 'green' : m.fee!.state === 'proposed' ? 'amber' : 'slate'}>{m.fee!.state}</Badge>
                {m.fee!.state === 'proposed' && !mine && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2"><button className={btnS} onClick={() => respond(m, 'accept')}>Accept</button><button className={btnS2} onClick={() => respond(m, 'reject')}>Reject</button><button className={btnS2} onClick={() => setCounter(counter === m.id ? null : m.id)}>Counter</button></div>
                    {counter === m.id && <div className="flex gap-2"><input className={input} inputMode="numeric" aria-label="Counter offer" placeholder="Counter (₦)" value={counterVal ? Number(counterVal).toLocaleString() : ''} onChange={(e) => setCounterVal(e.target.value.replace(/\D/g, ''))} /><button className={btnS} onClick={() => propose(counterVal)}>Send</button></div>}
                  </div>
                )}
              </div>
            </div>
          )
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-emerald text-white' : 'rounded-bl-sm bg-slate-100'}`}>
                {m.attach && <p className="mb-1 flex items-center gap-1 text-xs font-semibold"><ImagePlus size={14} />{m.attach}</p>}
                {m.text && <p>{m.text}</p>}
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{m.time}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <label className="cursor-pointer rounded-full p-2 text-slate-500" aria-label="Send an image"><ImagePlus size={20} /><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { add({ from: as, kind: 'image', text: '', attach: f.name }); sync(() => api.sendChat(agentId, { kind: 'image', text: '' }), 'Image sent.') } e.target.value = '' }} /></label>
        <input aria-label="Message" className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/30" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} />
        <button aria-label="Send message" onClick={sendText} className="grid h-10 w-10 place-items-center rounded-full bg-emerald text-white"><Send size={18} /></button>
      </div>
      {as === 'buyer' && agreed && <Link to={`/assignments/new?agent=${agentId}`} className={`${btn} w-full`}>Assign a task to {agent.name.split(' ')[0]}</Link>}
    </div>
  )
}

/* ======================= Agent: My Buyer ======================= */
export function MyBuyer() {
  const [asg] = useCollection<Assignment>('assignments', SEED_ASSIGNMENTS)
  const mine = asg.filter((a) => a.agentId === 'a1')
  return (
    <div className="space-y-4">
      <PageHeader title="My Buyer" back={false} />
      <div className={`${card} flex items-center gap-3`}>
        <Avatar name="Buyer John" size="h-14 w-14" />
        <div className="flex-1"><p className="text-sm font-bold">Buyer John</p><p className="text-xs text-muted">Lagos, Nigeria · you work for this buyer</p><Badge tone="green">Verified buyer</Badge></div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-muted">Assignments</p><p className="text-base font-extrabold">{mine.length}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-muted">Completed</p><p className="text-base font-extrabold">{mine.filter((a) => a.status === 'Approved').length}</p></div>
      </div>
      <Link to="/agent/chat" className={`${btn} w-full`}><MessageSquare size={16} />Chat & fee negotiation</Link>
      <Link to="/agent/tasks" className={`${btn2} w-full`}>Assigned tasks</Link>
      <p className="text-xs text-muted">You can only see transactions and assignments this buyer gives you.</p>
    </div>
  )
}

export function AgentChatPage() {
  return <div><PageHeader title="Buyer Chat & Fees" /><AgentChat as="agent" /></div>
}
export function BuyerAgentChatPage() {
  return <div><PageHeader title="Chat & Fee" /><AgentChat as="buyer" /></div>
}
