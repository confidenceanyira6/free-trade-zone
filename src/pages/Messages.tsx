import { useState } from 'react'
import { ArrowLeft, FileText, ImagePlus, Paperclip, Send } from 'lucide-react'
import { Avatar, PageHeader, Tabs } from '../components/kit'
import { Empty } from '../ui'

type Msg = { from: 'me' | 'them'; text: string; time: string; attach?: string }
type Conv = { id: string; name: string; role: string; online: boolean; unread: number; msgs: Msg[] }

const START: Conv[] = [
  { id: 'c1', name: 'Buyer John', role: 'Buyer', online: true, unread: 1, msgs: [{ from: 'them', text: 'Hello, is the teak still available?', time: '10:12 AM' }, { from: 'me', text: 'Yes, 500 m³ ready for inspection.', time: '10:20 AM' }, { from: 'them', text: 'Please confirm receipt.', time: '10:30 AM' }] },
  { id: 'c2', name: 'Seller Grace', role: 'Seller', online: false, unread: 0, msgs: [{ from: 'them', text: 'Order update?', time: '9:50 AM' }] },
  { id: 'c3', name: 'Chinedu Agent', role: 'Agent', online: true, unread: 0, msgs: [{ from: 'them', text: 'Inspection finished. Report uploaded.', time: 'Yesterday' }] },
]

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function Messages() {
  const [convs, setConvs] = useState(START)
  const [tab, setTab] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState('')
  const conv = convs.find((c) => c.id === open)

  const add = (m: Msg) => setConvs(convs.map((c) => (c.id === open ? { ...c, unread: 0, msgs: [...c.msgs, m] } : c)))
  const send = () => { if (!text.trim()) return; add({ from: 'me', text: text.trim(), time: now() }); setText('') }

  if (conv) return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
        <button aria-label="Back to conversations" onClick={() => setOpen(null)} className="rounded-full p-2"><ArrowLeft size={20} /></button>
        <Avatar name={conv.name} size="h-10 w-10" online={conv.online} />
        <div><p className="text-sm font-bold">{conv.name}</p><p className="text-xs text-muted">{conv.online ? 'Online' : 'Offline'} · Order #SZF8723</p></div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pb-3" aria-live="polite">
        {conv.msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'rounded-br-sm bg-emerald text-white' : 'rounded-bl-sm bg-slate-100'}`}>
              {m.attach && <p className="mb-1 flex items-center gap-1 text-xs font-semibold opacity-90"><FileText size={14} />{m.attach}</p>}
              {m.text && <p>{m.text}</p>}
              <p className={`mt-0.5 text-[10px] ${m.from === 'me' ? 'text-white/70' : 'text-muted'}`}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <label className="cursor-pointer rounded-full p-2 text-slate-500" aria-label="Share image"><ImagePlus size={20} /><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) add({ from: 'me', text: '', time: now(), attach: f.name }); e.target.value = '' }} /></label>
        <label className="cursor-pointer rounded-full p-2 text-slate-500" aria-label="Share document"><Paperclip size={20} /><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) add({ from: 'me', text: '', time: now(), attach: f.name }); e.target.value = '' }} /></label>
        <input aria-label="Message" className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/30" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button aria-label="Send message" onClick={send} className="grid h-10 w-10 place-items-center rounded-full bg-emerald text-white"><Send size={18} /></button>
      </div>
    </div>
  )

  const list = convs.filter((c) => tab === 'All' || c.role === tab)
  return (
    <div>
      <PageHeader title="Messages" back={false} />
      <Tabs tabs={['All', 'Buyer', 'Seller', 'Agent']} value={tab} onChange={setTab} />
      {list.length === 0 ? <Empty text="No conversations here." /> : (
        <ul className="divide-y divide-slate-100">
          {list.map((c) => {
            const last = c.msgs[c.msgs.length - 1]
            return (
              <li key={c.id}>
                <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => { setOpen(c.id); setConvs(convs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))) }}>
                  <Avatar name={c.name} online={c.online} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{c.name}</span><span className="block truncate text-xs text-muted">{last.attach ? `📎 ${last.attach}` : last.text}</span></span>
                  <span className="flex flex-col items-end gap-1 text-[11px] text-muted">{last.time}{c.unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{c.unread}</span>}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
