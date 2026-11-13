import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { btn, btn2, Badge, card, Empty, ErrorMsg } from '../ui'

export default function Admin() {
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [pending, setPending] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    const s = await supabase.rpc('admin_dashboard_stats'); if (s.error) setErr(s.error.message); else setStats(s.data)
    const p = await supabase.from('companies').select('id,name,country,business_types,created_at').eq('verification_status', 'pending').order('created_at')
    setPending(p.data ?? [])
  }
  useEffect(() => { load() }, [])

  async function review(id: string, status: 'verified' | 'rejected') {
    const reason = status === 'rejected' ? prompt('Reason for rejection?') : null
    if (status === 'rejected' && !reason) return
    const { error } = await supabase.rpc('admin_review_company', { p_company_id: id, p_status: status, p_reason: reason })
    if (error) setErr(error.message); else load()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administration</h1>
      <ErrorMsg msg={err} />
      {stats && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(stats).map(([k, v]) => (
        <div key={k} className={card}><p className="text-xs uppercase text-muted">{k.replace(/_/g, ' ')}</p><p className="text-2xl font-bold">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p></div>
      ))}</div>}
      <h2 className="font-semibold">Pending business verification</h2>
      {pending.length === 0 ? <Empty text="Nothing pending." /> : pending.map((c) => (
        <div key={c.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div><p className="font-semibold">{c.name} <Badge tone="amber">pending</Badge></p><p className="text-sm text-muted">{c.country} · {(c.business_types ?? []).join(', ')}</p></div>
          <div className="flex gap-2"><button className={btn} onClick={() => review(c.id, 'verified')}>Approve</button><button className={btn2} onClick={() => review(c.id, 'rejected')}>Reject</button></div>
        </div>
      ))}
    </div>
  )
}
