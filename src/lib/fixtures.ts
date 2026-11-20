import type { AgentRec, Assignment, ChatMsg, Dispute, DeliveryStatus, Note, Review } from './types'
import { escrowBreakdown } from './fees'

// Sample records so every screen can be tested before the backend exists.

export const SEED_AGENTS: AgentRec[] = [
  { id: 'a1', name: 'Chinedu Okafor', contact: '+2348012345678', channel: 'phone', status: 'accepted', verification: 'verified', active: true, rating: 4.8, completed: 120, area: 'Lagos, Nigeria', joined: 'Aug 2026', synced: true },
  { id: 'a2', name: 'Amaka Okoro', contact: 'amaka.okoro@example.com', channel: 'email', status: 'accepted', verification: 'pending', active: true, rating: 4.6, completed: 86, area: 'Ibadan, Nigeria', joined: 'Sep 2026', synced: true },
  { id: 'a3', name: 'Tunde Bello', contact: '+2348098765432', channel: 'phone', status: 'invited', verification: 'unverified', active: false, rating: 0, completed: 0, area: 'Abuja, Nigeria', joined: '-', synced: true },
]

export const seedChat = (agentId: string): ChatMsg[] => {
  if (agentId === 'a1') return [
    { id: 'm1', from: 'buyer', kind: 'text', text: 'Hello Chinedu, can you inspect 500 m³ of teak in Ikorodu next week?', time: 'Nov 14, 09:10' },
    { id: 'm2', from: 'agent', kind: 'text', text: 'Yes, I can. My inspection fee is ₦50,000.', time: 'Nov 14, 09:22' },
    { id: 'm3', from: 'agent', kind: 'fee', text: 'Inspection fee proposal', fee: { amount: 50000, state: 'accepted' }, time: 'Nov 14, 09:23' },
    { id: 'm4', from: 'buyer', kind: 'text', text: 'Agreed. Please also take video of the stack.', time: 'Nov 14, 09:30' },
  ]
  if (agentId === 'a2') return [
    { id: 'm1', from: 'buyer', kind: 'text', text: 'Can you inspect natural rubber at a supplier in Benin City?', time: 'Nov 18, 14:02' },
    { id: 'm2', from: 'agent', kind: 'fee', text: 'Inspection fee proposal', fee: { amount: 120000, state: 'proposed' }, time: 'Nov 18, 14:15' },
  ]
  return []
}

export const SEED_ASSIGNMENTS: Assignment[] = [
  { id: 'ASG-2026-000214', txRef: 'TX-2026-000481', agentId: 'a1', kind: 'Inspect goods at seller location', desc: 'Inspect 500 m³ of teak: grade, moisture, quantity and condition.', seller: 'Lagos Timber Co.', goods: 'Premium Timber (Teak) · 500 m³', location: 'Plot 12, Ikorodu Industrial Estate, Lagos', deadline: '2026-11-25', fee: 50000, feeStatus: 'reserved', status: 'In Progress', synced: true, created: 'Nov 15, 2026' },
  { id: 'ASG-2026-000219', agentId: 'a2', kind: 'Inspect another supplier', desc: 'Inspect natural rubber at a second supplier before the buyer commits.', seller: 'Edo Rubber Estates', goods: 'Natural Rubber · 50 T', location: 'Benin Industrial Layout, Benin City', deadline: '2026-11-28', fee: 120000, feeStatus: 'agreed', status: 'Pending', synced: true, created: 'Nov 18, 2026' },
  { id: 'ASG-2026-000223', txRef: 'TX-2026-000455', agentId: 'a1', kind: 'Verify seller warehouse', desc: 'Verify that the warehouse exists and holds 100 T of charcoal.', seller: 'Kogi Charcoal Works', goods: 'Charcoal · 100 T', location: 'Lokoja Road Depot, Kogi', deadline: '2026-11-20', fee: 60000, feeStatus: 'reserved', status: 'Inspection Completed', synced: true, created: 'Nov 12, 2026',
    report: { quality: 'Good, lump size consistent, low dust.', quantity: '98 T verified on site (2 T short).', measurements: '12 stacks, 8-9 T each.', comments: 'Warehouse is real and in operation.', recommendation: 'approve', photos: ['stack1.jpg', 'stack2.jpg', 'warehouse.jpg'], videos: ['walkthrough.mp4'], docs: ['quality-report.pdf'], submittedAt: 'Nov 19, 2026', clarifications: [] } },
]

