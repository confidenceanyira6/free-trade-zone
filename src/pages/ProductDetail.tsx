import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Heart, Star } from 'lucide-react'
import { DEMO_PRODUCTS } from '../lib/demo'
import { ngn } from '../lib/fees'
import { Art } from '../components/Art'
import { Avatar, PageHeader, useToast } from '../components/kit'
import { btn, btn2, card, Empty, input } from '../ui'

export default function ProductDetail() {
  const { id } = useParams()
  const toast = useToast()
  const p = DEMO_PRODUCTS.find((x) => x.id === id)
  const [saved, setSaved] = useState(false)
  const [quote, setQuote] = useState(false)
  const [qty, setQty] = useState('')
  const [msg, setMsg] = useState('')
  const [seller, setSeller] = useState(false)
  if (!p) return <Empty text="Product not found." />

  function sendQuote() {
    if (!Number(qty) || Number(qty) < p!.minQty) return toast(`Minimum order is ${p!.minQty.toLocaleString()} ${p!.unit}.`, 'err')
    toast('Quotation request drafted (preview, not sent to the seller yet).', 'warn')
    setQuote(false); setQty(''); setMsg('')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Product Details" right={<button aria-label={saved ? 'Remove from saved' : 'Save product'} aria-pressed={saved} onClick={() => { setSaved(!saved); toast(saved ? 'Removed from saved products.' : 'Saved to your products.') }} className="rounded-full p-2"><Heart size={20} className={saved ? 'fill-red-500 text-red-500' : ''} /></button>} />
      <Art kind={p.kind} className="h-52 w-full rounded-2xl" />
      <div>
        <h2 className="text-xl font-extrabold leading-tight">{p.name}</h2>
        <p className="text-lg font-extrabold text-emerald">{ngn(p.price)} <span className="text-sm font-semibold text-muted">/ {p.unit}</span></p>
        <p className="text-xs text-muted">Bulk: {p.bulk}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[['Minimum order', `${p.minQty.toLocaleString()} ${p.unit}`], ['Available stock', `${p.stock.toLocaleString()} ${p.unit}`], ['Measurement unit', p.unit], ['Origin', p.origin]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-muted">{k}</p><p className="font-bold">{v}</p></div>
        ))}
      </div>

      <button className={`${card} flex w-full items-center gap-3 text-left`} aria-expanded={seller} onClick={() => setSeller(!seller)}>
        <Avatar name={p.seller} />
        <span className="flex-1"><span className="flex items-center gap-1 text-sm font-bold">{p.seller}<BadgeCheck size={15} className="text-emerald" /></span><span className="flex items-center gap-1 text-xs text-muted"><Star size={12} className="fill-accent text-accent" />4.7 · 58 reviews</span></span>
        <span className="text-xs font-semibold text-emerald">{seller ? 'Hide' : 'Profile'}</span>
      </button>
      {seller && (
        <div className={`${card} space-y-2 text-sm`}>
          <p className="font-bold">Supplier profile</p>
          <p className="text-xs text-muted">Verified bulk supplier · Nigeria · 120+ completed trades.</p>
          {[['Chinedu O.', 'Goods matched the inspection report. Smooth delivery.'], ['Amaka E.', 'Reliable supplier, quick to respond to messages.']].map(([n, t]) => (
            <div key={n} className="rounded-xl bg-slate-50 p-2 text-xs"><p className="font-bold">{n} · ★ 5</p><p className="text-muted">{t}</p></div>
          ))}
        </div>
      )}

      {quote && (
        <div className={`${card} space-y-2`}>
          <p className="text-sm font-bold">Request quotation</p>
          <input className={input} inputMode="numeric" placeholder={`Quantity (${p.unit})`} aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
          <textarea className={input} rows={2} placeholder="Message to supplier (optional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className={`${btn} w-full`} onClick={sendQuote}>Send request</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className={btn2} onClick={() => setQuote(!quote)}>Request Quote</button>
        <Link to={`/order/new?p=${p.id}`} className={btn}>Place Bulk Order</Link>
      </div>
    </div>
  )
}
