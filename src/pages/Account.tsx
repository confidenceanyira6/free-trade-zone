import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BadgeCheck, ChevronRight, ClipboardList, FileQuestion, HeadphonesIcon, LifeBuoy, LogOut, MessageCircle, ShieldAlert, ShieldCheck, Wallet, Building2, User, Lock, CreditCard, Globe, HelpCircle, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Role, setPreviewRole, useRole } from '../lib/roles'
import { DEMO_NOTES } from '../lib/demo'
import { CURRENCIES, btn, btn2, card, ErrorMsg, input } from '../ui'
import { Avatar, ConfirmDialog, PageHeader, useToast } from '../components/kit'

const RowLink = ({ to, icon: Icon, label, danger }: { to: string; icon: any; label: string; danger?: boolean }) => (
  <Link to={to} className={`flex items-center gap-3 border-b border-slate-100 px-1 py-3.5 text-sm font-semibold last:border-0 ${danger ? 'text-red-600' : ''}`}><Icon size={18} className={danger ? '' : 'text-emerald'} /><span className="flex-1">{label}</span><ChevronRight size={16} className="text-slate-400" /></Link>
)

/** List row that expands in place. */
function Accordion({ icon: Icon, label, open, onToggle, children }: { icon: any; label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button className="flex w-full items-center gap-3 px-1 py-3.5 text-left text-sm font-semibold" aria-expanded={open} onClick={onToggle}><Icon size={18} className="text-emerald" /><span className="flex-1">{label}</span><ChevronRight size={16} className={`text-slate-400 transition ${open ? 'rotate-90' : ''}`} /></button>
      {open && <div className="space-y-3 px-1 pb-4">{children}</div>}
    </div>
  )
}

