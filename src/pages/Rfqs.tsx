import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, card, CURRENCIES, Empty, ErrorMsg, Field, input, Loading } from '../ui'

export default function Rfqs() {
  const { companies } = useAuth()
  const [rows, setRows] = useState<any[] | null>(null)
  const [cats, setCats] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ title: '', description: '', category: '', qty: '', unit: 'tonne', price: '', currency: 'USD', dest: '', by: '', origin: '' })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  const load = () => supabase.from('rfqs').select('id,reference,title,quantity,unit,currency,target_price,destination_country,required_by,status,buyer_company:companies(name)').order('created_at', { ascending: false }).limit(100)
    .then(({ data, error }) => { if (error) setErr(error.message); setRows(data ?? []) })
  useEffect(() => { load(); supabase.from('product_categories').select('id,name').eq('is_active', true).then(({ data }) => setCats(data ?? [])) }, [])

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (!companies[0]) return setErr('Create your business profile in the dashboard first.')
    const { error } = await supabase.rpc('create_rfq', {
      p_company_id: companies[0].id, p_title: f.title, p_description: f.description, p_category_id: f.category || null,
      p_quantity: Number(f.qty), p_unit: f.unit, p_target_price: f.price ? Number(f.price) : null, p_currency: f.currency,
      p_destination_country: f.dest, p_required_by: f.by || null, p_preferred_origin: f.origin || null,
    })
    if (error) setErr(error.message); else { setShow(false); load() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Requests for quotation</h1><button className={btn} onClick={() => setShow(!show)}>{show ? 'Close' : 'Create RFQ'}</button></div>
      <ErrorMsg msg={err} />
      {show && (
        <form onSubmit={create} className={`${card} grid gap-3 md:grid-cols-2`}>
          <div className="md:col-span-2"><Field label="What do you need?"><input className={input} required minLength={3} value={f.title} onChange={set('title')} placeholder="e.g. 5,000 tonnes of long-grain rice" /></Field></div>
          <div className="md:col-span-2"><Field label="Specifications and instructions"><textarea className={input} value={f.description} onChange={set('description')} /></Field></div>
          <Field label="Category"><select className={input} value={f.category} onChange={set('category')}><option value="">Select</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Preferred origin (2-letter)"><input className={input} maxLength={2} value={f.origin} onChange={set('origin')} /></Field>
          <Field label="Quantity"><input className={input} type="number" min="0" step="any" required value={f.qty} onChange={set('qty')} /></Field>
          <Field label="Unit"><input className={input} required value={f.unit} onChange={set('unit')} /></Field>
          <Field label="Target price per unit"><input className={input} type="number" step="any" value={f.price} onChange={set('price')} /></Field>
          <Field label="Currency"><select className={input} value={f.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Delivery destination (2-letter)"><input className={input} maxLength={2} required value={f.dest} onChange={set('dest')} /></Field>
          <Field label="Required by"><input className={input} type="date" value={f.by} onChange={set('by')} /></Field>
          <button className={`${btn} md:col-span-2`}>Publish RFQ</button>
        </form>
      )}
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No RFQs yet." /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.id} to={`/rfqs/${r.id}`} className={`${card} block hover:border-emerald`}>
              <div className="flex items-center justify-between"><h3 className="font-semibold">{r.title}</h3><Badge tone={r.status === 'open' ? 'green' : 'slate'}>{r.status}</Badge></div>
              <p className="text-sm text-muted">{r.reference} · {r.quantity} {r.unit} → {r.destination_country} · {r.buyer_company?.name}{r.required_by ? ` · by ${r.required_by}` : ''}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
