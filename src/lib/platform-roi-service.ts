export interface PlatformROIResult {
  platform: 'eBay' | 'Mercari' | 'Poshmark' | 'Whatnot'
  netProfit: number
  profitMargin: number  // percentage
  roi: number           // percentage
  fee: number           // total fees paid
  recommended: boolean  // true = highest net profit of the four
}

/**
 * Calculate net profit, margin, and ROI for Mercari, Poshmark, and Whatnot.
 * eBay is calculated separately in the main pipeline (ebayService.calculateProfitMetrics).
 * Facebook Marketplace is intentionally excluded (local-only, separate n8n pipeline).
 */
export function calculatePlatformROI(
  purchasePrice: number,
  sellPrice: number,
  shippingCost: number,
  _shippingMaterials: number,  // reserved for future use
  _ebayFeePercent: number,     // reserved — eBay handled separately
  _ebayAdFeePercent: number    // reserved — eBay handled separately
): PlatformROIResult[] {
  if (sellPrice <= 0 || purchasePrice < 0) return []

  const results: PlatformROIResult[] = []

  // ── Mercari ──────────────────────────────────────────────────────────────
  // 10% selling fee + $0.30 payment processing + seller-paid shipping
  const mercariNet = sellPrice - (sellPrice * 0.10) - 0.30 - shippingCost - purchasePrice
  results.push({
    platform: 'Mercari',
    netProfit: mercariNet,
    profitMargin: (mercariNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (mercariNet / purchasePrice) * 100 : 0,
    fee: (sellPrice * 0.10) + 0.30,
    recommended: false,
  })

  // ── Poshmark ─────────────────────────────────────────────────────────────
  // Under $15: flat $2.95 fee, Poshmark provides shipping label (no shipping cost to seller)
  // $15+: 20% of sale price, Poshmark provides shipping label
  const poshFee = sellPrice < 15 ? 2.95 : sellPrice * 0.20
  const poshNet = sellPrice - poshFee - purchasePrice
  results.push({
    platform: 'Poshmark',
    netProfit: poshNet,
    profitMargin: (poshNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (poshNet / purchasePrice) * 100 : 0,
    fee: poshFee,
    recommended: false,
  })

  // ── Whatnot ──────────────────────────────────────────────────────────────
  // 8% commission + 3% payment processing = 11% total + seller-paid shipping
  const whatnotNet = sellPrice - (sellPrice * 0.11) - shippingCost - purchasePrice
  results.push({
    platform: 'Whatnot',
    netProfit: whatnotNet,
    profitMargin: (whatnotNet / sellPrice) * 100,
    roi: purchasePrice > 0 ? (whatnotNet / purchasePrice) * 100 : 0,
    fee: sellPrice * 0.11,
    recommended: false,
  })

  // Mark highest net profit as recommended
  const best = results.reduce((a, b) => a.netProfit > b.netProfit ? a : b)
  best.recommended = true

  return results
}
