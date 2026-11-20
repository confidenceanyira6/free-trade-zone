// Demo-only record of who has confirmed the sample order. The real confirmations and the
// release of escrow to the seller must come from the backend.
const K = 'saage_order_confirm'
export type Confirm = { buyer: boolean; seller: boolean }

export function getConfirm(): Confirm {
  try { return { buyer: false, seller: false, ...JSON.parse(localStorage.getItem(K) || '{}') } } catch { return { buyer: false, seller: false } }
}
export function setConfirm(who: 'buyer' | 'seller', v = true) {
  try { localStorage.setItem(K, JSON.stringify({ ...getConfirm(), [who]: v })) } catch { /* storage unavailable */ }
}
export function resetConfirm() {
  try { localStorage.removeItem(K) } catch { /* storage unavailable */ }
}