export const SEED_NOTES: Note[] = [
  { id: 'n1', type: 'Inspection update', text: 'Chinedu uploaded the inspection report for ASG-2026-000223', to: '/assignments/ASG-2026-000223', time: new Date(Date.now() - 2 * 3600e3).toISOString(), read: false },
  { id: 'n2', type: 'Agent fee proposal', text: 'Amaka Okoro proposed an inspection fee of ₦120,000', to: '/agents/a2/chat', time: new Date(Date.now() - 3 * 3600e3).toISOString(), read: false },
  { id: 'n3', type: 'Delivery arrival', text: 'Order TX-2026-000481 arrived at the destination', to: '/transactions/tx-1', time: new Date(Date.now() - 5 * 3600e3).toISOString(), read: false },
  { id: 'n4', type: 'Escrow funding', text: 'Escrow funded for TX-2026-000481', to: '/escrow', time: new Date(Date.now() - 26 * 3600e3).toISOString(), read: true },
  { id: 'n5', type: 'New rating', text: 'Lagos Timber Co. received a new 5-star review', to: '/reviews', time: new Date(Date.now() - 30 * 3600e3).toISOString(), read: true },
]

export const SEED_REVIEWS: Review[] = [
  { id: 'r1', txRef: 'TX-2026-000310', target: 'agent', targetId: 'a1', targetName: 'Chinedu Okafor', stars: 5, text: 'Thorough inspection with clear photos and measurements.', date: 'Oct 30, 2026', by: 'Buyer John', synced: true },
  { id: 'r2', txRef: 'TX-2026-000290', target: 'agent', targetId: 'a1', targetName: 'Chinedu Okafor', stars: 5, text: 'Reliable and on time.', date: 'Oct 12, 2026', by: 'Okafor Foods', synced: true },
  { id: 'r3', txRef: 'TX-2026-000301', target: 'agent', targetId: 'a2', targetName: 'Amaka Okoro', stars: 4, text: 'Good report, slightly late.', date: 'Oct 21, 2026', by: 'TyreWorks Ltd', synced: true },
  { id: 'r4', txRef: 'TX-2026-000310', target: 'seller', targetId: 's1', targetName: 'Lagos Timber Co.', stars: 5, text: 'Goods matched the listing exactly.', date: 'Oct 30, 2026', by: 'Buyer John', synced: true },
  { id: 'r5', txRef: 'TX-2026-000288', target: 'seller', targetId: 's1', targetName: 'Lagos Timber Co.', stars: 4, text: 'Delivered a day late but communication was good.', date: 'Oct 05, 2026', by: 'GrillCo', synced: true },
]

export const SEED_DISPUTES: Dispute[] = [
  { id: 'DSP-2026-000031', txRef: 'TX-2026-000455', type: 'Damaged goods', text: 'Several bags were wet on arrival.', evidence: ['photo1.jpg', 'photo2.jpg'], refund: true, status: 'Under investigation', synced: true, date: 'Nov 19, 2026' },
]

/* ---------------- transactions (read-only samples) ---------------- */
export const FLOW = [
  'Request sent', 'Terms agreed', 'Escrow funded', 'Inspection in progress', 'Inspection report ready', 'Inspection approved',
  'Dispatched', 'In transit', 'Arrived at destination', 'Both parties confirmed', 'Funds released',
]

export type Tx = {
  id: string; ref: string; product: string; kind: string; qty: string
  goods: number; delivery: number; agentFee: number
  seller: string; sellerId: string; buyer: string
  agentId: string | null; agentName: string | null
  approxFrom: string; approxTo: string
  sellerLocation: string; buyerLocation: string
  stage: number; hold?: boolean; inspectionRequired: boolean
}
export type LocalTx = Tx & { synced: boolean }

