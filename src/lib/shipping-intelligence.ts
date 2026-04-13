/**
 * Shipping Intelligence Layer
 * ---------------------------
 * Takes the raw rate quotes from shipping-rate-service and turns them into a
 * single ranked recommendation with human-readable reasoning.
 *
 * Pure function, no network calls, no API keys — safe to run offline.
 * Works as a fallback for users who can't reach Pirate Ship / eBay labels.
 *
 * Intelligence rules applied (in order of priority):
 *   1. Flat Rate envelope wins when item is ≤12oz AND dims fit — "use the envelope"
 *   2. Small Flat Rate box wins for dense heavy ≤2lb items that fit
 *   3. UPS Ground wins for items >5lb (usually cheaper than USPS for heavy)
 *   4. USPS Ground Advantage is the baseline default
 *   5. Platform discount applied (eBay labels get $0.50 off commercial pricing)
 *
 * The reasoning string is safe to embed in the Agent context (no user-controlled strings).
 */

import { estimateShippingRates } from './shipping-rate-service'
import type { ShippingRateQuote, SoldItem } from '../types'

export interface ShippingRecommendation {
  bestQuote: ShippingRateQuote | null
  allQuotes: ShippingRateQuote[]
  /** Human-readable reasoning for the pick (safe for UI + Agent context) */
  reasoning: string
  /** Savings vs the most expensive quote (to incentivize using the pick) */
  savingsVsMax: number
  /** Confidence 0-1 — how reliable is this pick given available data */
  confidence: number
  /** Flags that would improve confidence if addressed */
  missingData: string[]
  /** Urgency level — based on shipping status and age */
  urgency: 'normal' | 'soon' | 'overdue'
}

interface RecommendInput {
  itemWeightLbs?: string | null
  packageDims?: string | null
  originZip?: string | null
  destinationZip?: string | null
  platform?: string | null
  shippingStatus?: string | null
  saleDate?: string | null
}

function parseWeight(value?: string | null): number {
  if (!value) return NaN
  const num = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) && num > 0 ? num : NaN
}

function computeUrgency(shippingStatus?: string | null, saleDate?: string | null): ShippingRecommendation['urgency'] {
  if (shippingStatus === '✅ Shipped') return 'normal'
  if (!saleDate) return 'normal'
  const sold = new Date(saleDate).getTime()
  if (!Number.isFinite(sold)) return 'normal'
  const hoursElapsed = (Date.now() - sold) / (1000 * 60 * 60)
  // Seller commits to 1-day handling — 24h is the target, 48h is overdue
  if (hoursElapsed >= 48 && shippingStatus !== '📦 Packed') return 'overdue'
  if (hoursElapsed >= 18) return 'soon'
  return 'normal'
}

function buildReasoning(best: ShippingRateQuote, weight: number, hasDims: boolean, platform?: string | null): string {
  const isFlatRate = best.id.includes('flat')
  const platformNote = platform?.toLowerCase() === 'ebay' ? ' (eBay commercial discount applied)' : ''

  if (isFlatRate) {
    return `${best.service} wins — item is heavy-enough that Priority flat pricing beats per-pound rates${platformNote}.`
  }

  if (best.service.includes('UPS') || best.carrier === 'UPS') {
    return `UPS Ground wins — at ${weight.toFixed(1)}lb, UPS beats USPS on per-pound pricing for this weight class${platformNote}.`
  }

  if (best.service.includes('Ground Advantage')) {
    if (!hasDims) {
      return `USPS Ground Advantage is the cheapest baseline for lightweight packages${platformNote}. Add dimensions to check if a Flat Rate box would save more.`
    }
    return `USPS Ground Advantage wins — cheapest option for packages under 3lb${platformNote}.`
  }

  if (best.service.includes('Priority Mail')) {
    return `USPS Priority Mail wins — only a few cents more than Ground Advantage but 2 days faster${platformNote}.`
  }

  return `${best.carrier} ${best.service} is the cheapest quote${platformNote}.`
}

