// Keeps the in-progress bulk order between the order screens (session only).
export type OwnAgent = { name: string; contact: string; location: string }
export type Draft = { productId: string; qty: number; mode: 'agent' | 'direct'; note: string; address: string; agent: OwnAgent; checks: string[] }

const K = 'saage_order_draft'
export const defaultDraft: Draft = {
  productId: 'p1', qty: 500, mode: 'agent', note: '', address: 'Lagos, Nigeria',
  agent: { name: '', contact: '', location: '' },
  checks: ['Quality Check', 'Quantity Check', 'Photos & Report'],
}

export function loadDraft(): Draft {
  try { return { ...defaultDraft, ...JSON.parse(sessionStorage.getItem(K) || '{}') } } catch { return defaultDraft }
}
export function saveDraft(d: Partial<Draft>) {
  try { sessionStorage.setItem(K, JSON.stringify({ ...loadDraft(), ...d })) } catch { /* storage unavailable */ }
}
