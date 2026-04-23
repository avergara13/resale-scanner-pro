export interface PlatformROIResult {
  platform: 'eBay' | 'Mercari' | 'Poshmark' | 'Whatnot' | 'StockX'
  netProfit: number
  profitMargin: number  // percentage
  roi: number           // percentage
  fee: number           // total fees paid (commission% + per-order)
  recommended: boolean  // true = highest net profit of the set
}

/**
 * Compare net profit / margin / ROI across resale platforms other than eBay.
 * eBay is calculated separately in the main pipeline (ebayService.calculateProfitMetrics).
 * Facebook Marketplace is intentionally excluded (local-only, separate n8n pipeline).
 *
 * Fee rates are user-configurable through AppSettings → Business Rules and passed in here.
 * Per-order / flat platform-policy fees (Mercari $0.50, Poshmark <$15 flat $2.95) are
 * platform constants and encoded inline.
 *
 * Formula (identical per platform):
 *   netProfit = sellPrice
 *             − (sellPrice × feeRate/100)
 *             − perOrderFee
 *             − (sellerPaysShipping ? shippingCost : 0)
 *             − shippingMaterials              // applies to every non-local platform
 *             − purchasePrice
 *
 * Shipping model: seller buys the label through the platform's integrated USPS
 * partnership (what `shippingCost` represents) on ship-it-yourself platforms.
 * Poshmark and StockX provide a prepaid label — seller shipping = $0, but the
 * seller still boxes and tapes the item, so materials applies everywhere here.
 */
export function calculatePlatformROI(
  purchasePrice: number,
  sellPrice: number,
  shippingCost: number,
  shippingMaterials: number,   // seller's per-item packaging overhead (applies on every platform)
  _ebayFeePercent: number,     // reserved — eBay handled separately in main pipeline
  _ebayAdFeePercent: number,   // reserved — eBay handled separately in main pipeline
  mercariFeePercent: number  = 12.9,  // 10% marketplace + 2.9% payment processing
  poshmarkFeePercent: number = 20.0,  // ≥$15 commission rate
  whatnotFeePercent: number  = 10.9,  // 8% commission + 2.9% payment processing
  stockxFeePercent: number   = 12.0,  // 9% transaction + 3% payment (Level 1 seller)
): PlatformROIResult[] {
  if (sellPrice <= 0 || purchasePrice < 0) return []

  const results: PlatformROIResult[] = []

  // ── Mercari ──────────────────────────────────────────────────────────────
  // Combined fee %  + $0.50 fixed payment processing fee + seller-paid shipping + materials.
  const MERCARI_PER_ORDER = 0.50
  const mercariFee = sellPrice * (mercariFeePercent / 100) + MERCARI_PER_ORDER
  const mercariNet = sellPrice - mercariFee - shippingCost - shippingMaterials - purchasePrice
  results.push({
    platform: 'Mercari',
    netProfit: mercariNet,
    profitMargin: (mercariNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (mercariNet / purchasePrice) * 100 : 0,
    fee: mercariFee,
    recommended: false,
  })

  // ── Poshmark ─────────────────────────────────────────────────────────────
  // Under $15 → flat $2.95 (policy constant). ≥$15 → commission %. Shipping label provided
  // (seller ships $0) but seller still pays for the packaging materials they ship in.
  const POSHMARK_FLAT_UNDER_15 = 2.95
  const poshFee = sellPrice < 15
    ? POSHMARK_FLAT_UNDER_15
    : sellPrice * (poshmarkFeePercent / 100)
  const poshNet = sellPrice - poshFee - shippingMaterials - purchasePrice
  results.push({
    platform: 'Poshmark',
    netProfit: poshNet,
    profitMargin: (poshNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (poshNet / purchasePrice) * 100 : 0,
    fee: poshFee,
    recommended: false,
  })

  // ── Whatnot ──────────────────────────────────────────────────────────────
  // Combined fee % (commission + payment processing), seller-paid shipping + materials.
  const whatnotFee = sellPrice * (whatnotFeePercent / 100)
  const whatnotNet = sellPrice - whatnotFee - shippingCost - shippingMaterials - purchasePrice
  results.push({
    platform: 'Whatnot',
    netProfit: whatnotNet,
    profitMargin: (whatnotNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (whatnotNet / purchasePrice) * 100 : 0,
    fee: whatnotFee,
    recommended: false,
  })

  // ── StockX ───────────────────────────────────────────────────────────────
  // Combined fee % (transaction + payment). StockX supplies the prepaid authentication
  // shipping label, so seller-shipping cost is $0, but the seller still pays for the
  // packaging materials (box, tape, poly mailer) they ship to StockX in.
  const stockxFee = sellPrice * (stockxFeePercent / 100)
  const stockxNet = sellPrice - stockxFee - shippingMaterials - purchasePrice
  results.push({
    platform: 'StockX',
    netProfit: stockxNet,
    profitMargin: (stockxNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (stockxNet / purchasePrice) * 100 : 0,
    fee: stockxFee,
    recommended: false,
  })

  // Mark highest net profit as recommended
  const best = results.reduce((a, b) => a.netProfit > b.netProfit ? a : b)
  best.recommended = true

  return results
}
