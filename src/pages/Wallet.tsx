import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Plus, Receipt } from 'lucide-react'
import { DEMO_TX, DEMO_WALLET } from '../lib/demo'
import { MIN_WITHDRAWAL, PLATFORM_FEE_PCT, ngn } from '../lib/fees'
import { useRole } from '../lib/roles'
import { ConfirmDialog, EscrowNote, PageHeader, SectionTitle, useToast } from '../components/kit'
import { Badge, btn, btn2, card, input } from '../ui'

export function WalletPage() {
  const role = useRole()
  const w = DEMO_WALLET[role]
  const tx = DEMO_TX[role]
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [dep, setDep] = useState(false)
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState<{ name: string; number: string; holder: string } | null>(null)
  const [bf, setBf] = useState({ name: '', number: '', holder: '' })
  const [addBank, setAddBank] = useState(false)

  function saveBank() {
    if (!bf.name.trim() || !bf.holder.trim()) return toast('Enter the bank and account name.', 'err')
    if (!/^\d{10}$/.test(bf.number)) return toast('Account number must be 10 digits.', 'err')
    setBank(bf); setAddBank(false); toast('Bank account saved for this session (preview).')
  }

  return (
    <div className="space-y-3">
      <div className="pt-2 text-center">
        <p className="text-sm font-semibold">Balance</p>
        <p className="text-4xl font-extrabold">{ngn(w.available)}</p>
      </div>
      <Link to="/wallet/withdraw" className={`${btn} w-full`}><ArrowUpFromLine size={16} />Withdraw</Link>
      {role === 'buyer' && <button className={`${btn2} w-full`} onClick={() => setDep(!dep)}><Plus size={16} />Add money</button>}
      {dep && (
        <div className={`${card} space-y-3`}>
          <input className={input} inputMode="numeric" placeholder="Amount (₦)" aria-label="Deposit amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <button className={`${btn} w-full`} onClick={() => { if (!Number(amount)) return toast('Enter an amount.', 'err'); toast('Deposits need a connected payment provider. Nothing was charged.', 'warn') }}>Continue to deposit</button>
        </div>
      )}

      <SectionTitle title="Transactions" to="/wallet" />
      <ul className="space-y-2">
        {tx.map((t) => (
          <li key={t.id} className="rounded-xl border border-slate-200 p-3">
            <button className="flex w-full items-center gap-3 text-left" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span className={`grid h-10 w-10 place-items-center rounded-lg ${t.amount > 0 ? 'bg-emerald/10 text-emerald' : 'bg-orange-100 text-accent'}`}>{t.amount > 0 ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</span>
              <span className="flex-1"><span className="block text-sm font-bold">{t.title}</span><span className="text-xs text-muted">{t.date}</span></span>
              <span className={`text-sm font-extrabold ${t.amount > 0 ? 'text-emerald' : 'text-ink'}`}>{t.amount > 0 ? '+' : '−'}{ngn(Math.abs(t.amount))}</span>
            </button>
            {open === t.id && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-muted">
                <p className="flex items-center gap-1 font-semibold text-ink"><Receipt size={14} />Receipt RCPT-{t.id.toUpperCase()}-PREVIEW</p>
                <p>Type: {t.kind === 'hold' ? 'Escrow hold (not withdrawable)' : t.kind === 'out' ? 'Withdrawal' : 'Credit'}</p>
                {t.title.includes('Order') && <p>Split on release uses the Saage platform fee of {PLATFORM_FEE_PCT}% plus the agent commission.</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className={card}><p className="text-xs text-muted">{w.pendingLabel}</p><p className="text-base font-extrabold text-accent">{ngn(w.pending)}</p></div>
        <div className={card}><p className="text-xs text-muted">{role === 'buyer' ? 'Total deposits' : 'Total earnings'}</p><p className="text-base font-extrabold">{ngn(w.total)}</p></div>
      </div>
      <EscrowNote />

      <SectionTitle title="Bank account" />
      <div className={`${card} flex items-center gap-3`}>
        <Landmark className="text-emerald" />
        {bank ? <div className="flex-1 text-sm"><p className="font-semibold">{bank.name}</p><p className="text-xs text-muted">{bank.holder} · •••• {bank.number.slice(-4)}</p></div> : <p className="flex-1 text-sm text-muted">No bank account linked yet.</p>}
        <button className="text-xs font-semibold text-emerald" onClick={() => setAddBank(!addBank)}>{bank ? 'Change' : 'Add'}</button>
      </div>
      {addBank && (
        <div className={`${card} space-y-2`}>
          <input className={input} placeholder="Bank name" aria-label="Bank name" value={bf.name} onChange={(e) => setBf({ ...bf, name: e.target.value })} />
          <input className={input} placeholder="Account name" aria-label="Account name" value={bf.holder} onChange={(e) => setBf({ ...bf, holder: e.target.value })} />
          <input className={input} inputMode="numeric" maxLength={10} placeholder="Account number (10 digits)" aria-label="Account number" value={bf.number} onChange={(e) => setBf({ ...bf, number: e.target.value.replace(/\D/g, '') })} />
          <button className={`${btn} w-full`} onClick={saveBank}>Save bank account</button>
        </div>
      )}

      <SectionTitle title="Withdrawal history" />
      {tx.filter((t) => t.kind === 'out').length === 0 ? <p className="text-sm text-muted">No withdrawals yet.</p> : tx.filter((t) => t.kind === 'out').map((t) => (
        <div key={t.id} className={`${card} flex items-center justify-between text-sm`}><span>{t.date}</span><b>{ngn(Math.abs(t.amount))}</b><Badge tone="green">Completed</Badge></div>
      ))}
    </div>
  )
}

export function Withdraw() {
  const role = useRole()
  const w = DEMO_WALLET[role]
  const toast = useToast()
  const nav = useNavigate()
  const [amount, setAmount] = useState('100000')
  const [dlg, setDlg] = useState(false)
  const n = Number(amount)
  const err = !amount ? null : n < MIN_WITHDRAWAL ? `Minimum withdrawal is ${ngn(MIN_WITHDRAWAL)}.` : n > w.available ? 'Amount exceeds your available balance. Escrow funds cannot be withdrawn.' : null

  return (
    <div className="space-y-4">
      <PageHeader title="Withdraw Funds" />
      <div className="pt-2 text-center"><p className="text-sm font-semibold">Available Balance</p><p className="text-3xl font-extrabold">{ngn(w.available)}</p></div>
      <label className="block text-sm font-bold">Enter Amount
        <div className="relative mt-1.5"><span className="absolute left-3 top-3 text-sm font-bold">₦</span>
          <input className={`${input} pl-8`} inputMode="numeric" placeholder="100,000" value={amount ? Number(amount).toLocaleString() : ''} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /></div>
      </label>
      <div className="flex gap-2">{[25, 50, 100].map((p) => <button key={p} className="flex-1 rounded-full bg-slate-100 py-1.5 text-xs font-bold" onClick={() => setAmount(String(Math.floor((w.available * p) / 100)))}>{p === 100 ? 'Max' : `${p}%`}</button>)}</div>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
      <button className={`${btn} w-full`} disabled={!n || !!err} onClick={() => setDlg(true)}>Withdraw Request</button>
      <p className="text-center text-xs text-muted">Funds will be sent to your linked bank account.</p>
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Preview only. No withdrawal request is sent until the payout backend is connected.</p>
      <ConfirmDialog open={dlg} title="Submit withdrawal request?" confirmLabel="Submit" body={`You are requesting ${ngn(n)}. Admin review and the bank transfer happen on the backend.`}
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Request not sent: payout backend not connected (preview).', 'warn'); nav('/wallet') }} />
    </div>
  )
}
