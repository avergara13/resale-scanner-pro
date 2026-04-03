interface EbayFindingApiResponse {
  findCompletedItemsResponse?: Array<{
    searchResult?: Array<{
      item?: Array<{
        title?: string[]
        sellingStatus?: Array<{
          currentPrice?: Array<{
            __value__: string
          }>
          sellingState?: string[]
        }>
        condition?: Array<{
          conditionDisplayName?: string[]
        }>
        listingInfo?: Array<{
          endTime?: string[]
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

      const sortedPrices = [...soldPrices].sort((a, b) => a - b)
      const medianSoldPrice = sortedPrices.length > 0
        ? sortedPrices[Math.floor(sortedPrices.length / 2)]
        : 0

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
    params.append('itemFilter(1).name', 'Condition')
    params.append('itemFilter(1).value(0)', '1000')
    params.append('itemFilter(1).value(1)', '3000')

    if (categoryId) {
      params.append('categoryId', categoryId)
    }

    const url = `${baseUrl}?${params.toString()}`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status}`)
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
    params.append('itemFilter(1).name', 'Condition')
    params.append('itemFilter(1).value(0)', '1000')
    params.append('itemFilter(1).value(1)', '3000')

    if (categoryId) {
      params.append('categoryId', categoryId)
    }

    const url = `${baseUrl}?${params.toString()}`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status}`)
    }

    const data: EbayFindingApiResponse = await response.json()

    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

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

  calculateProfitMetrics(
    purchasePrice: number,
    recommendedSellPrice: number,
    shippingCost: number = 5.0,
    ebayFeePercent: number = 12.9,
    paypalFeePercent: number = 3.49
  ) {
    const grossProfit = recommendedSellPrice - purchasePrice - shippingCost
    const ebayFee = recommendedSellPrice * (ebayFeePercent / 100)
    const paypalFee = recommendedSellPrice * (paypalFeePercent / 100)
    const totalFees = ebayFee + paypalFee
    const netProfit = grossProfit - totalFees
    const profitMargin = (netProfit / recommendedSellPrice) * 100
    const roi = (netProfit / purchasePrice) * 100

    return {
      grossProfit,
      netProfit,
      profitMargin,
      roi,
      totalFees,
      ebayFee,
      paypalFee,
      recommendedSellPrice,
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
