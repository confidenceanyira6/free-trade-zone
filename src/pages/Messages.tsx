import { FormEvent, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, card, Empty, input, Loading } from '../ui'

export default function Messages() {
  const { session } = useAuth()
  const uid = session!.user.id
  const [convs, setConvs] = useState<any[] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('conversation_participants').select('conversation_id,conversation:conversations(id,kind,created_at,product:products(name))').eq('user_id', uid)
      .then(({ data }) => { const rows = data ?? []; setConvs(rows); if (rows[0]) setActive(rows[0].conversation_id) })
  }, [uid])

  useEffect(() => {
    if (!active) return
    supabase.from('messages').select('*').eq('conversation_id', active).order('created_at').then(({ data }) => setMsgs(data ?? []))
    const ch = supabase.channel(`msgs-${active}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, (p) => setMsgs((m) => m.some((x) => x.id === p.new.id) ? m : [...m, p.new]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [active])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !active) return
    const body = text.trim(); setText('')
    const { error } = await supabase.from('messages').insert({ conversation_id: active, sender_id: uid, body })
    if (error) alert(error.message)
  }
  async function report(id: string) {
    const reason = prompt('Why are you reporting this message?'); if (!reason) return
    const { error } = await supabase.from('reports').insert({ reporter_id: uid, message_id: id, reason })
    alert(error ? error.message : 'Report submitted. Our team will review it.')
  }

  if (convs === null) return <Loading />
  if (convs.length === 0) return <Empty text="No conversations yet. Contact a supplier from a product page." />
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className={`${card} space-y-1`}>
        {convs.map((c) => (
          <button key={c.conversation_id} onClick={() => setActive(c.conversation_id)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${active === c.conversation_id ? 'bg-emerald/10 font-semibold' : 'hover:bg-slate-50'}`}>
            {c.conversation?.product?.name ?? c.conversation?.kind} <span className="block text-xs text-muted">{new Date(c.conversation?.created_at).toLocaleDateString()}</span>
          </button>
        ))}
      </div>
      <div className={`${card} flex h-[28rem] flex-col md:col-span-2`}>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === uid ? 'justify-end' : ''}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender_id === uid ? 'bg-emerald text-white' : 'bg-slate-100'}`}>
                {m.body}
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}{m.sender_id !== uid && <button onClick={() => report(m.id)} className="underline">report</button>}</div>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2"><input className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" /><button className={btn}>Send</button></form>
      </div>
    </div>
  )
}
