// Structured fee maths, ready to be replaced by values returned from the backend.
// The platform percentage is configurable (admin setting in production).
const envPct = Number((import.meta as any).env?.VITE_PLATFORM_FEE_PCT)
export const PLATFORM_FEE_PCT = Number.isFinite(envPct) && envPct > 0 ? envPct : 2.5
export const MIN_WITHDRAWAL = 10000

const r2 = (n: number) => Math.round(n * 100) / 100

export type Breakdown = {
  product: number
  agent: number
  delivery: number
  platform: number
  total: number
  pct: number
  // Who receives what once escrow is released
  sellerPayout: number
  agentPayout: number
  platformPayout: number
}

export function breakdown(input: { product: number; agent: number; delivery: number; pct?: number }): Breakdown {
  const pct = input.pct ?? PLATFORM_FEE_PCT
  const platform = r2((input.product * pct) / 100)
  return {
    product: input.product,
    agent: input.agent,
    delivery: input.delivery,
    platform,
    pct,
    total: r2(input.product + input.agent + input.delivery + platform),
    sellerPayout: input.product,
    agentPayout: r2(input.agent + input.delivery),
    platformPayout: platform,
  }
}

export const ngn = (n: number) => '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 2 })
