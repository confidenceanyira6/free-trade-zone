import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Ctx = {
  session: Session | null
  loading: boolean
  companies: any[]
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx>(null as any)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  async function load(s: Session | null) {
    if (!s) { setCompanies([]); setIsAdmin(false); return }
    const [c, a] = await Promise.all([
      supabase.from('companies').select('*').eq('owner_id', s.user.id).order('created_at'),
      supabase.from('admin_users').select('admin_role').eq('user_id', s.user.id).maybeSingle(),
    ])
    setCompanies(c.data ?? [])
    setIsAdmin(!!a.data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await load(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => load(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthCtx.Provider
      value={{
        session, loading, companies, isAdmin,
        refresh: () => load(session),
        signOut: async () => { await supabase.auth.signOut() },
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
