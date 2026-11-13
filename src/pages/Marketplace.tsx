import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { card, Empty, ErrorMsg, input, Loading, money } from '../ui'

export default function Marketplace() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [country, setCountry] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [verified, setVerified] = useState(false)
  const [cats, setCats] = useState<any[]>([])
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { supabase.from('product_categories').select('id,name').eq('is_active', true).order('sort_order').then(({ data }) => setCats(data ?? [])) }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      setRows(null)
      let query = supabase.from('products')
        .select('id,name,price,currency,unit,origin_country,min_order_quantity,is_featured,company:companies!inner(id,name,country,verification_status),images:product_images(url)')
        .eq('status', 'approved').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(60)
      if (q.trim()) query = query.textSearch('search', q.trim(), { type: 'websearch' })
      if (cat) query = query.eq('category_id', cat)
      if (country.length === 2) query = query.eq('origin_country', country.toUpperCase())
      if (maxPrice) query = query.lte('price', Number(maxPrice))
      if (verified) query = query.eq('company.verification_status', 'verified')
      const { data, error } = await query
      if (error) setErr(error.message); else { setErr(null); setRows(data ?? []) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, cat, country, maxPrice, verified])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Marketplace</h1>
      <div className={`${card} grid gap-3 md:grid-cols-5`}>
        <input className={`${input} md:col-span-2`} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className={input} placeholder="Origin (e.g. NG)" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
        <input className={input} type="number" placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified suppliers only</label>
      </div>
      <ErrorMsg msg={err} />
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No products match your filters." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className={`${card} block hover:border-emerald`}>
              {p.images?.[0]?.url && <img src={p.images[0].url} alt={p.name} className="mb-3 h-40 w-full rounded-lg object-cover" loading="lazy" />}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-emerald font-bold">{money(p.price, p.currency)} {p.price != null && <span className="text-xs font-normal text-muted">/ {p.unit}</span>}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">{p.company.name} · {p.company.country}{p.company.verification_status === 'verified' && <BadgeCheck size={14} className="text-emerald" />}</p>
              <p className="text-xs text-muted">Origin {p.origin_country} · MOQ {p.min_order_quantity ?? '-'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
