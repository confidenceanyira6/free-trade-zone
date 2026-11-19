import { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { btn, btn2, card } from '../ui'
import { Art, kindOf } from './Art'

export { kindOf }

/* ---------- toasts ---------- */
type Tone = 'ok' | 'warn' | 'err'
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: Tone }[]>([])
  const push = useCallback((msg: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((i) => [...i, { id, msg, tone }])
    setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), 4500)
  }, [])
  const cls = { ok: 'bg-forest', warn: 'bg-amber-600', err: 'bg-red-600' }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`animate-fade-up pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${cls[t.tone]}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- confirmation dialog ---------- */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onCancel}>
      <div className="animate-fade-up w-full max-w-sm space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="text-sm text-muted">{body}</div>
        <div className="flex gap-2 pt-1">
          <button className={`${btn2} flex-1`} onClick={onCancel}>Cancel</button>
          <button className={`${danger ? 'inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white' : btn} flex-1`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- layout helpers ---------- */
export function PageHeader({ title, right, back = true }: { title: string; right?: ReactNode; back?: boolean }) {
  const nav = useNavigate()
  return (
    <div className="relative mb-4 flex h-10 items-center justify-center">
      {back && <button aria-label="Go back" onClick={() => nav(-1)} className="absolute left-0 rounded-full p-2 hover:bg-slate-100"><ArrowLeft size={20} /></button>}
      <h1 className="text-base font-bold">{title}</h1>
      {right && <div className="absolute right-0">{right}</div>}
    </div>
  )
}

export function SectionTitle({ title, to, action = 'See All' }: { title: string; to?: string; action?: string }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h2 className="text-sm font-bold">{title}</h2>
      {to && <Link to={to} className="text-xs font-semibold text-emerald">{action} ›</Link>}
    </div>
  )
}

// Test-mode notice now lives in the app header, so screens no longer repeat it.
export function DemoBanner(_props: { text?: string }) {
  return null
}

export function EscrowNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-emerald/10 p-3 text-xs text-forest">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{children ?? 'Funds held in escrow are not withdrawable. They are released only after inspection, delivery and both buyer and seller confirmations.'}</span>
    </div>
  )
}

export function Stat({ label, value, icon: Icon, tint = 'bg-emerald/10 text-emerald', tone = 'text-ink', sub }: { label: string; value: ReactNode; icon?: LucideIcon; tint?: string; tone?: string; sub?: string }) {
  return (
    <div className={card}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">{Icon && <span className={`grid h-5 w-5 place-items-center rounded ${tint}`}><Icon size={12} /></span>}{label}</p>
      <p className={`mt-1.5 text-xl font-extrabold ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  )
}

export function Tile({ to, icon: Icon, label, tint = 'bg-emerald/10 text-emerald' }: { to: string; icon: LucideIcon; label: string; tint?: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-[11px] font-semibold leading-tight transition active:scale-95">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon size={22} /></span>{label}
    </Link>
  )
}

export function Thumb({ kind = 'default', className = 'h-16 w-16' }: { kind?: string; className?: string }) {
  return <Art kind={kind} className={`${className} rounded-xl`} />
}

export function Avatar({ name, size = 'h-11 w-11', online, tone = 'bg-emerald/15 text-emerald' }: { name: string; size?: string; online?: boolean; tone?: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full text-sm font-bold ${size} ${tone}`}>
      {initials}
      {online !== undefined && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-emerald' : 'bg-slate-300'}`} aria-label={online ? 'Online' : 'Offline'} />}
    </span>
  )
}

/* ---------- progress timeline ---------- */
export type Step = { title: string; time?: string; state: 'done' | 'current' | 'todo' }
export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${s.state === 'done' ? 'bg-emerald' : 'bg-slate-200'}`} />}
          <span className={`z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${s.state === 'done' ? 'border-emerald bg-emerald text-white' : s.state === 'current' ? 'border-accent bg-white' : 'border-slate-300 bg-white'}`}>
            {s.state === 'done' ? <Check size={14} /> : s.state === 'current' ? <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
          </span>
          <div>
            <p className={`text-sm font-bold ${s.state === 'todo' ? 'text-muted' : ''}`}>{s.title}</p>
            {s.time && <p className="text-xs text-muted">{s.time}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Pill tabs (green when selected). */
export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${value === t ? 'bg-emerald text-white' : 'bg-slate-100 text-ink'}`}>{t}</button>
      ))}
    </div>
  )
}

/** Text tabs with an underline (used on seller orders). */
export function UnderlineTabs({ tabs, value, onChange, tone = 'accent' }: { tabs: string[]; value: string; onChange: (t: string) => void; tone?: 'accent' | 'emerald' }) {
  const on = tone === 'accent' ? 'border-accent text-accent' : 'border-emerald text-emerald'
  return (
    <div className="mb-4 flex border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)}
          className={`flex-1 border-b-2 py-2 text-xs font-bold ${value === t ? on : 'border-transparent text-muted'}`}>{t}</button>
      ))}
    </div>
  )
}

export const DoneIcon = () => <CheckCircle2 className="text-emerald" size={18} />

export function BreakdownTable({ rows, total, totalLabel = 'Total' }: { rows: [string, string, string?][]; total?: string; totalLabel?: string }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map(([k, v, hint]) => (
        <div key={k} className="flex items-start justify-between gap-3 py-2">
          <dt className="text-muted">{k}{hint && <span className="block text-[11px]">{hint}</span>}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
      {total && <div className="flex justify-between py-3 text-base font-extrabold"><dt>{totalLabel}</dt><dd className="text-emerald">{total}</dd></div>}
    </dl>
  )
}
