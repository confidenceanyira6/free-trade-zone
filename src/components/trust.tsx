import { ReactNode } from 'react'
import { Lock, MapPin, Star } from 'lucide-react'
import { Badge, card } from '../ui'
import { useToast } from './kit'
import type { ApiResult } from '../lib/api'

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'orange'

export const SyncBadge = ({ synced }: { synced: boolean }) => <Badge tone={synced ? 'green' : 'amber'}>{synced ? 'Synced' : 'Saved on this device'}</Badge>

const TONES: Record<string, Tone> = {
  Pending: 'amber', Accepted: 'green', 'In Progress': 'orange', 'Inspection Completed': 'orange', Approved: 'green', Rejected: 'red', Cancelled: 'slate',
  'On Hold': 'red', Completed: 'green', Disputed: 'red', Returned: 'red', Refunded: 'slate',
  Verified: 'green', verified: 'green', pending: 'amber', unverified: 'slate',
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={TONES[status] ?? 'slate'}>{status}</Badge>

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-accent text-accent' : 'text-slate-300'} />)}
    </span>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => onChange(i)}>
          <Star size={28} className={i <= value ? 'fill-accent text-accent' : 'text-slate-300'} />
        </button>
      ))}
    </div>
  )
}

export function FilePick({ label, accept, names, onChange }: { label: string; accept?: string; names: string[]; onChange: (n: string[]) => void }) {
  return (
    <label className="block text-xs font-medium">{label}
      <input type="file" multiple accept={accept} className="mt-1 block w-full text-xs" onChange={(e) => onChange(Array.from(e.target.files ?? []).map((f) => f.name))} />
      {names.length > 0 && <span className="mt-1 block text-[11px] text-muted">{names.length} selected: {names.slice(0, 3).join(', ')}{names.length > 3 ? '…' : ''} (uploaded to secure storage once the backend is connected)</span>}
    </label>
  )
}

/** A precise location. When hidden, only the approximate area is shown. The server must enforce this too. */
export function LockedLocation({ visible, label, value, approx }: { visible: boolean; label: string; value: string; approx: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="text-xs text-muted">{label}</p>
      {visible ? (
        <p className="flex items-start gap-1.5 font-semibold"><MapPin size={15} className="mt-0.5 shrink-0 text-emerald" />{value}</p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 font-semibold text-muted"><Lock size={14} />Hidden until the transaction starts</p>
          <p className="text-xs text-muted">Area only: {approx}</p>
        </>
      )}
    </div>
  )
}

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={`${card} space-y-3`}><h2 className="text-sm font-bold">{title}</h2>{children}</section>
)

/** For changes that only save locally while the backend is offline (agents, chat, tasks, notes, reviews). */
export function useSync() {
  const toast = useToast()
  return async function sync<T>(call: () => Promise<ApiResult<T>>, okMsg: string) {
    const r = await call()
    toast(r.ok ? okMsg : 'Saved on this device only. Backend not connected yet.', r.ok ? 'ok' : 'warn')
    return r
  }
}

/** For money and other server-controlled actions: nothing changes unless the server confirms it. */
export function useRun() {
  const toast = useToast()
  return async function run<T>(call: () => Promise<ApiResult<T>>, okMsg: string) {
    const r = await call()
    toast(r.ok ? okMsg : r.message, r.ok ? 'ok' : 'warn')
    return r
  }
}
