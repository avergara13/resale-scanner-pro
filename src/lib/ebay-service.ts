import { logDebug } from '@/lib/debug-log'
import { computeMarketStats, type SampleQuality } from '@/lib/market-stats'

const SOLD_COMPS_LIMIT = 100
const BROWSE_LIMIT = 50

export interface EbayMarketData {
  soldItems: Array<{
    title: string
    price: number
    soldDate: string
    condition: string
    itemId?: string
    itemWebUrl?: string
    thumbnail?: string
  }>
  activeListings: Array<{
    title: string
    price: number
    quantity: number
    itemId?: string
    itemWebUrl?: string
    thumbnail?: string
  }>
  averageSoldPrice: number
  medianSoldPrice: number
  soldCount: number
  activeCount: number
  /** Kept sold-count after outlier trim. `soldCount - trimmedSoldCount` were dropped. */
  trimmedSoldCount: number
  sellThroughRate: number
  /** Min/max of the *trimmed* sold set — was literal min/max of raw sold+active. */
  priceRange: {
    min: number
    max: number
  }
  /** 10th / 90th percentile of the trimmed sold set. Use for range chips. */
  p10: number
  p90: number
  /** True if either source hit its page limit — displayed counts are a floor. */
  pageLimited: boolean
  sampleQuality: SampleQuality
  recommendedPrice: number
}

export class EbayService {
  private appId: string
  private devId?: string
  private certId?: string

  constructor(appId: string, devId?: string, certId?: string) {
    this.appId = appId
    this.devId = devId
    this.certId = certId
  }

  async searchCompletedListings(keywords: string, categoryId?: string): Promise<EbayMarketData> {
    try {
      // Two-source market data:
      //   soldItems     ← Marketplace Insights (real 90-day sold prices)
      //   activeListings ← Browse API (current competing listings)
      // Both run in parallel. If Insights fails (e.g. scope not granted on
      // the server), we fall back to the Browse-approximation that Branch B
      // shipped so the pipeline never hard-fails on market data.
      const [sold, browse] = await Promise.all([
        this.fetchSoldComps(keywords, categoryId),
        this.fetchViaBrowseProxy(keywords, categoryId),
      ])
      const soldItems = sold.items.length > 0 ? sold.items : browse.soldItems
      const activeListings = browse.activeListings

      const soldPrices = soldItems.map(item => item.price).filter(p => p > 0)
      const activePrices = activeListings.map(item => item.price).filter(p => p > 0)

      // Aggregation is centralised in market-stats.ts so every caller gets
      // the same trimmed-mean/median/p10/p90 contract. See that module's
      // header for the outlier rule (3 × MAD) and edge cases.
      const stats = computeMarketStats({
        soldPrices,
        activePrices,
        soldPageLimited: sold.pageLimited,
        activePageLimited: browse.pageLimited,
      })

      return {
        soldItems,
        activeListings,
        averageSoldPrice: stats.averageSoldPrice,
        medianSoldPrice: stats.medianSoldPrice,
        soldCount: stats.soldCount,
        activeCount: stats.activeCount,
        trimmedSoldCount: stats.trimmedSoldCount,
        sellThroughRate: stats.sellThroughRate,
        priceRange: stats.priceRange,
        p10: stats.p10,
        p90: stats.p90,
        pageLimited: stats.pageLimited,
        sampleQuality: stats.sampleQuality,
        recommendedPrice: stats.recommendedPrice,
      }
    } catch (error) {
      logDebug('eBay market data fetch failed', 'error', 'ebay', { message: (error as Error).message })
      throw error
    }
  }

