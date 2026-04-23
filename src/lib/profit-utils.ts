import { calculateProfitFallback } from './ebay-service'
import type { ScannedItem, AppSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-sale profit projection — fee-aware per-platform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-platform fee math for pre-sale profit projections.
 *
 * FORMULA (applied identically on every platform):
 *
 *   netProfit = sellPrice
 *             − (sellPrice × feeRate)            // commission + payment-processing %
 *             − perOrderFee                       // flat fixed-dollar fee per transaction
 *             − (sellerPaysShipping ? shippingCost : 0)
 *             − (sellerPaysMaterials ? materialsCost : 0)
 *             − purchasePrice                     // COGS
 *
 * Fee defaults below track published US seller schedules (early 2026). The
 * `editable` flag marks which values are user-tunable via AppSettings — the
 * rest are platform policy constants (per-order fees, flat <$15 Poshmark
 * commission, etc.) and should not be surfaced as settings.
 *
 *   eBay:      12.9% FVF + 3% Ad fee + $0.30 per-order                (editable: FVF%, Ad%)
 *   Mercari:   10% marketplace + 2.9% payment processing = 12.9%,
 *              plus $0.50 per-order payment fee                        (editable: combined %)
 *   Poshmark:  <$15 → flat $2.95; ≥$15 → 20% commission; Poshmark
 *              provides shipping label (seller ships $0 but still
 *              pays for packaging materials)                           (editable: ≥$15 %)
 *   Whatnot:   8% commission + 2.9% payment processing = 10.9%         (editable: combined %)
 *   StockX:    9% transaction + 3% payment = 12% (Level 1 seller);
 *              StockX issues prepaid authentication label (seller
 *              ships $0 but pays for packaging materials)              (editable: combined %)
 *   Facebook:  5% selling fee; local pickup, no shipping, no packaging (editable: none)
 *
 * Shipping-cost sourcing:
 *   For ship-it-yourself platforms (eBay, Mercari, Whatnot) the seller buys the
 *   label through the platform's integrated USPS partnership — that's what
 *   `settings.defaultShippingCost` represents. Override per-item with
 *   `item.optimizedListing.shippingCost` when we have a specific quote.
 *   Poshmark and StockX provide a prepaid label, so seller shipping = $0.
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
  mercari:  { feePercent: 12.9, perOrderFee: 0.50, adFeePercent: 0,    sellerPaysShipping: true,  sellerPaysMaterials: true  },
  poshmark: { feePercent: 20.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: false, sellerPaysMaterials: true  },
  whatnot:  { feePercent: 10.9, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: true,  sellerPaysMaterials: true  },
  stockx:   { feePercent: 12.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: false, sellerPaysMaterials: true  },
  facebook: { feePercent:  5.0, perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: false, sellerPaysMaterials: false },
  // "other" = local cash, peer-to-peer, consignment, etc. No marketplace commission;
  // seller still pays shipping + materials if the sale required shipping the item.
  other:    { feePercent: 0,    perOrderFee: 0,    adFeePercent: 0,    sellerPaysShipping: true,  sellerPaysMaterials: true  },
}

/** Platform policy constants — NOT user-editable, encoded per-platform. */
const POSHMARK_FLAT_FEE_UNDER_15 = 2.95   // Poshmark charges a flat $2.95 on sales under $15
const POSHMARK_FLAT_THRESHOLD    = 15     // Cutoff where Poshmark switches from flat fee to commission %

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

  // Look up the platform's policy row (shipping/materials/per-order rules).
  // User-editable percentages come from AppSettings and override the default in the schedule.
  const rates = PLATFORM_FEE_SCHEDULES[platform] ?? PLATFORM_FEE_SCHEDULES['ebay']

  if (platform === 'ebay') {
    feePercent   = settings?.ebayFeePercent   ?? rates.feePercent
    adFeePercent = settings?.ebayAdFeePercent ?? rates.adFeePercent
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'mercari') {
    feePercent   = settings?.mercariFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'poshmark') {
    // Poshmark: flat fee below threshold, commission % above. <$15 flat is a platform
    // policy constant (Poshmark decides it, not the seller), so it's not in settings.
    if (sellPrice < POSHMARK_FLAT_THRESHOLD) {
      feePercent  = 0
      perOrderFee = POSHMARK_FLAT_FEE_UNDER_15
    } else {
      feePercent  = settings?.poshmarkFeePercent ?? rates.feePercent
      perOrderFee = 0
    }
    adFeePercent = 0
  } else if (platform === 'whatnot') {
    feePercent   = settings?.whatnotFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'stockx') {
    feePercent   = settings?.stockxFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else {
    // facebook or any future platform — fall back to schedule defaults.
    feePercent   = rates.feePercent
    adFeePercent = rates.adFeePercent
    perOrderFee  = rates.perOrderFee
  }

  const shippingCost = rates.sellerPaysShipping
    ? (item.optimizedListing?.shippingCost ?? settings?.defaultShippingCost ?? 5.0)
    : 0
  const materialsCost = rates.sellerPaysMaterials
    ? (settings?.shippingMaterialsCost ?? 0.75)
    : 0

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

/**
 * Post-sale net profit. Uses `item.soldOn` to pick the fee schedule, mirroring
 * `getEstimatedNetProfit`'s pre-sale math so BUY-time projections and post-sale
 * actuals use identical formulas. Platforms that provide prepaid labels
 * (Poshmark, StockX) zero out `shippingCost` regardless of `actualShippingCost`
 * because the seller didn't pay that cost.
 */
export function getNetProfit(
  item: ScannedItem,
  settings: AppSettings
): { netProfit: number; totalFees: number; shippingCost: number } {
  const soldPrice = item.soldPrice || 0
  const platform = (item.soldOn || 'ebay').toLowerCase()
  const rates = PLATFORM_FEE_SCHEDULES[platform] ?? PLATFORM_FEE_SCHEDULES['ebay']

  let feePercent: number
  let perOrderFee: number
  let adFeePercent: number

  if (platform === 'ebay') {
    feePercent   = settings.ebayFeePercent   ?? rates.feePercent
    adFeePercent = settings.ebayAdFeePercent ?? rates.adFeePercent
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'mercari') {
    feePercent   = settings.mercariFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'poshmark') {
    if (soldPrice > 0 && soldPrice < POSHMARK_FLAT_THRESHOLD) {
      feePercent  = 0
      perOrderFee = POSHMARK_FLAT_FEE_UNDER_15
    } else {
      feePercent  = settings.poshmarkFeePercent ?? rates.feePercent
      perOrderFee = 0
    }
    adFeePercent = 0
  } else if (platform === 'whatnot') {
    feePercent   = settings.whatnotFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else if (platform === 'stockx') {
    feePercent   = settings.stockxFeePercent ?? rates.feePercent
    adFeePercent = 0
    perOrderFee  = rates.perOrderFee
  } else {
    // facebook, other, or an unrecognized platform → use that platform's schedule
    // verbatim. For "other" (local cash, consignment, etc.) that's 0% fees —
    // do NOT fall back to eBay rates when the soldOn value is unknown.
    feePercent   = rates.feePercent
    adFeePercent = rates.adFeePercent
    perOrderFee  = rates.perOrderFee
  }

  const shippingCost = rates.sellerPaysShipping
    ? (item.actualShippingCost ?? settings.defaultShippingCost ?? 5.0)
    : 0
  const materialsCost = rates.sellerPaysMaterials
    ? (settings.shippingMaterialsCost ?? 0.75)
    : 0

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
