import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Art } from '../components/Art'
import { PageHeader, Tabs } from '../components/kit'
import { ngn } from '../lib/fees'
import { Badge, card, Empty } from '../ui'

const ORDERS = [
  { ref: '#SZF8723', name: 'Timber (Teak)', kind: 'timber', amount: 125000000, status: 'Awaiting buyer confirmation', tone: 'orange', tab: 'Active' },
  { ref: '#SZF8720', name: 'Crude Red Oil', kind: 'oil', amount: 98000000, status: 'Agent requested', tone: 'amber', tab: 'Active' },
  { ref: '#SZF8690', name: 'Charcoal', kind: 'charcoal', amount: 35000000, status: 'Completed', tone: 'green', tab: 'Completed' },
  { ref: '#SZF8650', name: 'Natural Rubber', kind: 'rubber', amount: 60000000, status: 'Payment released', tone: 'green', tab: 'Completed' },
] as const

export default function Orders() {
  const [tab, setTab] = useState('Active')
  const list = ORDERS.filter((o) => o.tab === tab)
  return (
    <div>
      <PageHeader title="My Orders" back={false} />
      <Tabs tabs={['Active', 'Completed']} value={tab} onChange={setTab} />
      {list.length === 0 ? <Empty text="No orders here yet." /> : (
        <ul className="space-y-3">
          {list.map((o) => (
            <li key={o.ref}>
              <Link to="/order/track" className={`${card} flex items-center gap-3`}>
                <Art kind={o.kind} className="h-14 w-14 rounded-lg" />
                <div className="min-w-0 flex-1"><p className="text-sm font-bold">{o.name}</p><p className="text-xs text-muted">Order {o.ref}</p><p className="text-sm font-extrabold">{ngn(o.amount)}</p></div>
                <Badge tone={o.tone as any}>{o.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