/* ---------------- Notifications ---------------- */
export function Notifications() {
  const [read, setRead] = useState<string[]>([])
  return (
    <div>
      <PageHeader title="Notifications" right={<button className="text-xs font-semibold text-emerald" onClick={() => setRead(DEMO_NOTES.map((n) => n.id))}>Read all</button>} />
      <ul className="divide-y divide-slate-100">
        {DEMO_NOTES.map((n) => (
          <li key={n.id}>
            <Link to={n.to} onClick={() => setRead([...read, n.id])} className="flex items-center gap-3 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-accent"><Bell size={16} /></span>
              <span className={`flex-1 text-sm ${read.includes(n.id) ? 'text-muted' : 'font-semibold'}`}>{n.text}</span><span className="text-xs text-muted">{n.time}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [prefs, setPrefs] = useState({ orders: true, messages: true, payments: true })
  const [lang, setLang] = useState('English')
  const [cur, setCur] = useState('NGN')
  const tog = (k: string) => setOpen(open === k ? null : k)

  async function changePw() {
    setErr(null)
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setErr(error.message); else { setPw(''); toast('Password updated.') }
  }
  return (
    <div>
      <PageHeader title="Settings" />
      <RowLink to="/profile" icon={User} label="Profile Information" />
      <Accordion icon={Lock} label="Security & Privacy" open={open === 'sec'} onToggle={() => tog('sec')}>
        <ErrorMsg msg={err} />
        <input className={input} type="password" autoComplete="new-password" placeholder="New password (min 8 characters)" aria-label="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className={`${btn} w-full`} onClick={changePw}>Change password</button>
        {([['orders', 'Order & delivery alerts'], ['messages', 'New messages'], ['payments', 'Payments & wallet']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between text-sm">{l}<input type="checkbox" role="switch" className="h-5 w-5 accent-emerald" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} /></label>
        ))}
      </Accordion>
      <RowLink to="/wallet" icon={CreditCard} label="Payment Methods" />
      <Accordion icon={Globe} label="Language & Region" open={open === 'lang'} onToggle={() => tog('lang')}>
        <div className="grid grid-cols-2 gap-2">
          <select className={input} aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}>{['English', 'Français', 'Português'].map((l) => <option key={l}>{l}</option>)}</select>
          <select className={input} aria-label="Currency" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <button className={`${btn2} w-full`} onClick={() => toast(`Preferences noted: ${lang}, ${cur} (preview, not applied app-wide yet).`, 'warn')}>Save preferences</button>
      </Accordion>
      <RowLink to="/support" icon={HelpCircle} label="Help & Support" />
      <Accordion icon={Info} label="About Saage" open={open === 'about'} onToggle={() => tog('about')}>
        <p className="text-sm text-muted">Saage Free Trade Zone. Connect. Trade. Grow Globally. A bulk raw-materials marketplace with inspection agents and escrow. Version 0.3.0 (test build).</p>
      </Accordion>
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
  const toast = useToast()
  const [open, setOpen] = useState<string | null>('faq')
  const [faq, setFaq] = useState<number | null>(0)
  const [msg, setMsg] = useState('')
  return (
    <div>
      <PageHeader title="Help & Support" />
      <Accordion icon={FileQuestion} label="FAQs" open={open === 'faq'} onToggle={() => setOpen(open === 'faq' ? null : 'faq')}>
        {FAQ.map(([q, a], i) => (
          <div key={q}><button className="flex w-full items-center justify-between text-left text-sm font-bold" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>{q}<ChevronRight size={14} className={faq === i ? 'rotate-90' : ''} /></button>{faq === i && <p className="mt-1 text-sm text-muted">{a}</p>}</div>
        ))}
      </Accordion>
      <Accordion icon={HeadphonesIcon} label="Contact Support" open={open === 'contact'} onToggle={() => setOpen(open === 'contact' ? null : 'contact')}>
        <textarea className={input} rows={3} placeholder="How can we help?" aria-label="Message to support" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className={`${btn} w-full`} onClick={() => { if (msg.trim().length < 10) return toast('Please write at least 10 characters.', 'err'); setMsg(''); toast('Message drafted (preview, not sent yet).', 'warn') }}>Send message</button>
      </Accordion>
      <RowLink to="/messages" icon={MessageCircle} label="Live Chat" />
      <RowLink to="/disputes" icon={ShieldAlert} label="Report a Problem" />
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
    <div className="space-y-3">
      <PageHeader title="Disputes & Complaints" />
      <select className={input} aria-label="Order" value={order} onChange={(e) => setOrder(e.target.value)}>{['#SZF8723', '#SZF8720', '#SZF8712'].map((o) => <option key={o}>{o}</option>)}</select>
      <select className={input} aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      <textarea className={input} rows={4} placeholder="Describe what happened..." aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} />
      {tried && details.trim().length < 10 && <p role="alert" className="text-xs text-red-600">Please give at least 10 characters of detail.</p>}
      <label className="block text-xs font-medium">Evidence (photos, documents)<input type="file" multiple className="mt-1 block w-full text-xs" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} /></label>
      {files.length > 0 && <p className="text-xs text-muted">{files.length} file(s) selected</p>}
      <button className={`${btn} w-full`} onClick={() => { setTried(true); if (details.trim().length >= 10) setDlg(true) }}>Submit dispute</button>
      <p className="text-center text-xs text-muted">No disputes opened yet. Disputes are not sent to the Saage review team in this preview.</p>
      <ConfirmDialog open={dlg} title="Open a dispute?" confirmLabel="Open dispute" body="Escrow for this order stays on hold while the dispute is reviewed."
        onCancel={() => setDlg(false)} onConfirm={() => { setDlg(false); toast('Dispute drafted (preview, not sent).', 'warn'); nav('/order/track') }} />
    </div>
  )
}

/* ---------------- Business / agent verification ---------------- */
export function Verification() {
  const toast = useToast()
  const role = useRole()
  const { companies } = useAuth()
  const [f, setF] = useState({ reg: '', tax: '', address: '' })
  const [docs, setDocs] = useState<string[]>([])
  const [status, setStatus] = useState<'none' | 'review'>('none')
  const verified = companies[0]?.verification_status === 'verified'
  function submit() {
    if (f.reg.trim().length < 4) return toast('Enter your registration number.', 'err')
    if (docs.length === 0) return toast('Upload at least one verification document.', 'err')
    setStatus('review'); toast('Verification request recorded (preview, not sent yet).', 'warn')
  }
  return (
    <div className="space-y-3">
      <PageHeader title={role === 'agent' ? 'Agent Verification' : 'Business Verification'} />
      <div className={`${card} flex items-center gap-3`}>
        <ShieldCheck className={verified ? 'text-emerald' : 'text-amber-500'} />
        <div className="flex-1 text-sm"><p className="font-bold">{companies[0]?.name ?? 'Your business'}</p><p className="text-xs text-muted">{verified ? 'Verified' : status === 'review' ? 'Under review' : 'Not verified yet'}</p></div>
        {verified && <BadgeCheck className="text-emerald" />}
      </div>
      <input className={input} placeholder="Business registration number" aria-label="Registration number" value={f.reg} onChange={(e) => setF({ ...f, reg: e.target.value })} />
      <input className={input} placeholder="Tax ID (optional)" aria-label="Tax ID" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} />
      <input className={input} placeholder="Business address" aria-label="Business address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <label className="block text-xs font-medium">Documents (certificate, ID, licence)<input type="file" multiple accept="image/*,.pdf" className="mt-1 block w-full text-xs" onChange={(e) => setDocs(Array.from(e.target.files ?? []).map((x) => x.name))} /></label>
      {docs.length > 0 && <p className="text-xs text-muted">{docs.length} file(s) selected</p>}
      <button className={`${btn} w-full`} disabled={status === 'review'} onClick={submit}>{status === 'review' ? 'Submitted for review' : 'Submit for verification'}</button>
    </div>
  )
}

/* ---------------- Profile ---------------- */
export function Profile() {
  const { session, signOut } = useAuth()
  const role = useRole()
  const nav = useNavigate()
  const [dlg, setDlg] = useState(false)
  const meta = (session?.user?.user_metadata ?? {}) as any
  const name: string = meta.full_name || session?.user?.email || 'Saage user'
  return (
    <div className="space-y-4">
      <PageHeader title="Profile" back={false} />
      <div className="flex flex-col items-center gap-1 text-center">
        <Avatar name={name} size="h-20 w-20 text-2xl" />
        <h2 className="text-base font-extrabold">{name}</h2><p className="text-sm text-muted">{session?.user?.email}</p>
      </div>
      <div>
        <RowLink to={role === 'seller' ? '/seller/orders' : role === 'agent' ? '/agent/tasks' : '/orders'} icon={ClipboardList} label="My Orders" />
        <RowLink to="/wallet" icon={Wallet} label="My Wallet" />
        <RowLink to="/verification" icon={Building2} label="My Business Profile" />
        <RowLink to="/notifications" icon={Bell} label="Notifications" />
        <RowLink to="/settings" icon={LifeBuoy} label="Settings & Support" />
        <button className="flex w-full items-center gap-3 px-1 py-3.5 text-sm font-semibold text-red-600" onClick={() => setDlg(true)}><LogOut size={18} />Log Out</button>
      </div>
      <div className={card}>
        <p className="mb-2 text-xs font-semibold text-muted">Preview the app as</p>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1" role="tablist">
          {(['buyer', 'seller', 'agent'] as Role[]).map((r) => <button key={r} role="tab" aria-selected={role === r} onClick={() => { setPreviewRole(r); nav(r === 'buyer' ? '/' : '/dashboard') }} className={`rounded-full py-1.5 text-sm font-bold capitalize ${role === r ? 'bg-emerald text-white' : 'text-slate-700'}`}>{r}</button>)}
        </div>
      </div>
      <ConfirmDialog open={dlg} danger title="Log out?" confirmLabel="Log out" body="You will need to sign in again to access your account." onCancel={() => setDlg(false)} onConfirm={async () => { setDlg(false); await signOut(); nav('/') }} />
    </div>
  )
}
