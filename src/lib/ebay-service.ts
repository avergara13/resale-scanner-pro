import { logDebug } from '@/lib/debug-log'
import { computeMarketStats, type SampleQuality } from '@/lib/market-stats'
import { retryOperation, NetworkError } from '@/lib/retry-service'
import { getRetryOptions } from '@/lib/retry-config'

const SOLD_COMPS_LIMIT = 100
const BROWSE_LIMIT = 50

// Module-level snapshot of the ebay-search retry config so both fetchers
// share a single source of truth — prevents drift if retry-config edits
// `retryableStatuses` or `timeout` later. The Set + timeout below derive
// from this snapshot and stay aligned with whatever retry-config says.
const EBAY_SEARCH_RETRY_OPTIONS = getRetryOptions('ebay-search')

// Statuses worth retrying — derived from retry-config so it can't drift.
// 4xx-other (400 bad query, 401 auth, 403 scope-missing, 404, 422) are
// intentionally NOT retried because retrying won't change the outcome and
// just burns rate-limit headroom. The fallback list mirrors
// DEFAULT_RETRYABLE_STATUSES in retry-service when the config omits it.
const RETRYABLE_EBAY_STATUSES = new Set<number>(
  EBAY_SEARCH_RETRY_OPTIONS.retryableStatuses ?? [408, 429, 500, 502, 503, 504]
)

// Per-attempt timeout in ms. retryOperation does NOT enforce timeout itself
// (only retryFetch does); without this guard, a stalled fetch could hang
// the entire retry loop indefinitely. We enforce it via AbortController on
// each attempt so the configured timeout in retry-config is the actual
// per-attempt budget.
const EBAY_SEARCH_TIMEOUT_MS = EBAY_SEARCH_RETRY_OPTIONS.timeout ?? 30_000

function isRetryableEbayStatus(status: number): boolean {
  return RETRYABLE_EBAY_STATUSES.has(status)
}

/**
 * Fetch with a per-attempt AbortController bounded by `EBAY_SEARCH_TIMEOUT_MS`.
 * On timeout we throw a NetworkError with status 408 — which is in the
 * retryable set — so retryOperation backs off and retries instead of
 * propagating the abort up. Used by both fetchers below.
 */
async function fetchWithTimeout(input: RequestInfo, init: RequestInit, label: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), EBAY_SEARCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkError(`eBay ${label} timed out after ${EBAY_SEARCH_TIMEOUT_MS}ms`, 408, 'Request Timeout')
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

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
  /**
   * 10th / 90th percentile of the trimmed sold set. `undefined` when the
   * trimmed sample was thin (<5 points) — see market-stats.ts header.
   */
  p10?: number
  p90?: number
  /** Per-source truncation so UIs only mark `+` on the metric that was capped. */
  soldPageLimited: boolean
  activePageLimited: boolean
  /** Derived: `soldPageLimited || activePageLimited`. Legacy convenience. */
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
        soldPageLimited: stats.soldPageLimited,
        activePageLimited: stats.activePageLimited,
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
      // Wrap the actual fetch in retryOperation so transient eBay issues
      // (429 rate-limit, 503 transient, network blip) are retried per the
      // ebay-search config (5 attempts, 1s→20s exponential backoff). Each
      // attempt is timeout-bounded via fetchWithTimeout — without that,
      // retryOperation alone wouldn't enforce timeout and a stalled fetch
      // could hang the whole retry loop indefinitely.
      // Throw NetworkError ONLY on retryable statuses — 403 (insights scope
      // missing), 401 (auth), 400 (bad query) are non-retryable; surface
      // them as `null` from the inner op so the outer catch returns empty
      // without burning retries.
      const data = await retryOperation(async () => {
        const resp = await fetchWithTimeout('/api/ebay/sold-comps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: keywords, categoryId, limit: SOLD_COMPS_LIMIT, daysBack: 90 }),
        }, 'sold-comps')
        if (resp.ok) {
          return await resp.json() as {
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
        }
        if (isRetryableEbayStatus(resp.status)) {
          // Retryable — let retryOperation's NetworkError handling kick in.
          throw new NetworkError(`eBay sold-comps ${resp.status}`, resp.status, resp.statusText)
        }
        // Non-retryable — log + signal "no data, but don't retry" via null.
        logDebug('eBay sold-comps non-retryable status — falling back', 'warn', 'ebay', { status: resp.status })
        return null
      }, EBAY_SEARCH_RETRY_OPTIONS)
      const rawItems = data && Array.isArray(data.items) ? data.items : []
      const items = rawItems.map(it => ({
        title: it.title,
        price: it.price,
        soldDate: it.soldDate || '',
        condition: it.condition || 'Unknown',
        itemId: it.itemId || '',
        itemWebUrl: it.itemWebUrl || '',
        thumbnail: it.thumbnail || '',
      }))
      return { items, pageLimited: items.length >= SOLD_COMPS_LIMIT }
    } catch (error) {
      // After all retries exhausted (or on a hard network failure) — fall
      // back to empty so searchCompletedListings can still return a result
      // from Browse-API. searchCompletedListings's contract: never throw.
      logDebug('eBay sold-comps unreachable after retries — using Browse approximation', 'warn', 'ebay', { message: (error as Error).message })
      return { items: [], pageLimited: false }
    }
  }

  private async fetchViaBrowseProxy(keywords: string, categoryId?: string) {
    try {
      // Same retry contract as fetchSoldComps — transient statuses retry,
      // non-retryable statuses surface as null and skip retries. Per-attempt
      // timeout bounded by fetchWithTimeout (see comment in fetchSoldComps).
      const data = await retryOperation(async () => {
        const resp = await fetchWithTimeout('/api/ebay/market-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: keywords, categoryId, limit: BROWSE_LIMIT }),
        }, 'Browse')
        if (resp.ok) {
          return await resp.json() as {
            items?: Array<{
              title: string
              price: number
              condition: string
              itemId?: string
              itemWebUrl?: string
              thumbnail?: string
            }>
          }
        }
        if (isRetryableEbayStatus(resp.status)) {
          throw new NetworkError(`eBay Browse ${resp.status}`, resp.status, resp.statusText)
        }
        logDebug('eBay Browse proxy non-retryable status — falling back', 'warn', 'ebay', { status: resp.status })
        return null
      }, EBAY_SEARCH_RETRY_OPTIONS)
      const items = data && Array.isArray(data.items) ? data.items : []
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
      // After retry exhaustion — fall back to empty. Gemini chain in App.tsx
      // takes over from here when both eBay sources have nothing usable.
      logDebug('eBay Browse proxy unreachable after retries — falling back to Gemini market data', 'warn', 'ebay', { message: (error as Error).message })
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
