import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, ClipboardList, HelpCircle, LifeBuoy, LogOut, MessageSquare, Settings as Cog, ShieldAlert, Wallet, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Role, setPreviewRole, useRole } from '../lib/roles'
import { DEMO_NOTES } from '../lib/demo'
import { CURRENCIES, btn, btn2, card, Empty, ErrorMsg, input } from '../ui'
import { ConfirmDialog, DemoBanner, PageHeader, useToast } from '../components/kit'

const Row = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <Link to={to} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-sm font-medium last:border-0"><Icon size={18} className="text-emerald" /><span className="flex-1">{label}</span><ChevronRight size={16} className="text-slate-400" /></Link>
)

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const [read, setRead] = useState<string[]>([])
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Notifications" right={<button className="text-xs font-semibold text-emerald" onClick={() => setRead(DEMO_NOTES.map((n) => n.id))}>Mark all read</button>} />
      <DemoBanner text="Sample notifications. Live alerts will arrive from the backend." />
      <div className={`${card} p-0`}>
        {DEMO_NOTES.map((n) => (
          <Link key={n.id} to={n.to} onClick={() => setRead([...read, n.id])} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-accent"><Bell size={16} /></span>
            <span className={`flex-1 text-sm ${read.includes(n.id) ? 'text-muted' : 'font-semibold'}`}>{n.text}</span><span className="text-xs text-muted">{n.time}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [prefs, setPrefs] = useState({ orders: true, messages: true, payments: true, marketing: false })
  const [lang, setLang] = useState('English')
  const [cur, setCur] = useState('NGN')

  async function changePw() {
    setErr(null)
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setErr(error.message); else { setPw(''); toast('Password updated.') }
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings" />
      <div className={`${card} p-0`}><Row to="/profile" icon={Building2} label="Profile information" /><Row to="/wallet" icon={Wallet} label="Payment methods & bank account" /><Row to="/support" icon={HelpCircle} label="Help & Support" /></div>

      <div className={`${card} space-y-3`}>
        <p className="font-bold">Security & Privacy</p>
        <ErrorMsg msg={err} />
        <input className={input} type="password" autoComplete="new-password" placeholder="New password (min 8 characters)" aria-label="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className={btn} onClick={changePw}>Change password</button>
      </div>

      <div className={`${card} space-y-2`}>
        <p className="font-bold">Notifications</p>
        {([['orders', 'Order & delivery updates'], ['messages', 'New messages'], ['payments', 'Payments & wallet'], ['marketing', 'Product news']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between text-sm">{l}<input type="checkbox" role="switch" className="h-5 w-5 accent-emerald" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} /></label>
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <p className="font-bold">Language & Region</p>
        <div className="grid grid-cols-2 gap-2">
          <select className={input} aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}>{['English', 'Français', 'Português'].map((l) => <option key={l}>{l}</option>)}</select>
          <select className={input} aria-label="Currency" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <button className={btn2} onClick={() => toast(`Preferences noted: ${lang}, ${cur} (preview, not yet applied app-wide).`, 'warn')}>Save preferences</button>
      </div>
      <p className="text-center text-xs text-muted">Saage Free Trade Zone · About & version 0.2.0</p>
    </div>
  )
}

/* ---------------- Support ---------------- */
const FAQ: [string, string][] = [
  ['How does escrow work?', 'The buyer\'s payment is held by the platform while an agent inspects and delivers the goods. It is released to the seller, agent and Saage only after delivery and both confirmations.'],
  ['Who chooses the inspection agent?', 'The buyer selects a verified agent, compares fees and ratings, and sends a request.'],
  ['Can I withdraw money that is in escrow?', 'No. Only your available balance can be withdrawn. Escrow funds are shown separately as pending.'],
  ['What if the goods are not as described?', 'Reject the goods after the inspection report or raise a dispute. Saage reviews the evidence from the agent and both parties.'],
]

export function Support() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Help & Support" />
      <div className={`${card} p-0`}>
        {FAQ.map(([q, a], i) => (
          <div key={q} className="border-b border-slate-100 last:border-0">
            <button className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>{q}<ChevronRight size={16} className={`transition ${open === i ? 'rotate-90' : ''}`} /></button>
            {open === i && <p className="px-4 pb-4 text-sm text-muted">{a}</p>}
          </div>
        ))}
      </div>
      <div className={`${card} p-0`}><Row to="/messages" icon={MessageSquare} label="Live chat / messages" /><Row to="/disputes" icon={ShieldAlert} label="Report a problem or open a dispute" /></div>
    </div>
  )
}

/* ---------------- Disputes ---------------- */
const REASONS = ['Goods are different from the listing', 'Quantity is incorrect', 'Quality is unacceptable', 'Goods are damaged', 'Seller refuses to cooperate', 'Agent failed to deliver']

export function Disputes() {
  const toast = useToast()
  const nav = useNavigate()
  const [reason, setReason] = useState(REASONS[0])
  const [order, setOrder] = useState('#SZF8723')
  const [details, setDetails] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [dlg, setDlg] = useState(false)
  const [tried, setTried] = useState(false)
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Disputes & Complaints" />
      <DemoBanner text="Preview form. Disputes are not yet sent to the Saage review team." />
      <div className={`${card} space-y-3`}>
        <select className={input} aria-label="Order" value={order} onChange={(e) => setOrder(e.target.value)}>{['#SZF8723', '#SZF8720', '#SZF8712'].map((o) => <option key={o}>{o}</option>)}</select>
        <select className={input} aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        <textarea className={input} rows={4} placeholder="Describe what happened…" aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} />
        {tried && details.trim().length < 10 && <p role="alert" className="text-xs text-red-600">Please give at least 10 characters of detail.</p>}
        <label className="block text-xs font-medium">Evidence (photos, documents)<input type="file" multiple className="mt-1 block w-full text-xs" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} /></label>
        {files.length > 0 && <p className="text-xs text-muted">{files.length} file(s) selected</p>}
        <button className={`${btn} w-full`} onClick={() => { setTried(true); if (details.trim().length >= 10) setDlg(true) }}>Submit dispute</button>
      </div>
      <Empty text="No disputes opened yet." />
      <ConfirmDialog open={dlg} title="Open a dispute?" confirmLabel="Open dispute" body="Escrow for this order stays on hold while the dispute is reviewed."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Dispute drafted (preview, not sent).', 'warn'); nav('/order/track') }} />
    </div>
  )
}

