import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ACCOUNT_TYPES, btn, card, ErrorMsg, Field, input } from '../ui'

export function Login() {
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message); else nav('/dashboard')
  }
  async function forgot() {
    if (!email) return setErr('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
    if (error) setErr(error.message); else setInfo('Password reset email sent.')
  }
  return (
    <form onSubmit={submit} className={`${card} mx-auto max-w-md space-y-4`}>
      <h1 className="text-xl font-bold">Sign in</h1>
      <ErrorMsg msg={err} />
      {info && <p className="rounded-lg bg-emerald/10 p-3 text-sm text-emerald">{info}</p>}
      <Field label="Email"><input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Password"><input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-emerald" onClick={forgot}>Forgot password?</button>
        <Link to="/register" className="text-emerald">Create account</Link>
      </div>
    </form>
  )
}

export function Register() {
  const [f, setF] = useState({ full_name: '', email: '', password: '', phone: '', country: '', account_type: 'importer' })
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    const { error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { emailRedirectTo: `${window.location.origin}/login`, data: { full_name: f.full_name, phone: f.phone, country: f.country, account_type: f.account_type } },
    })
    setBusy(false)
    if (error) setErr(error.message); else setDone(true)
  }
  if (done) return <div className={`${card} mx-auto max-w-md`}><h1 className="text-xl font-bold">Check your email</h1><p className="mt-2 text-sm text-muted">We sent a verification link to {f.email}. Confirm it, then sign in.</p></div>
  return (
    <form onSubmit={submit} className={`${card} mx-auto max-w-md space-y-4`}>
      <h1 className="text-xl font-bold">Create your account</h1>
      <ErrorMsg msg={err} />
      <Field label="Full name"><input className={input} required value={f.full_name} onChange={set('full_name')} /></Field>
      <Field label="Business email"><input className={input} type="email" required value={f.email} onChange={set('email')} /></Field>
      <Field label="Password (min 8 characters)"><input className={input} type="password" minLength={8} required value={f.password} onChange={set('password')} /></Field>
      <Field label="Phone"><input className={input} value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Country (2-letter code, e.g. NG)"><input className={input} maxLength={2} required value={f.country} onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase() })} /></Field>
      <Field label="I am primarily a">
        <select className={input} value={f.account_type} onChange={set('account_type')}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </Field>
      <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="text-center text-sm">Have an account? <Link to="/login" className="text-emerald">Sign in</Link></p>
    </form>
  )
}