export const TXS: Tx[] = [
  { id: 'tx-1', ref: 'TX-2026-000481', product: 'Premium Timber (Teak)', kind: 'timber', qty: '500 m³', goods: 5000000, delivery: 100000, agentFee: 50000, seller: 'Lagos Timber Co.', sellerId: 's1', buyer: 'Buyer John', agentId: 'a1', agentName: 'Chinedu Okafor', approxFrom: 'Ikorodu, Lagos', approxTo: 'Apapa, Lagos', sellerLocation: 'Plot 12, Ikorodu Industrial Estate, Lagos', buyerLocation: 'Warehouse 4, Apapa Port Road, Lagos', stage: 8, inspectionRequired: true },
  { id: 'tx-2', ref: 'TX-2026-000502', product: 'Crude Red Oil', kind: 'oil', qty: '100,000 L', goods: 6500000, delivery: 250000, agentFee: 120000, seller: 'Delta Palm Ltd', sellerId: 's2', buyer: 'Okafor Foods', agentId: 'a2', agentName: 'Amaka Okoro', approxFrom: 'Warri, Delta', approxTo: 'Onitsha, Anambra', sellerLocation: 'Km 4 Refinery Road, Warri', buyerLocation: '17 Industrial Layout, Onitsha', stage: 0, inspectionRequired: true },
  { id: 'tx-3', ref: 'TX-2026-000377', product: 'Natural Rubber', kind: 'rubber', qty: '50 T', goods: 6000000, delivery: 180000, agentFee: 80000, seller: 'Edo Rubber Estates', sellerId: 's3', buyer: 'TyreWorks Ltd', agentId: 'a1', agentName: 'Chinedu Okafor', approxFrom: 'Benin City, Edo', approxTo: 'Ikeja, Lagos', sellerLocation: 'Estate Gate 2, Benin City', buyerLocation: 'Plot 9, Ikeja Industrial Estate', stage: 10, inspectionRequired: true },
  { id: 'tx-4', ref: 'TX-2026-000455', product: 'Charcoal', kind: 'charcoal', qty: '100 T', goods: 3500000, delivery: 150000, agentFee: 60000, seller: 'Kogi Charcoal Works', sellerId: 's4', buyer: 'GrillCo', agentId: 'a2', agentName: 'Amaka Okoro', approxFrom: 'Lokoja, Kogi', approxTo: 'Abuja', sellerLocation: 'Lokoja Road Depot, Kogi', buyerLocation: 'Unit 3, Idu Industrial Area, Abuja', stage: 7, hold: true, inspectionRequired: true },
]

export function deliveryOf(stage: number): DeliveryStatus | null {
  if (stage < 5) return null
  if (stage === 5) return 'Awaiting Dispatch'
  if (stage === 6) return 'Dispatched'
  if (stage === 7) return 'In Transit'
  if (stage === 8) return 'Awaiting Buyer Confirmation'
  return 'Completed'
}

export type LedgerRow = { ref: string; text: string; amount: number; kind: 'credit' | 'hold' | 'release' | 'fee' | 'note' }

/** Sample of what the server's append-only ledger would show. */
export function ledgerFor(t: Tx, stage: number): LedgerRow[] {
  const b = escrowBreakdown({ goods: t.goods, delivery: t.delivery, agentFee: t.agentFee })
  const n = t.ref.slice(-6)
  const rows: LedgerRow[] = []
  if (stage >= 2) rows.push(
    { ref: `FIN-${n}-01`, text: 'Escrow funded by buyer', amount: b.buyerTotal, kind: 'credit' },
    { ref: `FIN-${n}-02`, text: 'Reserved: goods payment', amount: b.goods, kind: 'hold' },
    { ref: `FIN-${n}-03`, text: 'Reserved: delivery allocation', amount: b.delivery, kind: 'hold' },
    { ref: `FIN-${n}-04`, text: 'Reserved: agent fee (separate)', amount: b.agentFee, kind: 'hold' },
  )
  if (t.hold) rows.push({ ref: `FIN-${n}-H1`, text: 'Transaction placed on hold (dispute open)', amount: 0, kind: 'note' })
  if (stage >= 10) rows.push(
    { ref: `FIN-${n}-05`, text: 'Released to seller (net of platform fee)', amount: b.sellerNet, kind: 'release' },
    { ref: `FIN-${n}-06`, text: 'Platform fee', amount: b.platformFee, kind: 'fee' },
    { ref: `FIN-${n}-07`, text: 'Released to agent', amount: b.agentFee, kind: 'release' },
  )
  return rows
}
