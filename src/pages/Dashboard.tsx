import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ACCOUNT_TYPES, btn, Badge, card, ErrorMsg, Field, input } from '../ui'

export default function Dashboard() {
  const { session, companies, refresh } = useAuth()
  const company = companies[0]
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [err, setErr] = useState<string | null>(null)
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

  if (!company) return (
    <form onSubmit={create} className={`${card} mx-auto max-w-lg space-y-4`}>
      <h1 className="text-xl font-bold">Set up your business profile</h1>
      <ErrorMsg msg={err} />
      <Field label="Business name"><input className={input} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Country (2-letter)"><input className={input} maxLength={2} required value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
      <Field label="Company description"><textarea className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Website"><input className={input} type="url" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
      <fieldset><legend className="mb-1 text-sm font-medium">Business capabilities</legend>
        <div className="flex flex-wrap gap-2">{ACCOUNT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.types.includes(t)} onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, t] : f.types.filter((x) => x !== t) })} />{t}</label>
        ))}</div>
      </fieldset>
      <button className={btn}>Create business profile</button>
    </form>
  )

  const tone = company.verification_status === 'verified' ? 'green' : company.verification_status === 'rejected' || company.verification_status === 'suspended' ? 'red' : 'amber'
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div><h1 className="text-xl font-bold">{company.name}</h1><p className="text-sm text-muted">{company.country} · {(company.business_types ?? []).join(', ')}</p></div>
        <div className="flex items-center gap-3"><Badge tone={tone}>{company.verification_status}</Badge>
          {company.verification_status === 'unverified' && <button className={btn} onClick={submitVerification}>Submit for verification</button>}</div>
      </div>
      <ErrorMsg msg={err} />
      {stats && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(stats).map(([k, v]) => (
        <div key={k} className={card}><p className="text-xs uppercase text-muted">{k.replace(/_/g, ' ')}</p><p className="text-2xl font-bold">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p></div>
      ))}</div>}
    </div>
  )
}
