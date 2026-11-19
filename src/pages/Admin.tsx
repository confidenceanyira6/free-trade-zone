import { useState } from 'react'
import { CATEGORIES, UNITS } from '../lib/demo'
import { MIN_WITHDRAWAL, PLATFORM_FEE_PCT, ngn } from '../lib/fees'
import { PageHeader, Stat, Tabs, useToast } from '../components/kit'
import { btnS, btnS2, card, CURRENCIES, input } from '../ui'

const STATS: [string, string][] = [['Registered users', '1,284'], ['Buyers', '640'], ['Sellers', '420'], ['Agents', '224'], ['Transactions', '3,912'], ['Transaction volume', ngn(48200000000)], ['Platform earnings', ngn(1205000000)], ['Pending escrow', ngn(2840000000)], ['Completed orders', '3,611'], ['Pending disputes', '6'], ['Pending withdrawals', '11']]

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState('Overview')
  const [pct, setPct] = useState(String(PLATFORM_FEE_PCT))
  const [minW, setMinW] = useState(String(MIN_WITHDRAWAL))
  const [cats, setCats] = useState(CATEGORIES)
  const [units, setUnits] = useState(UNITS)
  const [newCat, setNewCat] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [ver, setVer] = useState([{ id: 'v1', name: 'Lagos Timber Co.', type: 'Seller' }, { id: 'v2', name: 'Chinedu Agent', type: 'Agent' }, { id: 'v3', name: 'TyreWorks Ltd', type: 'Buyer' }])
  const [wd, setWd] = useState([{ id: 'w1', who: 'Delta Palm Ltd', amt: 1500000 }, { id: 'w2', who: 'Amaka Okoro', amt: 120000 }])
  const [dis, setDis] = useState([{ id: 'd1', order: '#SZF8720', reason: 'Quantity is incorrect' }, { id: 'd2', order: '#SZF8712', reason: 'Goods are damaged' }])

  const pctNum = Number(pct)
  function saveSettings() {
    if (!(pctNum > 0 && pctNum < 100)) return toast('Commission must be between 0 and 100%.', 'err')
    if (!(Number(minW) >= 0)) return toast('Enter a valid minimum withdrawal.', 'err')
    toast(`Saved locally: ${pctNum}% platform fee, min withdrawal ${ngn(Number(minW))} (preview).`, 'warn')
  }

  return (
    <div>
      <PageHeader title="Admin Dashboard" />
      <Tabs tabs={['Overview', 'Verification', 'Withdrawals', 'Disputes', 'Settings']} value={tab} onChange={setTab} />

      {tab === 'Overview' && <div className="grid grid-cols-2 gap-3">{STATS.map(([k, v]) => <Stat key={k} label={k} value={v} />)}</div>}

      {tab === 'Verification' && (ver.length === 0 ? <p className="text-sm text-muted">No pending verifications.</p> : (
        <ul className="space-y-2">{ver.map((v) => (
          <li key={v.id} className={`${card} flex items-center gap-2`}><div className="flex-1"><p className="text-sm font-bold">{v.name}</p><p className="text-xs text-muted">{v.type}</p></div>
            <button className={btnS} onClick={() => { setVer(ver.filter((x) => x.id !== v.id)); toast(`${v.name} approved (preview).`) }}>Approve</button>
            <button className={btnS2} onClick={() => { setVer(ver.filter((x) => x.id !== v.id)); toast(`${v.name} rejected (preview).`, 'warn') }}>Reject</button></li>
        ))}</ul>
      ))}

      {tab === 'Withdrawals' && (wd.length === 0 ? <p className="text-sm text-muted">No pending withdrawals.</p> : (
        <ul className="space-y-2">{wd.map((w) => (
          <li key={w.id} className={`${card} flex items-center gap-2`}><div className="flex-1"><p className="text-sm font-bold">{w.who}</p><p className="text-xs text-muted">{ngn(w.amt)}</p></div>
            <button className={btnS} onClick={() => { setWd(wd.filter((x) => x.id !== w.id)); toast('Withdrawal approved (preview, no payout made).') }}>Approve</button>
            <button className={btnS2} onClick={() => { setWd(wd.filter((x) => x.id !== w.id)); toast('Withdrawal declined (preview).', 'warn') }}>Decline</button></li>
        ))}</ul>
      ))}

      {tab === 'Disputes' && (dis.length === 0 ? <p className="text-sm text-muted">No open disputes.</p> : (
        <ul className="space-y-2">{dis.map((d) => (
          <li key={d.id} className={`${card} space-y-2`}><div><p className="text-sm font-bold">Order {d.order}</p><p className="text-xs text-muted">{d.reason}</p></div>
            <div className="flex gap-2"><button className={btnS} onClick={() => { setDis(dis.filter((x) => x.id !== d.id)); toast('Resolved in favour of buyer: refund queued (preview).') }}>Refund buyer</button>
              <button className={btnS2} onClick={() => { setDis(dis.filter((x) => x.id !== d.id)); toast('Resolved: payment release queued (preview).', 'warn') }}>Release to seller</button></div></li>
        ))}</ul>
      ))}

      {tab === 'Settings' && (
        <div className="space-y-4">
          <div className={`${card} space-y-2`}>
            <p className="text-sm font-bold">Commission & withdrawals</p>
            <label className="block text-xs font-medium">Platform commission (%)<input className={`${input} mt-1`} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
            <label className="block text-xs font-medium">Minimum withdrawal (₦)<input className={`${input} mt-1`} inputMode="numeric" value={minW} onChange={(e) => setMinW(e.target.value.replace(/\D/g, ''))} /></label>
            <p className="text-xs text-muted">Agent commission: set per task by the agent and shown before acceptance.</p>
            <button className={`${btnS} w-full py-2.5`} onClick={saveSettings}>Save settings</button>
          </div>
          <div className={`${card} space-y-2`}>
            <p className="text-sm font-bold">Product categories</p>
            <div className="flex flex-wrap gap-2">{cats.map((c) => <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{c}</span>)}</div>
            <div className="flex gap-2"><input className={input} placeholder="New category" aria-label="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} /><button className={btnS} onClick={() => { if (!newCat.trim()) return toast('Enter a category name.', 'err'); setCats([...cats, newCat.trim()]); setNewCat(''); toast('Category added (preview).') }}>Add</button></div>
          </div>
          <div className={`${card} space-y-2`}>
            <p className="text-sm font-bold">Measurement units</p>
            <div className="flex flex-wrap gap-2">{units.map((u) => <span key={u} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{u}</span>)}</div>
            <div className="flex gap-2"><input className={input} placeholder="New unit" aria-label="New unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} /><button className={btnS} onClick={() => { if (!newUnit.trim()) return toast('Enter a unit.', 'err'); setUnits([...units, newUnit.trim()]); setNewUnit(''); toast('Unit added (preview).') }}>Add</button></div>
          </div>
          <div className={card}><p className="mb-1 text-sm font-bold">Supported currencies</p><p className="text-xs text-muted">{CURRENCIES.join(' · ')}</p></div>
        </div>
      )}
    </div>
  )
}
