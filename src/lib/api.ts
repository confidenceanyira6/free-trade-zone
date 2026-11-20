import { supabase } from './supabase'

/**
 * Integration points for the real backend.
 *
 * Rules the backend must enforce (the UI only mirrors them):
 *  - every financial action is idempotent: the Idempotency-Key header is a client-generated UUID
 *    and the server must return the original result on a retry instead of paying twice;
 *  - the browser can only REQUEST an action. Escrow balances, reservations, releases, refunds
 *    and ledger entries are calculated and written on the server, never sent from here;
 *  - precise locations are returned only to participants allowed to see them at that moment;
 *  - transaction IDs, assignment IDs and financial references are issued by the server.
 *
 * Until VITE_API_URL is set, every call returns BACKEND_NOT_CONNECTED and changes nothing.
 */
export const API_URL: string | undefined = (import.meta as any).env?.VITE_API_URL
export const backendConnected = !!API_URL

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: 'BACKEND_NOT_CONNECTED' | 'HTTP_ERROR' | 'NETWORK'; message: string }

export const newKey = (): string =>
  globalThis.crypto && 'randomUUID' in globalThis.crypto ? (globalThis.crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<ApiResult<T>> {
  if (!API_URL) return { ok: false, code: 'BACKEND_NOT_CONNECTED', message: 'Backend not connected yet. Nothing was changed on the server.' }
  try {
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, code: 'HTTP_ERROR', message: json.message ?? `Request failed (${res.status})` }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Network error. Please try again.' }
  }
}
const post = <T = unknown>(path: string, body: unknown, key: string = newKey()) => call<T>('POST', path, body, key)
const get = <T = unknown>(path: string) => call<T>('GET', path)

export const api = {
  // --- buyer's agents ---
  inviteAgent: (p: { channel: 'phone' | 'email' | 'link'; contact: string; name: string }) => post('/agents/invitations', p),
  setAgentActive: (agentId: string, active: boolean) => post(`/agents/${agentId}/active`, { active }),
  removeAgent: (agentId: string) => post(`/agents/${agentId}/remove`, {}),

  // --- fee negotiation (private buyer<->agent chat) ---
  sendChat: (agentId: string, p: { kind: 'text' | 'image'; text: string; attachmentId?: string }) => post(`/agents/${agentId}/chat`, p),
  proposeFee: (agentId: string, amount: number) => post(`/agents/${agentId}/fee-proposals`, { amount }),
  respondFee: (proposalId: string, action: 'accept' | 'reject' | 'counter', counterAmount?: number) => post(`/fee-proposals/${proposalId}/respond`, { action, counterAmount }),

  // --- assignments ---
  createAssignment: (p: unknown) => post('/assignments', p),
  respondAssignment: (id: string, action: 'accept' | 'decline') => post(`/assignments/${id}/respond`, { action }),
  startAssignment: (id: string) => post(`/assignments/${id}/start`, {}),
  submitReport: (id: string, p: unknown) => post(`/assignments/${id}/report`, p),
  decideReport: (id: string, action: 'approve' | 'reject' | 'reinspect' | 'clarify' | 'cancel', note?: string) => post(`/assignments/${id}/decision`, { action, note }),
  uploadDeliveryEvidence: (id: string, p: unknown) => post(`/assignments/${id}/delivery-evidence`, p),

  // --- transactions & escrow (all amounts are computed by the server) ---
  requestTransaction: (p: unknown) => post('/transactions', p),
  respondTransaction: (txId: string, action: 'accept' | 'reject' | 'negotiate', terms?: unknown) => post(`/transactions/${txId}/respond`, { action, terms }),
  fundEscrow: (txId: string) => post(`/transactions/${txId}/fund`, {}),
  cancelTransaction: (txId: string) => post(`/transactions/${txId}/cancel`, {}),
  inspectionDecision: (txId: string, action: 'approve' | 'reject' | 'reinspect' | 'clarify', note?: string) => post(`/transactions/${txId}/inspection-decision`, { action, note }),
  dispatch: (txId: string, p: unknown) => post(`/transactions/${txId}/dispatch`, p),
  updateDelivery: (txId: string, status: string, evidenceIds?: string[]) => post(`/transactions/${txId}/delivery-status`, { status, evidenceIds }),
  confirm: (txId: string, as: 'buyer' | 'seller' | 'agent') => post(`/transactions/${txId}/confirm`, { as }),
  getLocations: (txId: string) => get(`/transactions/${txId}/locations`), // server returns only what the caller may see

  // --- locations, disputes, reviews ---
  saveLocation: (p: unknown) => post('/locations', p),
  openDispute: (p: unknown) => post('/disputes', p),
  submitReview: (p: unknown) => post('/reviews', p),

  // --- admin (role checked on the server) ---
  admin: {
    freezeTransaction: (txId: string, reason: string) => post(`/admin/transactions/${txId}/freeze`, { reason }),
    resolveDispute: (id: string, outcome: 'refund_buyer' | 'release_to_seller' | 'reject_dispute', note: string) => post(`/admin/disputes/${id}/resolve`, { outcome, note }),
    authorizeRefund: (txId: string, note: string) => post(`/admin/transactions/${txId}/refund`, { note }),
    authorizeRelease: (txId: string, note: string) => post(`/admin/transactions/${txId}/release`, { note }),
    setVerification: (userId: string, status: 'verified' | 'rejected') => post(`/admin/users/${userId}/verification`, { status }),
  },
}
