import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { DEMO_KEY, DemoUser, findDemo, matchDemo } from './demo-auth'

type Ctx = {
  session: Session | null
  loading: boolean
  companies: any[]
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  demoLogin: (email: string, password: string) => boolean
}
const AuthCtx = createContext<Ctx>(null as any)
export const useAuth = () => useContext(AuthCtx)

const isDemoStored = () => { try { return !!findDemo(localStorage.getItem(DEMO_KEY)) } catch { return false } }

function demoSession(u: DemoUser): Session {
  return {
    access_token: 'demo', refresh_token: 'demo', expires_in: 3600, token_type: 'bearer',
    user: { id: `demo-${u.role}`, aud: 'authenticated', email: u.email, app_metadata: {}, created_at: '', demo: true,
      user_metadata: { full_name: u.name, saage_role: u.role, account_type: u.role === 'buyer' ? 'importer' : 'supplier' } },
  } as any
}
const demoCompany = (u: DemoUser) => ({ id: `demo-company-${u.role}`, name: u.company, country: 'NG', verification_status: 'verified' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  function applyDemo(u: DemoUser) { setSession(demoSession(u)); setCompanies([demoCompany(u)]); setIsAdmin(false) }

  async function load(s: Session | null) {
    if (!s) { setCompanies([]); setIsAdmin(false); return }
    if ((s.user as any).demo) return
    const [c, a] = await Promise.all([
      supabase.from('companies').select('*').eq('owner_id', s.user.id).order('created_at'),
      supabase.from('admin_users').select('admin_role').eq('user_id', s.user.id).maybeSingle(),
    ])
    setCompanies(c.data ?? [])
    setIsAdmin(!!a.data)
  }

  useEffect(() => {
    let unsub = () => {}
    let demo: DemoUser | undefined
    try { demo = findDemo(localStorage.getItem(DEMO_KEY)) } catch { /* storage unavailable */ }
    if (demo) applyDemo(demo)

    supabase.auth.getSession().then(async ({ data }) => {
      if (!demo) { setSession(data.session); await load(data.session) }
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (isDemoStored()) return
      setSession(s)
      setTimeout(() => load(s), 0)
    })
    unsub = () => sub.subscription.unsubscribe()
    return () => unsub()
  }, [])

  return (
    <AuthCtx.Provider
      value={{
        session, loading, companies, isAdmin,
        refresh: () => load(session),
        demoLogin: (email, password) => {
          const u = matchDemo(email, password)
          if (!u) return false
          try { localStorage.setItem(DEMO_KEY, u.email); localStorage.setItem('saage_preview_role', u.role) } catch { /* storage unavailable */ }
          applyDemo(u)
          return true
        },
        signOut: async () => {
          try { localStorage.removeItem(DEMO_KEY); localStorage.removeItem('saage_preview_role') } catch { /* storage unavailable */ }
          setSession(null); setCompanies([]); setIsAdmin(false)
          try { await supabase.auth.signOut() } catch { /* offline */ }
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
