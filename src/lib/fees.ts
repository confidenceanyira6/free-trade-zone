// Fee maths. The server is the source of truth for every amount; this file only mirrors the
// agreed formulas so the screens can show a breakdown before and after the server responds.
const envPct = Number((import.meta as any).env?.VITE_PLATFORM_FEE_PCT)
export const PLATFORM_FEE_PCT = Number.isFinite(envPct) && envPct > 0 ? envPct : 2.5
export const MIN_WITHDRAWAL = 10000

const r2 = (n: number) => Math.round(n * 100) / 100

export type Escrow = {
  goods: number
  delivery: number
  agentFee: number
  /** What the buyer funds: goods + delivery allocation + agreed agent fee. */
  buyerTotal: number
  platformFee: number
  pct: number
  /** Goods + delivery allocation, less the platform fee. Credited to the seller on release. */
  sellerNet: number
  /** Reserved separately so the seller's payment can never consume it. */
  agentPayout: number
}

export function escrowBreakdown(i: { goods: number; delivery: number; agentFee: number; pct?: number }): Escrow {
  const pct = i.pct ?? PLATFORM_FEE_PCT
  const sellerGross = i.goods + i.delivery
  const platformFee = r2((sellerGross * pct) / 100)
  return {
    goods: i.goods, delivery: i.delivery, agentFee: i.agentFee, pct, platformFee,
    buyerTotal: r2(sellerGross + i.agentFee),
    sellerNet: r2(sellerGross - platformFee),
    agentPayout: i.agentFee,
  }
}

// Legacy helper kept so existing demo data keeps compiling.
export type Breakdown = {
  product: number; agent: number; delivery: number; platform: number; total: number; pct: number
  sellerPayout: number; agentPayout: number; platformPayout: number
}
export function breakdown(input: { product: number; agent: number; delivery: number; pct?: number }): Breakdown {
  const pct = input.pct ?? PLATFORM_FEE_PCT
  const platform = r2((input.product * pct) / 100)
  return {
    product: input.product, agent: input.agent, delivery: input.delivery, platform, pct,
    total: r2(input.product + input.agent + input.delivery + platform),
    sellerPayout: input.product, agentPayout: r2(input.agent + input.delivery), platformPayout: platform,
  }
}

export const ngn = (n: number) => '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })
