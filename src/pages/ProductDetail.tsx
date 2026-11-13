import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, btn2, Badge, card, CURRENCIES, ErrorMsg, Field, input, Loading, money } from '../ui'

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { session, companies } = useAuth()
  const [p, setP] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [mode, setMode] = useState<'quote' | 'order' | 'msg' | null>(null)
  const [f, setF] = useState({ qty: '', price: '', currency: 'USD', dest: '', address: '', message: '' })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const buyer = companies[0]

  useEffect(() => {
    supabase.from('products').select('*,company:companies(id,name,country,verification_status,avg_rating,review_count),images:product_images(url)').eq('id', id).maybeSingle()
      .then(({ data, error }) => { if (error) setErr(error.message); setP(data ?? false) })
  }, [id])

  if (p === null) return <Loading />
  if (p === false) return <p className={card}>Product not found.</p>
  const own = buyer && p.company.id === buyer.id

  async function run(fn: () => PromiseLike<{ error: any; data?: any }>, success: string, after?: (d: any) => void) {
    setErr(null); setOk(null)
    const { error, data } = await fn()
    if (error) setErr(error.message); else { setOk(success); setMode(null); after?.(data) }
  }
  const need = () => { if (!session) { nav('/login'); return false } if (!buyer) { setErr('Create your business profile in the dashboard first.'); return false } return true }

  const save = async () => { if (!session) return nav('/login'); await run(() => supabase.from('saved_products').insert({ product_id: p.id }), 'Saved.') }
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!need()) return
    if (mode === 'quote') run(() => supabase.rpc('request_quotation', { p_product_id: p.id, p_buyer_company_id: buyer.id, p_quantity: Number(f.qty), p_target_price: f.price ? Number(f.price) : null, p_currency: f.currency, p_destination_country: f.dest.toUpperCase(), p_message: f.message }), 'Quotation requested. The supplier has been notified.')
    if (mode === 'order') run(() => supabase.rpc('create_order', { p_buyer_company_id: buyer.id, p_product_id: p.id, p_quantity: Number(f.qty), p_destination_country: f.dest.toUpperCase(), p_shipping_address: f.address }), 'Order created.', () => nav('/orders'))
    if (mode === 'msg') run(() => supabase.rpc('start_conversation', { p_company_id: p.company.id, p_message: f.message, p_product_id: p.id }), 'Message sent.', () => nav('/messages'))
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={card}>{p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.name} className="w-full rounded-lg object-cover" /> : <div className="flex h-64 items-center justify-center text-muted">No image</div>}</div>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <p className="text-2xl font-bold text-emerald">{money(p.price, p.currency)} {p.price != null && <span className="text-sm font-normal text-muted">/ {p.unit}</span>}</p>
        <p className="text-sm">{p.description}</p>
        <ul className="text-sm text-muted">
          <li>Origin: {p.origin_country}</li><li>Minimum order: {p.min_order_quantity ?? '-'} {p.unit}</li><li>Available: {p.available_quantity ?? '-'} {p.unit}</li>
          {p.estimated_delivery_days && <li>Estimated delivery: {p.estimated_delivery_days} days</li>}
        </ul>
        <p className="text-sm">Supplier: <b>{p.company.name}</b> ({p.company.country}) {p.company.verification_status === 'verified' ? <Badge tone="green">Verified</Badge> : <Badge>Unverified</Badge>}</p>
        <ErrorMsg msg={err} />
        {ok && <p className="rounded-lg bg-emerald/10 p-3 text-sm text-emerald">{ok}</p>}
        {!own && (
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => need() && setMode('quote')}>Request quotation</button>
            {p.price != null && <button className={btn2} onClick={() => need() && setMode('order')}>Order now</button>}
            <button className={btn2} onClick={() => need() && setMode('msg')}>Contact supplier</button>
            <button className={btn2} onClick={save}>Save</button>
          </div>
        )}
        {mode && (
          <form onSubmit={submit} className={`${card} space-y-3`}>
            {mode !== 'msg' && <Field label={`Quantity (${p.unit})`}><input className={input} type="number" min="0" step="any" required value={f.qty} onChange={set('qty')} /></Field>}
            {mode === 'quote' && <div className="grid grid-cols-2 gap-3"><Field label="Target price"><input className={input} type="number" step="any" value={f.price} onChange={set('price')} /></Field><Field label="Currency"><select className={input} value={f.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field></div>}
            {mode !== 'msg' && <Field label="Destination country (2-letter)"><input className={input} maxLength={2} required value={f.dest} onChange={set('dest')} /></Field>}
            {mode === 'order' && <Field label="Delivery address"><textarea className={input} required value={f.address} onChange={set('address')} /></Field>}
            {mode !== 'order' && <Field label="Message"><textarea className={input} required={mode === 'msg'} value={f.message} onChange={set('message')} /></Field>}
            <button className={btn}>Submit</button>
          </form>
        )}
      </div>
    </div>
  )
}
