import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRole } from '../lib/roles'
import RoleDash from './RoleDash'
import { ACCOUNT_TYPES, btn, btn2, Badge, card, ErrorMsg, Field, input } from '../ui'

export default function Dashboard() {
  const { session, companies, refresh } = useAuth()
  const role = useRole()
  const company = companies[0]
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [skip, setSkip] = useState(false)
  const [f, setF] = useState({ name: '', country: '', description: '', website: '', types: [] as string[] })

  useEffect(() => {
    if (!company) return
    supabase.rpc('business_dashboard_stats', { p_company_id: company.id }).then(({ data }) => setStats(data && typeof data === 'object' ? data : null))
  }, [company?.id])

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (f.types.length === 0) return setErr('Select at least one business type.')
    const { error } = await supabase.from('companies').insert({ owner_id: session!.user.id, name: f.name, country: f.country.toUpperCase(), description: f.description, website: f.website || null, business_types: f.types })
    if (error) setErr(error.message); else refresh()
  }
  async function submitVerification() {
    setErr(null)
    const { error } = await supabase.rpc('submit_company_for_verification', { p_company_id: company.id })
    if (error) setErr(error.message); else refresh()
  }

  if (!company && !skip) return (
    <form onSubmit={create} className={`${card} mx-auto max-w-lg space-y-4`}>
      <h1 className="text-xl font-bold">Set up your business profile</h1>
      <p className="text-sm text-muted">Business verification builds trust with buyers, sellers and agents.</p>
      <ErrorMsg msg={err} />
      <Field label="Business name"><input className={input} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Country (2-letter)"><input className={input} maxLength={2} required value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
      <Field label="Company description"><textarea className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Website"><input className={input} type="url" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
      <fieldset><legend className="mb-1 text-sm font-medium">Business capabilities</legend>
        <div className="flex flex-wrap gap-3">{ACCOUNT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-emerald" checked={f.types.includes(t)} onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, t] : f.types.filter((x) => x !== t) })} />{t}</label>
        ))}</div>
      </fieldset>
      <div className="flex gap-2"><button className={btn}>Create business profile</button><button type="button" className={btn2} onClick={() => setSkip(true)}>Preview dashboard first</button></div>
    </form>
  )

  const tone = company?.verification_status === 'verified' ? 'green' : company?.verification_status === 'rejected' || company?.verification_status === 'suspended' ? 'red' : 'amber'
  const name = company?.name ?? session?.user?.user_metadata?.full_name ?? 'Your account'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-forest to-emerald p-4 text-white shadow">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-lg font-bold">{String(name).charAt(0).toUpperCase()}</span>
          <div><p className="text-xs uppercase tracking-wide text-white/70">{role} dashboard</p><h1 className="text-lg font-bold leading-tight">{name}</h1></div>
        </div>
        {company ? (
          <div className="flex items-center gap-2"><Badge tone={tone}>{company.verification_status}</Badge>
            {company.verification_status === 'unverified' && <button className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold" onClick={submitVerification}>Verify business</button>}</div>
        ) : <Link to="/dashboard" onClick={() => setSkip(false)} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold">Set up business</Link>}
      </div>
      <ErrorMsg msg={err} />
      {stats && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(stats).map(([k, v]) => (
        <div key={k} className={card}><p className="text-xs uppercase text-muted">{k.replace(/_/g, ' ')}</p><p className="text-2xl font-bold">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p></div>
      ))}</div>}
      <RoleDash role={role} />
    </div>
  )
}
