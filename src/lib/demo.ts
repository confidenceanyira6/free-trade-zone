// Realistic demonstration data used until the backend is connected.
// Swap these for API calls later; the screens only read from here.
import { breakdown } from './fees'

export const UNITS = ['Kilograms (kg)', 'Metric tonnes', 'Litres', 'Cubic metres (m³)', 'Pieces', 'Bags', 'Containers']
export const CATEGORIES = ['Agricultural Products', 'Forestry Products', 'Industrial Raw Materials', 'Machinery & Equipment']

export type DemoProduct = { id: string; name: string; kind: string; bulk: string; unit: string; price: number; minQty: number; stock: number; step: number; seller: string; origin: string; active: boolean }

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 'p1', name: 'Premium Timber (Teak)', kind: 'timber', bulk: '100m³+', unit: 'm³', price: 250000, minQty: 100, stock: 500, step: 50, seller: 'Lagos Timber Co.', origin: 'NG', active: true },
  { id: 'p2', name: 'Crude Red Oil', kind: 'oil', bulk: '100,000L+', unit: 'L', price: 650, minQty: 100000, stock: 500000, step: 10000, seller: 'Delta Palm Ltd', origin: 'NG', active: true },
  { id: 'p3', name: 'Natural Rubber', kind: 'rubber', bulk: '50T+', unit: 'kg', price: 1200, minQty: 50000, stock: 400000, step: 5000, seller: 'Edo Rubber Estates', origin: 'NG', active: true },
  { id: 'p4', name: 'Charcoal', kind: 'charcoal', bulk: '100T+', unit: 'kg', price: 350, minQty: 100000, stock: 900000, step: 10000, seller: 'Kogi Charcoal Works', origin: 'NG', active: true },
  { id: 'p5', name: 'Cocoa Beans', kind: 'cocoa', bulk: '20T+', unit: 'kg', price: 2400, minQty: 20000, stock: 200000, step: 5000, seller: 'Ondo Cocoa Farms', origin: 'NG', active: true },
  { id: 'p6', name: 'Arabica Coffee', kind: 'coffee', bulk: '10T+', unit: 'kg', price: 3100, minQty: 10000, stock: 80000, step: 1000, seller: 'Plateau Coffee Co-op', origin: 'NG', active: true },
  { id: 'p7', name: 'White Maize', kind: 'grain', bulk: '50T+', unit: 'kg', price: 480, minQty: 50000, stock: 600000, step: 5000, seller: 'Kaduna Grains Ltd', origin: 'NG', active: true },
  { id: 'p8', name: 'Long-grain Rice', kind: 'grain', bulk: '25T+', unit: 'kg', price: 900, minQty: 25000, stock: 300000, step: 5000, seller: 'Kebbi Rice Mills', origin: 'NG', active: true },
  { id: 'p9', name: 'Palm Kernel Processing Machine', kind: 'machinery', bulk: '1 unit+', unit: 'pcs', price: 18500000, minQty: 1, stock: 12, step: 1, seller: 'AgroTech Machinery', origin: 'CN', active: true },
]

export const KIND_CHIPS: [string, string][] = [['All', ''], ['Timber', 'timber'], ['Red Oil', 'oil'], ['Rubber', 'rubber'], ['Charcoal', 'charcoal'], ['Cocoa', 'cocoa'], ['Coffee', 'coffee'], ['Grains', 'grain'], ['Machinery', 'machinery']]

export type DemoAgent = { id: string; name: string; location: string; rating: number; jobs: number; verified: boolean; fee: number; delivery: number }

export const DEMO_AGENTS: DemoAgent[] = [
  { id: 'a1', name: 'Chinedu Agent', location: 'Lagos, Nigeria', rating: 4.8, jobs: 120, verified: true, fee: 150000, delivery: 300000 },
  { id: 'a2', name: 'Amaka Okoro', location: 'Ibadan, Nigeria', rating: 4.6, jobs: 86, verified: true, fee: 120000, delivery: 280000 },
  { id: 'a3', name: 'Tunde Bello', location: 'Abuja, Nigeria', rating: 4.9, jobs: 203, verified: true, fee: 180000, delivery: 350000 },
]

export const DEMO_ORDER = { ref: '#SZF8723', productId: 'p1', qty: 500, agentId: 'a1' }

