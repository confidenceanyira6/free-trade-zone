import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { DEMO_PRODUCTS, KIND_CHIPS } from '../lib/demo'
import { ngn } from '../lib/fees'
import { Art } from '../components/Art'
import { PageHeader } from '../components/kit'
import { btnS, Empty } from '../ui'

export default function Marketplace() {
  const [sp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [kind, setKind] = useState('')
  const rows = DEMO_PRODUCTS.filter((p) => (!kind || p.kind === kind) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))

  return (
    <div>
      <PageHeader title="Products" />
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input aria-label="Search raw materials" className="w-full rounded-full bg-slate-100 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/30" placeholder="Search raw materials..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Categories">
        {KIND_CHIPS.map(([label, k]) => (
          <button key={label} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold ${kind === k ? 'bg-emerald text-white' : 'bg-slate-100 text-ink'}`}>{label}</button>
        ))}
      </div>

      {rows.length === 0 ? <Empty text="No products match your search." /> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((p) => (
            <li key={p.id} className="flex gap-3 py-3">
              <Link to={`/products/${p.id}`} aria-label={p.name}><Art kind={p.kind} className="h-[72px] w-[72px] rounded-lg" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/products/${p.id}`} className="text-sm font-bold leading-tight">{p.name}</Link>
                <p className="text-xs text-muted">Bulk: {p.bulk}</p>
                <p className="text-sm font-extrabold">{ngn(p.price)} <span className="text-xs font-semibold">/ {p.unit}</span></p>
                <Link to={`/order/new?p=${p.id}`} className={`${btnS} mt-1 self-end`}>Request Quote</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
