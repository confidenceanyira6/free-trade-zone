import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, btn2, Badge, card, CURRENCIES, Empty, ErrorMsg, Field, input, Loading, money } from '../ui'

export default function RfqDetail() {
  const { id } = useParams()
  const { companies } = useAuth()
  const [rfq, setRfq] = useState<any>(null)
  const [resp, setResp] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ price: '', currency: 'USD', qty: '', incoterm: 'FOB', days: '', terms: '' })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const mine = companies[0]

  async function load() {
    const r = await supabase.from('rfqs').select('*,buyer_company:companies(id,name,country)').eq('id', id).maybeSingle()
    setRfq(r.data ?? false)
    const s = await supabase.from('rfq_responses').select('*,seller:companies(name,country,verification_status)').eq('rfq_id', id).order('created_at')
    setResp(s.data ?? [])
  }
  useEffect(() => { load() }, [id])

  if (rfq === null) return <Loading />
  if (rfq === false) return <p className={card}>RFQ not found.</p>
  const isBuyer = mine && rfq.buyer_company.id === mine.id

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    const { error } = await supabase.rpc('submit_rfq_response', { p_rfq_id: rfq.id, p_company_id: mine.id, p_unit_price: Number(f.price), p_currency: f.currency, p_available_quantity: Number(f.qty), p_incoterm: f.incoterm, p_lead_time_days: f.days ? Number(f.days) : null, p_terms: f.terms })
    if (error) setErr(error.message); else load()
  }
  async function review(rid: string, action: string) {
    setErr(null)
    const { error } = await supabase.rpc('review_rfq_response', { p_response_id: rid, p_action: action })
    if (error) setErr(error.message); else load()
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between"><h1 className="text-xl font-bold">{rfq.title}</h1><Badge tone={rfq.status === 'open' ? 'green' : 'slate'}>{rfq.status}</Badge></div>
        <p className="text-sm text-muted">{rfq.reference} · {rfq.buyer_company.name} ({rfq.buyer_company.country})</p>
        <p className="mt-2 text-sm">{rfq.description}</p>
        <p className="mt-2 text-sm">Quantity: <b>{rfq.quantity} {rfq.unit}</b> · Destination: <b>{rfq.destination_country}</b> · Target: <b>{money(rfq.target_price, rfq.currency)}</b>{rfq.required_by && <> · Needed by <b>{rfq.required_by}</b></>}</p>
      </div>
      <ErrorMsg msg={err} />
      {!isBuyer && rfq.status === 'open' && mine && (
        <form onSubmit={submit} className={`${card} grid gap-3 md:grid-cols-3`}>
          <h2 className="font-semibold md:col-span-3">Submit your quotation</h2>
          <Field label="Unit price"><input className={input} type="number" step="any" required value={f.price} onChange={set('price')} /></Field>
          <Field label="Currency"><select className={input} value={f.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Available quantity"><input className={input} type="number" step="any" required value={f.qty} onChange={set('qty')} /></Field>
          <Field label="Incoterm"><input className={input} value={f.incoterm} onChange={set('incoterm')} /></Field>
          <Field label="Lead time (days)"><input className={input} type="number" value={f.days} onChange={set('days')} /></Field>
          <Field label="Delivery and payment terms"><input className={input} value={f.terms} onChange={set('terms')} /></Field>
          <button className={`${btn} md:col-span-3`}>Submit quotation</button>
        </form>
      )}
      <h2 className="font-semibold">{isBuyer ? 'Quotations received' : 'Your quotation'}</h2>
      {resp.length === 0 ? <Empty text="No quotations yet." /> : resp.map((r) => (
        <div key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="font-semibold">{r.seller.name} ({r.seller.country}) {r.seller.verification_status === 'verified' && <Badge tone="green">Verified</Badge>}</p>
            <p className="text-sm text-muted">{money(r.unit_price, r.currency)} / {rfq.unit} · {r.available_quantity} available · {r.incoterm} · {r.lead_time_days ?? '-'} days</p>
            {r.terms && <p className="text-sm">{r.terms}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={r.status === 'accepted' ? 'green' : r.status === 'rejected' ? 'red' : 'slate'}>{r.status}</Badge>
            {isBuyer && rfq.status === 'open' && (<>
              <button className={btn2} onClick={() => review(r.id, 'shortlist')}>Shortlist</button>
              <button className={btn} onClick={() => review(r.id, 'accept')}>Accept</button>
              <button className={btn2} onClick={() => review(r.id, 'reject')}>Reject</button>
            </>)}
          </div>
        </div>
      ))}
    </div>
  )
}