  private async fetchSoldComps(
    keywords: string,
    categoryId?: string,
  ): Promise<{ items: EbayMarketData['soldItems']; pageLimited: boolean }> {
    try {
      const resp = await fetch('/api/ebay/sold-comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keywords, categoryId, limit: SOLD_COMPS_LIMIT, daysBack: 90 }),
      })
      if (!resp.ok) {
        logDebug('eBay sold-comps non-200 — using Browse approximation', 'warn', 'ebay', { status: resp.status })
        return { items: [], pageLimited: false }
      }
      const data = await resp.json() as {
        items?: Array<{
          title: string
          price: number
          soldDate: string
          condition: string
          itemId?: string
          itemWebUrl?: string
          thumbnail?: string
        }>
      }
      const items = Array.isArray(data.items)
        ? data.items.map(it => ({
            title: it.title,
            price: it.price,
            soldDate: it.soldDate || '',
            condition: it.condition || 'Unknown',
            itemId: it.itemId || '',
            itemWebUrl: it.itemWebUrl || '',
            thumbnail: it.thumbnail || '',
          }))
        : []
      return { items, pageLimited: items.length >= SOLD_COMPS_LIMIT }
    } catch (error) {
      logDebug('eBay sold-comps unreachable — using Browse approximation', 'warn', 'ebay', { message: (error as Error).message })
      return { items: [], pageLimited: false }
    }
  }

  private async fetchViaBrowseProxy(keywords: string, categoryId?: string) {
    try {
      const resp = await fetch('/api/ebay/market-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keywords, categoryId, limit: BROWSE_LIMIT }),
      })
      if (!resp.ok) {
        logDebug('eBay Browse proxy non-200 — falling back to Gemini market data', 'warn', 'ebay', { status: resp.status })
        return { soldItems: [], activeListings: [], pageLimited: false }
      }
      const data = await resp.json() as {
        items?: Array<{
          title: string
          price: number
          condition: string
          itemId?: string
          itemWebUrl?: string
          thumbnail?: string
        }>
      }
      const items = Array.isArray(data.items) ? data.items : []
      const listings = items.map(it => ({
        title: it.title,
        price: it.price,
        quantity: 1,
        itemId: it.itemId || '',
        itemWebUrl: it.itemWebUrl || '',
        thumbnail: it.thumbnail || '',
      }))
      // Marketplace Insights is the source of sold comps now. This proxy
      // only returns active listings; if Insights is unavailable the caller
      // falls back to this active list as a sold-approximation (see
      // searchCompletedListings). The approximation path is kept to ensure
      // the scan pipeline never hard-fails when Insights is degraded.
      const soldItems = items.map(it => ({
        title: it.title,
        price: it.price,
        soldDate: '',
        condition: it.condition || 'Unknown',
        itemId: it.itemId || '',
        itemWebUrl: it.itemWebUrl || '',
        thumbnail: it.thumbnail || '',
      }))
      return {
        soldItems,
        activeListings: listings,
        pageLimited: items.length >= BROWSE_LIMIT,
      }
    } catch (error) {
      logDebug('eBay Browse proxy unreachable — falling back to Gemini market data', 'warn', 'ebay', { message: (error as Error).message })
      return { soldItems: [], activeListings: [], pageLimited: false }
    }
  }

  async getCategoryId(productName: string): Promise<string | undefined> {
    const categoryMap: Record<string, string> = {
      'clothing': '11450',
      'shoes': '63889',
      'electronics': '293',
      'books': '267',
      'jewelry': '281',
      'toys': '220',
      'home': '11700',
      'collectibles': '1',
      'sports': '888',
      'automotive': '6000',
      'vintage': '20081',
      'leather': '11450',
      'jacket': '57988',
      'furniture': '3197',
    }

    const lowerName = productName.toLowerCase()
    for (const [keyword, categoryId] of Object.entries(categoryMap)) {
      if (lowerName.includes(keyword)) {
        return categoryId
      }
    }

    return undefined
  }

  /**
   * Calculate resale profit metrics using eBay Managed Payments fee structure.
   *
   * Fee model (eBay US 2024):
   *   - Final value fee:       ebayFeePercent % of sale price (default 12.9%)
   *   - Payment processing:    included in eBay Managed Payments (no separate PayPal fee)
   *   - Per-order fee:         $0.30 fixed per transaction
   *   - Shipping:              seller-absorbs model (free shipping to buyer)
   *
   * Category-specific rates (override ebayFeePercent as needed):
   *   - Clothing/Shoes:        8%
   *   - Books/Music/Movies:    14.95%
   *   - Most categories:       12.9%
   *
   * Break-even = minimum price at which you make $0 profit.
   * ROI        = net profit as % of your purchase price (money you put in).
   * Margin     = net profit as % of sale price (what the buyer paid).
   */
  calculateProfitMetrics(
    purchasePrice: number,
    recommendedSellPrice: number,
    shippingCost: number = 5.0,
    ebayFeePercent: number = 12.9,
    paypalFeePercent: number = 0,        // Deprecated — always 0. Kept for backward compat.
    perOrderFee: number = 0.30,          // eBay fixed per-order fee
    adFeePercent: number = 3.0,          // eBay Promoted Listings ad fee (3% default)
    materialsCost: number = 0.75         // Shipping materials (box, tape, poly mailer)
  ) {
    const ebayFee = recommendedSellPrice * (ebayFeePercent / 100)
    const adFee = recommendedSellPrice * (adFeePercent / 100)
    const totalFees = ebayFee + adFee + perOrderFee
    const totalCosts = purchasePrice + shippingCost + materialsCost + totalFees
    const netProfit = recommendedSellPrice - totalCosts
    const profitMargin = recommendedSellPrice > 0
      ? (netProfit / recommendedSellPrice) * 100
      : 0
    const roi = purchasePrice > 0
      ? (netProfit / purchasePrice) * 100
      : 0

    // Break-even: minimum sell price to cover all costs with $0 profit
    // Solve: breakEven - purchasePrice - shippingCost - materialsCost - (breakEven * feeRate) - perOrderFee = 0
    const feeRate = (ebayFeePercent + adFeePercent) / 100
    const breakEven = feeRate < 1
      ? (purchasePrice + shippingCost + materialsCost + perOrderFee) / (1 - feeRate)
      : 0

    return {
      netProfit,
      profitMargin,
      roi,
      totalFees,
      ebayFee,
      adFee,
      paypalFee: 0,
      perOrderFee,
      materialsCost,
      breakEven,
      recommendedSellPrice,
      // Legacy alias kept for any code that still references grossProfit
      grossProfit: recommendedSellPrice - purchasePrice - shippingCost - materialsCost,
    }
  }
}

/**
 * Standalone profit calculation for when EbayService is not available (no API key).
 * Applies the same fee math as EbayService.calculateProfitMetrics so that
 * fallback profit margins are accurate — not inflated.
 */
export function calculateProfitFallback(
  purchasePrice: number,
  sellPrice: number,
  shippingCost: number = 5.0,
  ebayFeePercent: number = 12.9,
  perOrderFee: number = 0.30,
  adFeePercent: number = 3.0,
  materialsCost: number = 0.75
) {
  const ebayFee = sellPrice * (ebayFeePercent / 100)
  const adFee = sellPrice * (adFeePercent / 100)
  const totalFees = ebayFee + adFee + perOrderFee
  const netProfit = sellPrice - purchasePrice - shippingCost - materialsCost - totalFees
  const profitMargin = sellPrice > 0 ? (netProfit / sellPrice) * 100 : 0
  const roi = purchasePrice > 0 ? (netProfit / purchasePrice) * 100 : 0
  return { netProfit, profitMargin, roi, totalFees }
}

export function createEbayService(
  appId?: string,
  devId?: string,
  certId?: string
): EbayService | null {
  if (!appId) {
    return null
  }
  return new EbayService(appId, devId, certId)
}
