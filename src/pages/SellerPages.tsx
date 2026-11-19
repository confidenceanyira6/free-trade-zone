import { useState } from 'react'
import { CATEGORIES, DEMO_PRODUCTS, UNITS } from '../lib/demo'
import { ngn } from '../lib/fees'
import { Art } from '../components/Art'
import { ConfirmDialog, PageHeader, UnderlineTabs, useToast } from '../components/kit'
import { Badge, btn, btn2, btnS2, btnSAccent, card, Empty, input } from '../ui'

type P = { id: string; name: string; kind: string; category: string; unit: string; price: number; minQty: number; maxQty: number; stock: number; active: boolean }
const blank: P = { id: '', name: '', kind: 'default', category: CATEGORIES[0], unit: UNITS[1], price: 0, minQty: 0, maxQty: 0, stock: 0, active: true }

export function SellerProducts() {
  const toast = useToast()
  const [items, setItems] = useState<P[]>(DEMO_PRODUCTS.slice(0, 4).map((p) => ({ id: p.id, name: p.name.replace('Premium ', ''), kind: p.kind, category: CATEGORIES[0], unit: p.unit, price: p.price, minQty: p.minQty, maxQty: p.stock, stock: p.stock, active: p.active })))
  const [form, setForm] = useState<P | null>(null)
  const [files, setFiles] = useState<{ imgs: string[]; docs: string[] }>({ imgs: [], docs: [] })

  function save() {
    if (!form) return
    if (!form.name.trim()) return toast('Product name is required.', 'err')
    if (form.price <= 0) return toast('Enter a bulk price greater than zero.', 'err')
    if (form.minQty <= 0 || form.maxQty < form.minQty) return toast('Maximum order quantity must be at least the minimum.', 'err')
    if (form.stock < form.minQty) return toast('Available stock must cover the minimum order.', 'err')
    setItems(form.id ? items.map((i) => (i.id === form.id ? form : i)) : [{ ...form, id: `n${Date.now()}` }, ...items])
    toast('Saved to this preview list. It is not published to buyers yet.')
    setForm(null); setFiles({ imgs: [], docs: [] })
  }
  const num = (k: keyof P) => (e: any) => setForm({ ...form!, [k]: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 })

  return (
    <div>
      <PageHeader title="My Products" right={<button className={btnSAccent} onClick={() => setForm({ ...blank })}>Add Product</button>} />

      {form && (
        <div className={`${card} mb-4 space-y-3`}>
          <p className="font-bold">{form.id ? 'Edit product' : 'Add new bulk product'}</p>
          <input className={input} placeholder="Product name (e.g. Cocoa beans)" aria-label="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} aria-label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className={input} aria-label="Measurement unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{[...UNITS, form.unit].filter((u, i, a) => a.indexOf(u) === i).map((u) => <option key={u}>{u}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium">Bulk price per unit (₦)<input className={`${input} mt-1`} inputMode="decimal" value={form.price || ''} onChange={num('price')} /></label>
            <label className="text-xs font-medium">Available stock<input className={`${input} mt-1`} inputMode="numeric" value={form.stock || ''} onChange={num('stock')} /></label>
            <label className="text-xs font-medium">Minimum order qty<input className={`${input} mt-1`} inputMode="numeric" value={form.minQty || ''} onChange={num('minQty')} /></label>
            <label className="text-xs font-medium">Maximum order qty<input className={`${input} mt-1`} inputMode="numeric" value={form.maxQty || ''} onChange={num('maxQty')} /></label>
          </div>
          <label className="block text-xs font-medium">Product images<input type="file" accept="image/*" multiple className="mt-1 block w-full text-xs" onChange={(e) => setFiles({ ...files, imgs: Array.from(e.target.files ?? []).map((f) => f.name) })} /></label>
          <label className="block text-xs font-medium">Product documentation (PDF)<input type="file" accept=".pdf,.doc,.docx" multiple className="mt-1 block w-full text-xs" onChange={(e) => setFiles({ ...files, docs: Array.from(e.target.files ?? []).map((f) => f.name) })} /></label>
          {(files.imgs.length > 0 || files.docs.length > 0) && <p className="text-xs text-muted">{files.imgs.length} image(s), {files.docs.length} document(s) selected</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Available for orders</label>
          <div className="flex gap-2"><button className={`${btn} flex-1`} onClick={save}>Save product</button><button className={`${btn2} flex-1`} onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}

      {items.length === 0 ? <Empty text="No products yet. Add your first bulk listing." /> : (
        <ul className="divide-y divide-slate-100">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Art kind={p.kind} className="h-16 w-16 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-sm font-extrabold">{ngn(p.price)} <span className="text-xs font-semibold">/ {p.unit}</span></p>
                <button aria-label={`Toggle availability of ${p.name}`} onClick={() => setItems(items.map((i) => (i.id === p.id ? { ...i, active: !i.active } : i)))} className={`text-xs font-bold ${p.active ? 'text-emerald' : 'text-muted'}`}>{p.active ? 'Active' : 'Inactive'}</button>
              </div>
              <button className={btnS2} onClick={() => setForm(p)}>Edit</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type O = { id: string; product: string; kind: string; total: number; buyer: string; agent: string | null; status: 'pending' | 'in_progress' | 'delivered' | 'completed' | 'rejected' }
const ORDERS: O[] = [
  { id: '#SZF8723', product: 'Timber (Teak)', kind: 'timber', total: 125000000, buyer: 'Buyer John', agent: 'Chinedu Agent', status: 'pending' },
  { id: '#SZF8720', product: 'Red Oil', kind: 'oil', total: 98000000, buyer: 'Okafor Foods', agent: null, status: 'pending' },
  { id: '#SZF8712', product: 'Natural Rubber', kind: 'rubber', total: 60000000, buyer: 'TyreWorks Ltd', agent: 'Amaka Okoro', status: 'in_progress' },
  { id: '#SZF8690', product: 'Charcoal', kind: 'charcoal', total: 35000000, buyer: 'GrillCo', agent: 'Tunde Bello', status: 'delivered' },
]

export function SellerOrders() {
  const toast = useToast()
  const [tab, setTab] = useState('Pending')
  const [orders, setOrders] = useState(ORDERS)
  const [open, setOpen] = useState<string | null>(null)
  const [offer, setOffer] = useState('')
  const [dlg, setDlg] = useState<{ id: string; kind: 'accept' | 'reject' | 'complete' } | null>(null)
  const count = (s: O['status'][]) => orders.filter((o) => s.includes(o.status)).length
  const key = tab.startsWith('Pending') ? 'Pending' : tab.startsWith('In Progress') ? 'In Progress' : 'Delivered'
  const list = orders.filter((o) => (key === 'Pending' ? o.status === 'pending' : key === 'In Progress' ? o.status === 'in_progress' : o.status === 'delivered' || o.status === 'completed'))
  const labels = [`Pending (${count(['pending'])})`, `In Progress (${count(['in_progress'])})`, 'Delivered']

  const apply = () => {
    if (!dlg) return
    const next = dlg.kind === 'accept' ? 'in_progress' : dlg.kind === 'reject' ? 'rejected' : 'completed'
    setOrders(orders.map((o) => (o.id === dlg.id ? { ...o, status: next as O['status'] } : o)))
    toast(dlg.kind === 'complete' ? 'Completion confirmed (preview). Escrow release still needs the buyer and backend checks.' : `Order ${dlg.kind === 'accept' ? 'accepted' : 'rejected'} (preview).`)
    setDlg(null)
  }

  return (
    <div>
      <PageHeader title="Manage Orders" back={false} />
      <UnderlineTabs tabs={labels} value={labels.find((l) => l.startsWith(key)) ?? labels[0]} onChange={setTab} />
      {list.length === 0 ? <Empty text="No orders in this tab." /> : (
        <ul className="divide-y divide-slate-100">
          {list.map((o) => (
            <li key={o.id} className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1"><p className="text-sm font-bold">{o.id}</p><p className="text-xs text-muted">{o.product}</p><p className="text-sm font-extrabold">{ngn(o.total)}</p></div>
                <button className={btnSAccent} aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Hide' : 'View'}</button>
              </div>
              {open === o.id && (
                <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <p><span className="text-muted">Buyer:</span> {o.buyer}</p>
                  <p><span className="text-muted">Inspection agent:</span> {o.agent ?? 'Not assigned yet'}</p>
                  <Badge tone="green">Payment held in escrow</Badge>
                  {o.status === 'pending' && (
                    <>
                      <div className="flex gap-2"><input className={input} inputMode="numeric" placeholder="Counter-offer total (₦)" aria-label="Counter offer" value={offer} onChange={(e) => setOffer(e.target.value.replace(/\D/g, ''))} />
                        <button className={btnS2} onClick={() => { if (!Number(offer)) return toast('Enter a price to negotiate.', 'err'); toast(`Counter-offer of ${ngn(Number(offer))} drafted (preview).`, 'warn'); setOffer('') }}>Negotiate</button></div>
                      <div className="grid grid-cols-3 gap-2">
                        <button className={btn} onClick={() => setDlg({ id: o.id, kind: 'accept' })}>Accept</button>
                        <button className={btn2} onClick={() => setDlg({ id: o.id, kind: 'reject' })}>Reject</button>
                        <button className={btn2} onClick={() => toast('Quotation drafted (preview).', 'warn')}>Quote</button>
                      </div>
                    </>
                  )}
                  {o.status === 'in_progress' && <p className="rounded-lg bg-emerald/10 p-2 text-xs text-forest">Agent inspection and delivery in progress.</p>}
                  {o.status === 'delivered' && <button className={`${btn} w-full`} onClick={() => setDlg({ id: o.id, kind: 'complete' })}>Confirm transaction completion</button>}
                  {o.status === 'completed' && <Badge tone="green">You confirmed completion</Badge>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!dlg} danger={dlg?.kind === 'reject'} title={dlg?.kind === 'accept' ? 'Accept this order?' : dlg?.kind === 'reject' ? 'Reject this order?' : 'Confirm completion?'}
        body={dlg?.kind === 'complete' ? 'Confirm that delivery and the transaction are complete. Funds are released only after buyer confirmation and backend checks.' : dlg?.kind === 'accept' ? 'You commit to supplying the goods at the agreed price for agent inspection.' : 'The buyer will be notified that you declined this order.'}
        confirmLabel={dlg?.kind === 'accept' ? 'Accept' : dlg?.kind === 'reject' ? 'Reject' : 'Confirm'} onCancel={() => setDlg(null)} onConfirm={apply} />
    </div>
  )
}
