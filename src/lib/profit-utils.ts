import { calculateProfitFallback } from './ebay-service'
import type { ScannedItem, AppSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-sale profit projection — fee-aware per-platform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fee schedules for pre-sale profit projections.
 * Rates are kept in sync with calculatePlatformROI() in platform-roi-service.ts.
 *
 * eBay:      12.9% FVF + $0.30 per-order + 3% ad/promoted listings fee (all configurable via AppSettings)
 * Mercari:   10% selling fee + $0.30 payment processing; seller pays shipping
 * Poshmark:  <$15 → $2.95 flat; ≥$15 → 20%; Poshmark provides shipping label (no shipping cost)
 * Whatnot:   8% commission + 3% payment = 11% total; seller pays shipping
 * Facebook:  5% selling fee; typically local pickup (no shipping cost)
 */
interface PlatformFeeSchedule {
  feePercent: number
  perOrderFee: number
  adFeePercent: number
  sellerPaysShipping: boolean
  sellerPaysMaterials: boolean
}

const PLATFORM_FEE_SCHEDULES: Record<string, PlatformFeeSchedule> = {
  ebay:     { feePercent: 12.9, perOrderFee: 0.30, adFeePercent: 3.0,  sellerPaysShipping: true,  sellerPaysMaterials: true  },
  mercari:  { feePercent: 10.0, perOrderFee: 0.30, adFeePercent: 0,    sellerPaysShipping: true,  sellerPaysMaterials: true  },
  poshmark: { feePercent: 20.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: false, sellerPaysMaterials: false },
  whatnot:  { feePercent: 11.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: true,  sellerPaysMaterials: true  },
  facebook: { feePercent:  5.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: false, sellerPaysMaterials: false },
}

/**
 * Project net profit for an item before it's sold.
 * Uses estimatedSellPrice + platform-appropriate fee schedule.
 * eBay rates are configurable via AppSettings; all other platforms use fixed industry rates.
 */
export function getEstimatedNetProfit(
  item: ScannedItem,
  settings?: Partial<AppSettings>
): { netProfit: number; totalFees: number; shippingCost: number; grossRevenue: number } {
  const sellPrice = item.estimatedSellPrice || 0
  const platform = (item.preferredPlatform || 'ebay').toLowerCase()

  let feePercent: number
  let perOrderFee: number
  let adFeePercent: number
  let shippingCost: number
  let materialsCost: number

  if (platform === 'ebay') {
    // eBay: all four rates are user-configurable via Business Rules settings
    feePercent    = settings?.ebayFeePercent    ?? 12.9
    perOrderFee   = 0.30
    adFeePercent  = settings?.ebayAdFeePercent  ?? 3.0
    shippingCost  = item.optimizedListing?.shippingCost ?? settings?.defaultShippingCost ?? 5.0
    materialsCost = settings?.shippingMaterialsCost ?? 0.75
  } else if (platform === 'poshmark') {
    // Poshmark provides the shipping label — no shipping or materials cost to seller
    feePercent    = sellPrice < 15 ? 0 : 20.0
    perOrderFee   = sellPrice < 15 ? 2.95 : 0
    adFeePercent  = 0
    shippingCost  = 0
    materialsCost = 0
  } else if (platform === 'facebook') {
    // Facebook Marketplace — typically local pickup, no shipping
    feePercent    = 5.0
    perOrderFee   = 0
    adFeePercent  = 0
    shippingCost  = 0
    materialsCost = 0
  } else {
    // Mercari, Whatnot, or unknown platform
    const rates = PLATFORM_FEE_SCHEDULES[platform] ?? PLATFORM_FEE_SCHEDULES['ebay']
    feePercent    = rates.feePercent
    perOrderFee   = rates.perOrderFee
    adFeePercent  = rates.adFeePercent
    shippingCost  = rates.sellerPaysShipping
      ? (item.optimizedListing?.shippingCost ?? settings?.defaultShippingCost ?? 5.0)
      : 0
    materialsCost = rates.sellerPaysMaterials
      ? (settings?.shippingMaterialsCost ?? 0.75)
      : 0
  }

  const { netProfit, totalFees } = calculateProfitFallback(
    item.purchasePrice,
    sellPrice,
    shippingCost,
    feePercent,
    perOrderFee,
    adFeePercent,
    materialsCost,
  )
  return { netProfit, totalFees, shippingCost, grossRevenue: sellPrice }
}

// ─────────────────────────────────────────────────────────────────────────────

export function getNetProfit(
  item: ScannedItem,
  settings: AppSettings
): { netProfit: number; totalFees: number; shippingCost: number } {
  const soldPrice = item.soldPrice || 0
  const shippingCost = item.actualShippingCost ?? settings.defaultShippingCost ?? 5.0

  // Only eBay has configured fees; other marketplaces default to 0% for now
  const feePercent = item.soldOn === 'ebay' ? (settings.ebayFeePercent ?? 12.9) : 0
  const perOrderFee = item.soldOn === 'ebay' ? 0.30 : 0
  const adFeePercent = item.soldOn === 'ebay' ? (settings.ebayAdFeePercent ?? 3.0) : 0
  const materialsCost = settings.shippingMaterialsCost ?? 0.75

  const { netProfit, totalFees } = calculateProfitFallback(
    item.purchasePrice,
    soldPrice,
    shippingCost,
    feePercent,
    perOrderFee,
    adFeePercent,
    materialsCost,
  )
  return { netProfit, totalFees, shippingCost }
}

export type UrgencyLevel = 'ok' | 'warning' | 'urgent' | 'overdue'

export function getShippingUrgency(soldDate?: number): {
  level: UrgencyLevel
  label: string
} {
  if (!soldDate) return { level: 'ok', label: '' }

  const hoursElapsed = (Date.now() - soldDate) / (1000 * 60 * 60)

  if (hoursElapsed > 24) {
    return { level: 'overdue', label: `LATE ${Math.round(hoursElapsed - 24)}h` }
  }
  if (hoursElapsed > 12) {
    return { level: 'urgent', label: 'OVERDUE — Ship NOW' }
  }
  if (hoursElapsed > 4) {
    return { level: 'warning', label: 'Ship today!' }
  }
  return { level: 'ok', label: `Sold ${Math.max(1, Math.round(hoursElapsed))}h ago` }
}
