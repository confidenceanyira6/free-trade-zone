import { useCallback, useEffect, useState } from 'react'
import type { Note } from './types'
import { SEED_NOTES } from './fixtures'

/**
 * Local (browser) repository used ONLY for non-financial records while the backend is not
 * connected: agents, chat, assignments, notes, reviews, locations, dispute drafts.
 * Everything saved here is marked "Saved on this device" in the UI and is replaced by API calls
 * (see api.ts). Money is never stored or changed here.
 */
const P = 'saage_demo:'
const listeners = new Set<() => void>()

export function readCollection<T>(key: string, seed: T[]): T[] {
  try { const v = localStorage.getItem(P + key); return v ? (JSON.parse(v) as T[]) : seed } catch { return seed }
}
function write<T>(key: string, v: T[]) {
  try { localStorage.setItem(P + key, JSON.stringify(v)) } catch { /* storage unavailable */ }
  listeners.forEach((l) => l())
}

export function useCollection<T>(key: string, seed: T[]): [T[], (fn: (p: T[]) => T[]) => void] {
  const [items, setItems] = useState<T[]>(() => readCollection(key, seed))
  useEffect(() => {
    setItems(readCollection(key, seed))
    const l = () => setItems(readCollection(key, seed))
    listeners.add(l)
    return () => { listeners.delete(l) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const update = useCallback((fn: (p: T[]) => T[]) => write(key, fn(readCollection(key, seed))), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return [items, update]
}

/** Placeholder ID for records that exist only on this device. The server issues the real IDs. */
export const localId = (prefix: string) => `${prefix}-LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
export const nowStr = () => new Date().toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export function pushNote(n: { type: string; text: string; to: string }) {
  const cur = readCollection<Note>('notes', SEED_NOTES)
  write<Note>('notes', [{ ...n, id: localId('NTF'), time: new Date().toISOString(), read: false }, ...cur])
}