/* ---------------- Profile ---------------- */
export function Profile() {
  const { session, signOut } = useAuth()
  const role = useRole()
  const nav = useNavigate()
  const [dlg, setDlg] = useState(false)
  const meta = session?.user?.user_metadata ?? {}
  const name = meta.full_name || session?.user?.email || 'Saage user'
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-col items-center gap-1 pt-2 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald text-3xl font-bold text-white">{String(name).charAt(0).toUpperCase()}</span>
        <h1 className="text-lg font-bold">{name}</h1><p className="text-sm text-muted">{session?.user?.email}</p>
      </div>
      <div className={card}>
        <p className="mb-2 text-xs font-semibold text-muted">Preview the app as</p>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1" role="tablist">
          {(['buyer', 'seller', 'agent'] as Role[]).map((r) => <button key={r} role="tab" aria-selected={role === r} onClick={() => { setPreviewRole(r); nav(r === 'buyer' ? '/' : '/dashboard') }} className={`rounded-lg py-2 text-sm font-semibold capitalize ${role === r ? 'bg-emerald text-white shadow' : 'text-slate-600'}`}>{r}</button>)}
        </div>
        <p className="mt-2 text-[11px] text-muted">Switches navigation and dashboards on this device. Real permissions come from your account type on the backend.</p>
      </div>
      <div className={`${card} p-0`}>
        <Row to="/orders" icon={ClipboardList} label="My Orders" /><Row to="/wallet" icon={Wallet} label="My Wallet" /><Row to="/dashboard" icon={Building2} label="Business Profile & Verification" />
        <Row to="/messages" icon={MessageSquare} label="Messages" /><Row to="/notifications" icon={Bell} label="Notifications" /><Row to="/disputes" icon={ShieldAlert} label="Disputes" />
        <Row to="/settings" icon={Cog} label="Settings" /><Row to="/support" icon={LifeBuoy} label="Help & Support" />
      </div>
      <button className={`${btn2} w-full text-red-600`} onClick={() => setDlg(true)}><LogOut size={16} />Log Out</button>
      <ConfirmDialog open={dlg} danger title="Log out?" confirmLabel="Log out" body="You will need to sign in again to access your account." onCancel={() => setDlg(false)} onConfirm={async () => { setDlg(false); await signOut(); nav('/') }} />
    </div>
  )
}
