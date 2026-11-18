import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DEMO_PRODUCTS } from '../lib/demo'
import { ngn } from '../lib/fees'
import { kindOf, Thumb } from '../components/kit'
import { btnAccent, card, Empty, ErrorMsg, input, Loading, money } from '../ui'

const quote = `${btnAccent} px-3 py-1.5 text-xs`

export default function Marketplace() {
  const [sp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [cat, setCat] = useState('')
  const [country, setCountry] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [verified, setVerified] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
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

  const noFilters = !q.trim() && !cat && !country && !maxPrice && !verified
  const sample = rows?.length === 0 && noFilters
  const sampleRows = DEMO_PRODUCTS.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold md:text-2xl">Products</h1>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input aria-label="Search raw materials" className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/30" placeholder="Search raw materials…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button aria-label="Filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-slate-200"><SlidersHorizontal size={18} /></button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Categories">
        {[{ id: '', name: 'All' }, ...cats].map((c) => (
          <button key={c.id || 'all'} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c.id ? 'bg-emerald text-white' : 'bg-white ring-1 ring-slate-200'}`}>{c.name}</button>
        ))}
      </div>

      {showFilters && (
        <div className={`${card} grid gap-3 md:grid-cols-3`}>
          <input className={input} placeholder="Origin (e.g. NG)" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
          <input className={input} type="number" placeholder="Max price per unit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified suppliers only</label>
          <button className="text-left text-xs font-semibold text-emerald" onClick={() => { setCountry(''); setMaxPrice(''); setVerified(false); setCat('') }}>Clear filters</button>
        </div>
      )}

      <ErrorMsg msg={err} />
      {rows === null ? <Loading /> : sample ? (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">No approved listings yet. Showing sample bulk listings so you can try the order flow.</p>
          {sampleRows.length === 0 ? <Empty text="No sample products match your search." /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {sampleRows.map((p) => (
                <div key={p.id} className={`${card} flex items-center gap-3`}>
                  <Thumb kind={p.kind} className="h-20 w-20" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted">Bulk: {p.bulk} · {p.seller}</p>
                    <p className="font-extrabold text-emerald">{ngn(p.price)} <span className="text-xs font-normal text-muted">/ {p.unit}</span></p>
                  </div>
                  <Link to={`/order/new?p=${p.id}`} className={quote}>Request Quote</Link>
                </div>
              ))}
            </div>
          )}
        </>
      ) : rows.length === 0 ? <Empty text="No products match your filters." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className={`${card} flex items-center gap-3 hover:border-emerald`}>
              {p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" /> : <Thumb kind={kindOf(p.name)} className="h-20 w-20" />}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{p.name}</h3>
                <p className="text-xs text-muted">Bulk: MOQ {p.min_order_quantity ?? '-'} {p.unit} · Origin {p.origin_country}</p>
                <p className="font-extrabold text-emerald">{money(p.price, p.currency)} {p.price != null && <span className="text-xs font-normal text-muted">/ {p.unit}</span>}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted">{p.company.name} · {p.company.country}{p.company.verification_status === 'verified' && <BadgeCheck size={14} className="text-emerald" />}</p>
              </div>
              <span className={quote}>Request Quote</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
