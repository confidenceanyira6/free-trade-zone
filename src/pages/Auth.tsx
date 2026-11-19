import { FormEvent, InputHTMLAttributes, ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Apple, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, MapPin, Phone, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { DEMO_USERS } from '../lib/demo-auth'
import { ROLE_TYPE, Role } from '../lib/roles'
import { Logo } from '../components/Logo'
import { btn, ErrorMsg, input } from '../ui'

const COUNTRIES: [string, string][] = [['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['CI', "Côte d'Ivoire"], ['CM', 'Cameroon'], ['TZ', 'Tanzania'], ['EG', 'Egypt'], ['CN', 'China'], ['IN', 'India'], ['AE', 'United Arab Emirates'], ['GB', 'United Kingdom'], ['US', 'United States'], ['DE', 'Germany'], ['NL', 'Netherlands']]

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up flex-1 bg-white px-6 pb-8 pt-8">
      <div className="mb-5 flex justify-center"><Link to="/" aria-label="Back to welcome"><Logo size={48} stacked /></Link></div>
      <h1 className="text-center text-xl font-extrabold">{title}</h1>
      <p className="mb-6 mt-1 text-center text-xs text-muted">{subtitle}</p>
      {children}
    </div>
  )
}

function IconInput({ icon: Icon, right, ...props }: { icon: LucideIcon; right?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute left-3 top-3.5 text-slate-400" />
      <input {...props} className={`${input} pl-10 ${right ? 'pr-10' : ''}`} />
      {right && <span className="absolute right-3 top-3">{right}</span>}
    </div>
  )
}

function PasswordInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; minLength?: number; autoComplete?: string }) {
  const [show, setShow] = useState(false)
  return (
    <IconInput icon={Lock} type={show ? 'text' : 'password'} required placeholder={props.placeholder ?? 'Password'} aria-label="Password" autoComplete={props.autoComplete}
      minLength={props.minLength} value={props.value} onChange={(e) => props.onChange(e.target.value)}
      right={<button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="text-slate-500">{show ? <Eye size={18} /> : <EyeOff size={18} />}</button>} />
  )
}

const GoogleG = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
)

async function oauth(provider: 'google' | 'apple', setErr: (s: string) => void) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
  if (error) setErr(error.message)
}

export function Login() {
  const nav = useNavigate()
  const { demoLogin } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (demoLogin(email, password)) { nav('/'); return }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message); else nav('/')
  }
  async function forgot() {
    setInfo(null)
    if (!email) return setErr('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
    if (error) setErr(error.message); else { setErr(null); setInfo('Password reset email sent. Check your inbox.') }
  }
  return (
    <Shell title="Welcome Back" subtitle="Sign in to your account">
      <form onSubmit={submit} className="space-y-3">
        <ErrorMsg msg={err} />
        {info && <p className="rounded-xl bg-emerald/10 p-3 text-sm text-emerald">{info}</p>}
        <IconInput icon={Mail} type="email" required autoComplete="email" placeholder="Email Address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="text-right"><button type="button" className="text-xs font-semibold text-emerald" onClick={forgot}>Forgot Password?</button></div>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-slate-200" />or continue with<span className="h-px flex-1 bg-slate-200" /></div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" aria-label="Continue with Google" className="grid place-items-center rounded-xl border border-slate-200 py-2.5" onClick={() => oauth('google', setErr)}><GoogleG /></button>
        <button type="button" aria-label="Continue with Apple" className="grid place-items-center rounded-xl border border-slate-200 py-2.5" onClick={() => oauth('apple', setErr)}><Apple size={22} fill="currentColor" /></button>
      </div>
      <p className="mt-5 text-center text-sm">Don't have an account? <Link to="/register" className="font-bold text-emerald">Sign Up</Link></p>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="mb-2 font-semibold">Test accounts (work without a backend)</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_USERS.map((u) => (
            <button key={u.email} type="button" className="rounded-lg bg-white py-2 font-semibold ring-1 ring-amber-200" onClick={() => { setEmail(u.email); setPassword(u.password) }}>Fill {u.role === 'seller' ? 'supplier' : 'buyer'}</button>
          ))}
        </div>
      </div>
    </Shell>
  )
}

export function Register() {
  const [role, setRole] = useState<Role>('buyer')
  const [f, setF] = useState({ full_name: '', business_name: '', email: '', phone: '', country: 'NG', address: '', password: '' })
  const [terms, setTerms] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    if (!terms) return setErr('Please accept the Terms & Conditions and Privacy Policy.')
    if (role === 'seller' && !f.business_name.trim()) return setErr('Business name is required for sellers.')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: f.full_name, business_name: f.business_name, phone: f.phone, country: f.country, address: f.address, account_type: ROLE_TYPE[role], saage_role: role },
      },
    })
    setBusy(false)
    if (error) setErr(error.message); else setDone(true)
  }

  if (done) return (
    <Shell title="Check your email" subtitle={`We sent a verification link to ${f.email}`}>
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto text-emerald" size={56} />
        <p className="text-sm text-muted">Confirm your email, then sign in to finish setting up your {role} account and business verification.</p>
        <Link to="/login" className={`${btn} w-full`}>Go to Sign In</Link>
      </div>
    </Shell>
  )

  return (
    <Shell title="Create Account" subtitle="Join our global trade network">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1" role="tablist" aria-label="Account type">
        {(['buyer', 'seller', 'agent'] as Role[]).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)}
            className={`rounded-full py-1.5 text-sm font-bold capitalize transition ${role === r ? 'bg-emerald text-white' : 'text-slate-700'}`}>{r}</button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <ErrorMsg msg={err} />
        <IconInput icon={User} required placeholder="Full Name" aria-label="Full name" value={f.full_name} onChange={set('full_name')} />
        <IconInput icon={Building2} required={role === 'seller'} placeholder="Business Name" aria-label="Business name" value={f.business_name} onChange={set('business_name')} />
        <IconInput icon={Mail} type="email" required autoComplete="email" placeholder="Email Address" aria-label="Email address" value={f.email} onChange={set('email')} />
        <IconInput icon={Phone} type="tel" required placeholder="Phone Number" aria-label="Phone number" value={f.phone} onChange={set('phone')} />
        <select className={input} aria-label="Country" value={f.country} onChange={set('country')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        <IconInput icon={MapPin} required placeholder="Business Address" aria-label="Business address" value={f.address} onChange={set('address')} />
        <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} minLength={8} placeholder="Password" autoComplete="new-password" />
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span>I agree to the <b className="text-emerald">Terms & Conditions</b> and <b className="text-emerald">Privacy Policy</b></span></label>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
      </form>
    </Shell>
  )
}
