import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Plus, Receipt } from 'lucide-react'
import { DEMO_TX, DEMO_WALLET } from '../lib/demo'
import { MIN_WITHDRAWAL, PLATFORM_FEE_PCT, ngn } from '../lib/fees'
import { useRole } from '../lib/roles'
import { ConfirmDialog, DemoBanner, EscrowNote, PageHeader, SectionTitle, useToast } from '../components/kit'
import { Badge, btn, btnAccent, card, input } from '../ui'

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
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Wallet" back={false} />
      <DemoBanner />
      <div className="rounded-3xl bg-gradient-to-br from-forest to-emerald p-5 text-white shadow-lg">
        <p className="text-sm text-white/80">Available balance</p>
        <p className="text-3xl font-extrabold">{ngn(w.available)}</p>
        <div className="mt-4 flex gap-2">
          <Link to="/wallet/withdraw" className={`${btnAccent} flex-1`}><ArrowUpFromLine size={16} />Withdraw</Link>
          {role === 'buyer' && <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold" onClick={() => setDep(!dep)}><Plus size={16} />Add money</button>}
        </div>
      </div>

      {dep && (
        <div className={`${card} space-y-3`}>
          <p className="text-sm font-bold">Add money</p>
          <input className={input} inputMode="numeric" placeholder="Amount (₦)" aria-label="Deposit amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <button className={`${btn} w-full`} onClick={() => { if (!Number(amount)) return toast('Enter an amount.', 'err'); toast('Deposits need a connected payment provider. Nothing was charged.', 'warn') }}>Continue to deposit</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={card}><p className="text-xs text-muted">{w.pendingLabel}</p><p className="text-lg font-extrabold text-accent">{ngn(w.pending)}</p></div>
        <div className={card}><p className="text-xs text-muted">{role === 'buyer' ? 'Total deposits' : 'Total earnings'}</p><p className="text-lg font-extrabold">{ngn(w.total)}</p></div>
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

      <SectionTitle title="Transactions" />
      <div className="space-y-2">
        {tx.map((t) => (
          <div key={t.id} className={card}>
            <button className="flex w-full items-center gap-3 text-left" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span className={`grid h-9 w-9 place-items-center rounded-full ${t.amount > 0 ? 'bg-emerald/10 text-emerald' : 'bg-orange-100 text-accent'}`}>{t.amount > 0 ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</span>
              <span className="flex-1"><span className="block text-sm font-semibold">{t.title}</span><span className="text-xs text-muted">{t.date}</span></span>
              <span className={`text-sm font-bold ${t.amount > 0 ? 'text-emerald' : 'text-ink'}`}>{t.amount > 0 ? '+' : '−'}{ngn(Math.abs(t.amount))}</span>
            </button>
            {open === t.id && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-muted">
                <p className="flex items-center gap-1 font-semibold text-ink"><Receipt size={14} />Receipt RCPT-{t.id.toUpperCase()}-PREVIEW</p>
                <p>Date: {t.date}</p>
                <p>Type: {t.kind === 'hold' ? 'Escrow hold (not withdrawable)' : t.kind === 'out' ? 'Withdrawal' : 'Credit'}</p>
                {t.title.includes('Order') && <p>Split on release uses the Saage platform fee of {PLATFORM_FEE_PCT}% plus the agent commission.</p>}
              </div>
            )}
          </div>
        ))}
      </div>

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
  const [amount, setAmount] = useState('')
  const [dlg, setDlg] = useState(false)
  const n = Number(amount)
  const err = !amount ? null : n < MIN_WITHDRAWAL ? `Minimum withdrawal is ${ngn(MIN_WITHDRAWAL)}.` : n > w.available ? 'Amount exceeds your available balance. Escrow funds cannot be withdrawn.' : null

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title="Withdraw Funds" />
      <DemoBanner text="Preview only. No withdrawal request is sent until the payout backend is connected." />
      <div className={`${card} text-center`}><p className="text-xs text-muted">Available balance</p><p className="text-3xl font-extrabold">{ngn(w.available)}</p></div>
      <label className="block text-sm font-semibold">Enter amount (₦)
        <input className={`${input} mt-1`} inputMode="numeric" placeholder="100,000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
      </label>
      <div className="flex gap-2">{[25, 50, 100].map((p) => <button key={p} className="flex-1 rounded-full bg-white py-1.5 text-xs font-semibold ring-1 ring-slate-200" onClick={() => setAmount(String(Math.floor((w.available * p) / 100)))}>{p === 100 ? 'Max' : `${p}%`}</button>)}</div>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
      <p className="text-xs text-muted">Funds go to your linked bank account. Add one on the Wallet page.</p>
      <button className={`${btn} w-full py-3`} disabled={!n || !!err} onClick={() => setDlg(true)}>Withdraw Request</button>
      <ConfirmDialog open={dlg} title="Submit withdrawal request?" confirmLabel="Submit" body={`You are requesting ${ngn(n)}. Admin review and the bank transfer happen on the backend.`}
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Request not sent: payout backend not connected (preview).', 'warn'); nav('/wallet') }} />
    </div>
  )
}
