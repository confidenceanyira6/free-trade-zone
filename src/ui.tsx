import { ReactNode } from 'react'

export const btn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf active:scale-[.98] disabled:opacity-50'
export const btn2 = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-50 active:scale-[.98] disabled:opacity-50'
export const btnAccent = 'inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[.98] disabled:opacity-50'
export const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/30'
export const card = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm'

export const ACCOUNT_TYPES = ['importer', 'exporter', 'manufacturer', 'supplier', 'wholesaler', 'distributor', 'logistics', 'investor']
export const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'CNY', 'JPY', 'ZAR', 'KES', 'GHS', 'AED']

export const Loading = () => (
  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald border-t-transparent" /> Loading…
  </div>
)
export const Empty = ({ text }: { text: string }) => <p className={`${card} text-center text-sm text-muted`}>{text}</p>
export const ErrorMsg = ({ msg }: { msg?: string | null }) => msg ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{msg}</p> : null
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>
)
export const Badge = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'orange' }) => {
  const t = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald/10 text-emerald',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-accent/15 text-accent',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}
export const money = (n: number | null, c?: string) => n == null ? 'Price on request' : `${c ?? ''} ${Number(n).toLocaleString()}`.trim()
