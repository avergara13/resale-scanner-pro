import { logDebug } from '@/lib/debug-log'

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
  sellThroughRate: number
  priceRange: {
    min: number
    max: number
  }
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
      const soldItems = sold.length > 0 ? sold : browse.soldItems
      const activeListings = browse.activeListings

      const soldPrices = soldItems.map(item => item.price).filter(p => p > 0)
      const activePrices = activeListings.map(item => item.price).filter(p => p > 0)

      const averageSoldPrice = soldPrices.length > 0
        ? soldPrices.reduce((sum, price) => sum + price, 0) / soldPrices.length
        : 0

      // Correct median: average the two middle values for even-length arrays
      const sortedPrices = [...soldPrices].sort((a, b) => a - b)
      const mid = Math.floor(sortedPrices.length / 2)
      const medianSoldPrice = sortedPrices.length === 0
        ? 0
        : sortedPrices.length % 2 === 1
          ? sortedPrices[mid]
          : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2

      const soldCount = soldItems.length
      const activeCount = activeListings.length
      const sellThroughRate = (soldCount + activeCount) > 0
        ? (soldCount / (soldCount + activeCount)) * 100
        : 0

      const allPrices = [...soldPrices, ...activePrices]
      const priceRange = {
        min: allPrices.length > 0 ? Math.min(...allPrices) : 0,
        max: allPrices.length > 0 ? Math.max(...allPrices) : 0,
      }

      const recommendedPrice = medianSoldPrice > 0 ? medianSoldPrice : averageSoldPrice

      return {
        soldItems,
        activeListings,
        averageSoldPrice,
        medianSoldPrice,
        soldCount,
        activeCount,
        sellThroughRate,
        priceRange,
        recommendedPrice,
      }
    } catch (error) {
      logDebug('eBay market data fetch failed', 'error', 'ebay', { message: (error as Error).message })
      throw error
    }
  }

  private async fetchSoldComps(
    keywords: string,
    categoryId?: string,
  ): Promise<EbayMarketData['soldItems']> {
    try {
      const resp = await fetch('/api/ebay/sold-comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keywords, categoryId, limit: 100, daysBack: 90 }),
      })
      if (!resp.ok) {
        logDebug('eBay sold-comps non-200 — using Browse approximation', 'warn', 'ebay', { status: resp.status })
        return []
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
      return Array.isArray(data.items)
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
    } catch (error) {
      logDebug('eBay sold-comps unreachable — using Browse approximation', 'warn', 'ebay', { message: (error as Error).message })
      return []
    }
  }

  private async fetchViaBrowseProxy(keywords: string, categoryId?: string) {
    try {
      const resp = await fetch('/api/ebay/market-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keywords, categoryId, limit: 50 }),
      })
      if (!resp.ok) {
        logDebug('eBay Browse proxy non-200 — falling back to Gemini market data', 'warn', 'ebay', { status: resp.status })
        return { soldItems: [], activeListings: [] }
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
      return { soldItems, activeListings: listings }
    } catch (error) {
      logDebug('eBay Browse proxy unreachable — falling back to Gemini market data', 'warn', 'ebay', { message: (error as Error).message })
      return { soldItems: [], activeListings: [] }
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
