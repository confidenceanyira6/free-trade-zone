// Keeps the in-progress bulk order between the order screens (session only).
export type Draft = { productId: string; qty: number; mode: 'agent' | 'direct'; note: string; address: string; agentId: string; checks: string[] }

const K = 'saage_order_draft'
export const defaultDraft: Draft = {
  productId: 'p1', qty: 100, mode: 'agent', note: '', address: 'Lagos, Nigeria', agentId: 'a1',
  checks: ['Quality Check', 'Quantity Check', 'Photos & Report'],
}

export function loadDraft(): Draft {
  try { return { ...defaultDraft, ...JSON.parse(sessionStorage.getItem(K) || '{}') } } catch { return defaultDraft }
}
export function saveDraft(d: Partial<Draft>) {
  try { sessionStorage.setItem(K, JSON.stringify({ ...loadDraft(), ...d })) } catch { /* storage unavailable */ }
}
