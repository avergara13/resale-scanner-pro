interface EbayFindingApiResponse {
  // Completed items (findCompletedItems)
  findCompletedItemsResponse?: Array<{
    searchResult?: Array<{
      item?: Array<{
        title?: string[]
        sellingStatus?: Array<{
          currentPrice?: Array<{ __value__: string }>
          sellingState?: string[]
        }>
        condition?: Array<{ conditionDisplayName?: string[] }>
        listingInfo?: Array<{ endTime?: string[] }>
      }>
      '@count': string
    }>
  }>
  // Active listings (findItemsByKeywords) — DIFFERENT key, same structure
  findItemsByKeywordsResponse?: Array<{
    searchResult?: Array<{
      item?: Array<{
        title?: string[]
        sellingStatus?: Array<{
          currentPrice?: Array<{ __value__: string }>
        }>
      }>
      '@count': string
    }>
  }>
}

interface EbayShoppingApiResponse {
  Item?: Array<{
    Title?: string
    CurrentPrice?: {
      Value: number
    }
    QuantityAvailable?: number
  }>
  Items?: Array<{
    Title?: string
    CurrentPrice?: {
      Value: number
    }
    QuantityAvailable?: number
  }>
}

export interface EbayMarketData {
  soldItems: Array<{
    title: string
    price: number
    soldDate: string
    condition: string
  }>
  activeListings: Array<{
    title: string
    price: number
    quantity: number
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
  private oauthToken?: string

  constructor(appId: string, devId?: string, certId?: string, oauthToken?: string) {
    this.appId = appId
    this.devId = devId
    this.certId = certId
    this.oauthToken = oauthToken
  }

  async searchCompletedListings(keywords: string, categoryId?: string): Promise<EbayMarketData> {
    try {
      const soldItems = await this.fetchCompletedItems(keywords, categoryId)
      const activeListings = await this.fetchActiveListings(keywords, categoryId)

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
      console.error('eBay market data fetch failed:', error)
      throw error
    }
  }

  private async fetchCompletedItems(keywords: string, categoryId?: string) {
    const encodedKeywords = encodeURIComponent(keywords)
    const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1'
    
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': this.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '100',
      'sortOrder': 'EndTimeSoonest',
    })

    params.append('itemFilter(0).name', 'SoldItemsOnly')
    params.append('itemFilter(0).value', 'true')
    // Include all resale-relevant conditions:
    // 1000=New, 1500=New(other), 2500=Seller refurbished,
    // 3000=Used, 4000=Very Good, 5000=Good, 6000=Acceptable
    params.append('itemFilter(1).name', 'Condition')
    params.append('itemFilter(1).value(0)', '1000')
    params.append('itemFilter(1).value(1)', '1500')
    params.append('itemFilter(1).value(2)', '2500')
    params.append('itemFilter(1).value(3)', '3000')
    params.append('itemFilter(1).value(4)', '4000')
    params.append('itemFilter(1).value(5)', '5000')
    params.append('itemFilter(1).value(6)', '6000')

    if (categoryId) {
      params.append('categoryId', categoryId)
    }

    const url = `${baseUrl}?${params.toString()}`

    let response: Response
    try {
      response = await fetch(url)
    } catch (corsError) {
      // eBay CORS block — Finding API occasionally rejects browser requests
      // Return empty array — caller falls back to Gemini grounded data
      console.warn('eBay Finding API blocked (CORS). Using Gemini market data instead.')
      return []
    }

    if (!response.ok) {
      console.warn(`eBay API returned ${response.status} — using Gemini market data`)
      return []
    }

    const data: EbayFindingApiResponse = await response.json()

    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

    return items.map(item => ({
      title: item.title?.[0] || '',
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
      soldDate: item.listingInfo?.[0]?.endTime?.[0] || '',
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown',
    }))
  }

  private async fetchActiveListings(keywords: string, categoryId?: string) {
    const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1'
    
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findItemsByKeywords',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': this.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '100',
      'sortOrder': 'PricePlusShippingLowest',
    })

    params.append('itemFilter(0).name', 'ListingType')
    params.append('itemFilter(0).value(0)', 'FixedPrice')
    params.append('itemFilter(0).value(1)', 'AuctionWithBIN')
    // Same condition set as sold comps — apples-to-apples comparison
    params.append('itemFilter(1).name', 'Condition')
    params.append('itemFilter(1).value(0)', '1000')
    params.append('itemFilter(1).value(1)', '1500')
    params.append('itemFilter(1).value(2)', '2500')
    params.append('itemFilter(1).value(3)', '3000')
    params.append('itemFilter(1).value(4)', '4000')
    params.append('itemFilter(1).value(5)', '5000')
    params.append('itemFilter(1).value(6)', '6000')

    if (categoryId) {
      params.append('categoryId', categoryId)
    }

    const url = `${baseUrl}?${params.toString()}`

    let response: Response
    try {
      response = await fetch(url)
    } catch (corsError) {
      // eBay CORS block — Finding API occasionally rejects browser requests
      // Return empty array — caller falls back to Gemini grounded data
      console.warn('eBay Finding API blocked (CORS). Using Gemini market data instead.')
      return []
    }

    if (!response.ok) {
      console.warn(`eBay API returned ${response.status} — using Gemini market data`)
      return []
    }

    // CRITICAL: active listings use findItemsByKeywordsResponse, NOT findCompletedItemsResponse
    const data: EbayFindingApiResponse = await response.json()
    const items = data.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || []

    return items.map(item => ({
      title: item.title?.[0] || '',
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
      quantity: 1,
    }))
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
    paypalFeePercent: number = 0,        // Deprecated — eBay uses Managed Payments. Keep param for backward compat.
    perOrderFee: number = 0.30           // eBay fixed per-order fee
  ) {
    const ebayFee = recommendedSellPrice * (ebayFeePercent / 100)
    const paymentFee = recommendedSellPrice * (paypalFeePercent / 100)  // 0 by default
    const totalFees = ebayFee + paymentFee + perOrderFee
    const netProfit = recommendedSellPrice - purchasePrice - shippingCost - totalFees
    const profitMargin = recommendedSellPrice > 0
      ? (netProfit / recommendedSellPrice) * 100
      : 0
    const roi = purchasePrice > 0
      ? (netProfit / purchasePrice) * 100
      : 0

    // Break-even: minimum sell price to cover all costs with $0 profit
    // Solve: breakEven - purchasePrice - shippingCost - (breakEven * feeRate) - perOrderFee = 0
    const feeRate = (ebayFeePercent + paypalFeePercent) / 100
    const breakEven = feeRate < 1
      ? (purchasePrice + shippingCost + perOrderFee) / (1 - feeRate)
      : 0

    return {
      netProfit,
      profitMargin,
      roi,
      totalFees,
      ebayFee,
      paypalFee: paymentFee,
      perOrderFee,
      breakEven,
      recommendedSellPrice,
      // Legacy alias kept for any code that still references grossProfit
      grossProfit: recommendedSellPrice - purchasePrice - shippingCost,
    }
  }
}

export function createEbayService(
  appId?: string,
  devId?: string,
  certId?: string,
  oauthToken?: string
): EbayService | null {
  if (!appId) {
    return null
  }
  return new EbayService(appId, devId, certId, oauthToken)
}
