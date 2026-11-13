import { ReactNode } from 'react'

export const btn = 'inline-flex items-center justify-center rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'
export const btn2 = 'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50'
export const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald'
export const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

export const ACCOUNT_TYPES = ['importer', 'exporter', 'manufacturer', 'supplier', 'wholesaler', 'distributor', 'logistics', 'investor']
export const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'CNY', 'JPY', 'ZAR', 'KES', 'GHS', 'AED']

export const Loading = () => <p className="p-6 text-sm text-muted">Loading…</p>
export const Empty = ({ text }: { text: string }) => <p className={`${card} text-center text-sm text-muted`}>{text}</p>
export const ErrorMsg = ({ msg }: { msg?: string | null }) => msg ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</p> : null
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>
)
export const Badge = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' }) => {
  const t = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald/10 text-emerald', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700' }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}
export const money = (n: number | null, c?: string) => n == null ? 'Price on request' : `${c ?? ''} ${Number(n).toLocaleString()}`.trim()