export function orderBreakdown(productId: string, qty: number, agentId: string | null) {
  const p = DEMO_PRODUCTS.find((x) => x.id === productId) ?? DEMO_PRODUCTS[0]
  const a = agentId ? DEMO_AGENTS.find((x) => x.id === agentId) : null
  return { product: p, agent: a, b: breakdown({ product: p.price * qty, agent: a?.fee ?? 0, delivery: a?.delivery ?? 0 }) }
}

type Tx = { id: string; title: string; amount: number; date: string; kind: string }
export const DEMO_TX: Record<string, Tx[]> = {
  buyer: [
    { id: 't1', title: 'Payment Released', amount: 2500000, date: 'Nov 17, 2026', kind: 'in' },
    { id: 't2', title: 'Deposit', amount: 1000000, date: 'Nov 15, 2026', kind: 'in' },
    { id: 't3', title: 'Commission', amount: 125000, date: 'Nov 14, 2026', kind: 'in' },
    { id: 't4', title: 'Escrow hold – Order #SZF8723', amount: -2500000, date: 'Nov 13, 2026', kind: 'hold' },
  ],
  seller: [
    { id: 't1', title: 'Payment Released – Order #SZF8650', amount: 2500000, date: 'Nov 17, 2026', kind: 'in' },
    { id: 't2', title: 'Withdrawal to bank', amount: -1000000, date: 'Nov 12, 2026', kind: 'out' },
    { id: 't3', title: 'Payment Released – Order #SZF8590', amount: 1700000, date: 'Nov 08, 2026', kind: 'in' },
  ],
  agent: [
    { id: 't1', title: 'Commission', amount: 50000, date: 'Nov 18, 2026', kind: 'in' },
    { id: 't2', title: 'Commission', amount: 50000, date: 'Nov 16, 2026', kind: 'in' },
    { id: 't3', title: 'Withdrawal to bank', amount: -100000, date: 'Nov 05, 2026', kind: 'out' },
  ],
}

type W = { available: number; pending: number; total: number; pendingLabel: string }
export const DEMO_WALLET: Record<string, W> = {
  buyer: { available: 850000, pending: 2500000, total: 1000000, pendingLabel: 'On hold (escrow)' },
  seller: { available: 3200000, pending: 125000000, total: 5400000, pendingLabel: 'Pending payments (escrow)' },
  agent: { available: 320000, pending: 100000, total: 420000, pendingLabel: 'Pending commissions' },
}

export const DEMO_NOTES = [
  { id: 'n1', text: 'Order #SZF8723 delivered', time: '2h ago', to: '/order/track' },
  { id: 'n2', text: 'Commission credited', time: '3h ago', to: '/wallet' },
  { id: 'n3', text: 'New product listed', time: '3h ago', to: '/marketplace' },
  { id: 'n4', text: 'Payment received', time: '3h ago', to: '/wallet' },
]

export type DemoTask = { id: string; product: string; qty: string; order: string; location: string; commission: number; status: 'available' | 'active' | 'delivery' | 'done'; seller: string; sellerPhone: string; buyer: string; buyerPhone: string; destination: string }

export const DEMO_TASKS: DemoTask[] = [
  { id: 'k1', product: 'Timber (Teak)', qty: '500 m³', order: '#SZF8723', location: 'Ikorodu, Lagos', commission: 450000, status: 'active', seller: 'Lagos Timber Co.', sellerPhone: '+2348000000001', buyer: 'Buyer John', buyerPhone: '+2348000000002', destination: 'Apapa Port, Lagos' },
  { id: 'k2', product: 'Crude Red Oil', qty: '100,000 L', order: '#SZF8720', location: 'Warri, Delta', commission: 280000, status: 'available', seller: 'Delta Palm Ltd', sellerPhone: '+2348000000003', buyer: 'Okafor Foods', buyerPhone: '+2348000000004', destination: 'Onitsha, Anambra' },
  { id: 'k3', product: 'Natural Rubber', qty: '50 T', order: '#SZF8712', location: 'Benin City, Edo', commission: 320000, status: 'available', seller: 'Edo Rubber Estates', sellerPhone: '+2348000000005', buyer: 'TyreWorks Ltd', buyerPhone: '+2348000000006', destination: 'Ikeja, Lagos' },
  { id: 'k4', product: 'Charcoal', qty: '100 T', order: '#SZF8690', location: 'Lokoja, Kogi', commission: 210000, status: 'delivery', seller: 'Kogi Charcoal Works', sellerPhone: '+2348000000007', buyer: 'GrillCo', buyerPhone: '+2348000000008', destination: 'Abuja' },
]