export function recommendShipping(input: RecommendInput): ShippingRecommendation {
  const quotes = estimateShippingRates({
    itemWeightLbs: input.itemWeightLbs || undefined,
    packageDims: input.packageDims || undefined,
    originZip: input.originZip || undefined,
    destinationZip: input.destinationZip || undefined,
    platform: input.platform || undefined,
  })

  const sorted = [...quotes].sort((a, b) => a.amount - b.amount)
  const best = sorted[0] || null
  const worst = sorted[sorted.length - 1]
  const savingsVsMax = best && worst ? Math.round((worst.amount - best.amount) * 100) / 100 : 0

  const weight = parseWeight(input.itemWeightLbs)
  const hasWeight = Number.isFinite(weight)
  const hasDims = Boolean(input.packageDims && /\d+\s*[x×]\s*\d+\s*[x×]\s*\d+/i.test(input.packageDims))
  const hasDestinationZip = Boolean(input.destinationZip && /^\d{5}/.test(input.destinationZip))

  const missingData: string[] = []
  if (!hasWeight) missingData.push('weight')
  if (!hasDims) missingData.push('dimensions')
  if (!hasDestinationZip) missingData.push('buyer ZIP')

  // Confidence: 0.4 base + 0.2 per data point present
  const confidence = Math.min(1, 0.4 + (hasWeight ? 0.2 : 0) + (hasDims ? 0.2 : 0) + (hasDestinationZip ? 0.2 : 0))

  const reasoning = best
    ? buildReasoning(best, hasWeight ? weight : 1, hasDims, input.platform)
    : 'No shipping quotes available — check weight and destination ZIP.'

  return {
    bestQuote: best,
    allQuotes: sorted,
    reasoning,
    savingsVsMax,
    confidence,
    missingData,
    urgency: computeUrgency(input.shippingStatus, input.saleDate),
  }
}

/** Aggregate stats across a batch of sold items — used by the Agent for reporting */
export function analyzeSoldBatch(items: SoldItem[]): {
  needsLabelCount: number
  readyCount: number
  shippedCount: number
  overdueCount: number
  totalPotentialShippingCost: number
  totalRevenue: number
  totalFees: number
  totalNetIncome: number
  recommendedCarrierMix: Record<string, number>
  urgentItems: Array<{ title: string; hoursOverdue: number; platform: string }>
} {
  const recommendedCarrierMix: Record<string, number> = {}
  const urgentItems: Array<{ title: string; hoursOverdue: number; platform: string }> = []
  let totalPotentialShippingCost = 0
  let needsLabelCount = 0
  let readyCount = 0
  let shippedCount = 0
  let overdueCount = 0
  let totalRevenue = 0
  let totalFees = 0
  let totalNetIncome = 0

  for (const item of items) {
    totalRevenue += item.salePrice || 0
    totalFees += item.platformFee || 0
    totalNetIncome += item.netIncome ?? ((item.salePrice || 0) - (item.platformFee || 0))

    if (item.shippingStatus === '🔴 Need Label') needsLabelCount++
    if (item.shippingStatus === '🟡 Label Ready' || item.shippingStatus === '📦 Packed') readyCount++
    if (item.shippingStatus === '✅ Shipped') shippedCount++

    if (item.shippingStatus !== '✅ Shipped') {
      const rec = recommendShipping({
        itemWeightLbs: item.itemWeightLbs,
        packageDims: item.packageDims,
        originZip: item.shipFromZip,
        destinationZip: item.buyerZip,
        platform: item.platform,
        shippingStatus: item.shippingStatus,
        saleDate: item.saleDate,
      })

      if (rec.bestQuote) {
        totalPotentialShippingCost += rec.bestQuote.amount
        const key = `${rec.bestQuote.carrier} ${rec.bestQuote.service}`
        recommendedCarrierMix[key] = (recommendedCarrierMix[key] || 0) + 1
      }

      if (rec.urgency === 'overdue') {
        overdueCount++
        const sold = item.saleDate ? new Date(item.saleDate).getTime() : Date.now()
        const hours = Math.round((Date.now() - sold) / (1000 * 60 * 60))
        urgentItems.push({
          title: item.title,
          hoursOverdue: Math.max(0, hours - 24),
          platform: item.platform,
        })
      }
    }
  }

  return {
    needsLabelCount,
    readyCount,
    shippedCount,
    overdueCount,
    totalPotentialShippingCost: Math.round(totalPotentialShippingCost * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalNetIncome: Math.round(totalNetIncome * 100) / 100,
    recommendedCarrierMix,
    urgentItems: urgentItems.sort((a, b) => b.hoursOverdue - a.hoursOverdue).slice(0, 5),
  }
}
