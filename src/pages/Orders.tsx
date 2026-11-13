import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, btn2, Badge, card, Empty, ErrorMsg, Loading, money } from '../ui'

export default function Orders() {
  const { companies } = useAuth()
  const ids = companies.map((c) => c.id)
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => supabase.from('orders').select('*,items:order_items(product_name,quantity,unit_price),buyer:companies!orders_buyer_company_id_fkey(name),seller:companies!orders_seller_company_id_fkey(name)').order('created_at', { ascending: false })
    .then(({ data, error }) => { if (error) setErr(error.message); setRows(data ?? []) })
  useEffect(() => { load() }, [])

  async function act(fn: string, args: any) {
    setErr(null)
    const { error } = await supabase.rpc(fn, args)
    if (error) setErr(error.message); else load()
  }

  if (rows === null) return <Loading />
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <ErrorMsg msg={err} />
      {rows.length === 0 ? <Empty text="No orders yet." /> : rows.map((o) => {
        const isBuyer = ids.includes(o.buyer_company_id)
        const isSeller = ids.includes(o.seller_company_id)
        return (
          <div key={o.id} className={`${card} space-y-2`}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{o.reference}</h3><Badge tone={o.status === 'completed' || o.status === 'delivered' ? 'green' : o.status === 'cancelled' || o.status === 'disputed' ? 'red' : 'amber'}>{o.status.replace(/_/g, ' ')}</Badge></div>
            <p className="text-sm text-muted">{o.buyer?.name} → {o.seller?.name} · {o.destination_country}</p>
            {o.items?.map((i: any, k: number) => <p key={k} className="text-sm">{i.product_name} × {i.quantity} @ {money(i.unit_price, o.currency)}</p>)}
            <p className="font-bold">Total {money(o.total, o.currency)}</p>
            <div className="flex flex-wrap gap-2">
              {isSeller && o.status === 'pending_confirmation' && <button className={btn} onClick={() => act('confirm_order', { p_order_id: o.id })}>Confirm order</button>}
              {isSeller && o.status === 'confirmed' && <button className={btn2} onClick={() => act('mark_order_preparing', { p_order_id: o.id })}>Start preparing</button>}
              {isBuyer && o.status === 'shipped' && <button className={btn} onClick={() => act('confirm_delivery', { p_order_id: o.id })}>Confirm delivery</button>}
              {['pending_confirmation', 'confirmed'].includes(o.status) && <button className={btn2} onClick={() => { const r = prompt('Reason for cancelling?'); if (r) act('cancel_order', { p_order_id: o.id, p_reason: r }) }}>Cancel</button>}
              {['confirmed', 'preparing', 'shipped', 'delivered'].includes(o.status) && <button className={btn2} onClick={() => { const r = prompt('Describe the problem'); if (r) act('open_dispute', { p_order_id: o.id, p_reason: 'other', p_details: r }) }}>Open dispute</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
