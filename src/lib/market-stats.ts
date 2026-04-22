// Market-data statistics: outlier trimming + percentile bands.
//
// Raw eBay aggregations (mean / min / max over 50–100 sold+active listings)
// are dominated by outliers. A single $675 listing on a $13-median product
// pushes the mean to $118 and the price-range "High" to $675, which destroys
// trust in every downstream chip and in the AI prompt.
//
// This module is pure — no network, no side effects — so callers (ebay-service,
// Gemini fallback, future tests) all agree on what "the market says" means.
//
// The rule: 3 × MAD (median absolute deviation). Standard robust-statistics
// default. Survives heavy-tailed distributions better than IQR and doesn't
// over-trim thin samples. Skipped when soldPrices.length < 5 because MAD is
// unstable on small N.

export type SampleQuality = 'thin' | 'skewed' | 'ok'

export interface MarketStats {
  /** Trimmed mean — outliers removed before averaging. */
  averageSoldPrice: number
  /** Median of the trimmed sold set. The most trustworthy "typical" price. */
  medianSoldPrice: number
  /**
   * 10th / 90th percentile of the trimmed sold set. `undefined` when the
   * trimmed sample is thin (<5 points) — on tiny samples linear-interpolation
   * pulls extremes inward and hides real spread exactly when uncertainty is
   * highest. Consumers must gate band-preferred UI on the typeof check.
   */
  p10?: number
  p90?: number
  /** Literal min/max of the trimmed sold set — for compat with existing UI. */
  priceRange: { min: number; max: number }
  soldCount: number
  activeCount: number
  /** Kept sold-count after MAD trim. `soldCount - trimmedSoldCount` = dropped. */
  trimmedSoldCount: number
  sellThroughRate: number
  /**
   * Per-source truncation flags. Tracked separately so the UI can render `+`
   * only on the metric that was actually capped — collapsing both into one
   * boolean misleads users when (say) sold=100+ but active=15 is the true total.
   */
  soldPageLimited: boolean
  activePageLimited: boolean
  /** Derived convenience: `soldPageLimited || activePageLimited`. */
  pageLimited: boolean
  /**
   * - `thin`  = fewer than 5 trimmed sold points → no MAD applied, low confidence
   * - `skewed` = |mean − median| / median > 0.25 after trim → still wide; UI should warn
   * - `ok`    = clean, trust the median
   */
  sampleQuality: SampleQuality
  /** Median-preferred. Used for the green "Recommended Price" chip downstream. */
  recommendedPrice: number
  /** Unfiltered sold prices — kept so charts / debug views can show the full spread. */
  rawSoldPrices: number[]
}

const MAD_MULTIPLIER = 3 // see module header

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median absolute deviation — robust spread estimator. */
export function mad(values: number[]): number {
  if (values.length === 0) return 0
  const med = median(values)
  const deviations = values.map(v => Math.abs(v - med))
  return median(deviations)
}

/**
 * Linear-interpolation percentile (same method as NumPy's default).
 * `p` is in [0, 1]. Returns 0 on an empty array.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  const sorted = [...values].sort((a, b) => a - b)
  const rank = p * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  const frac = rank - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

/**
 * Drop points > MAD_MULTIPLIER × MAD away from the median. When MAD is zero
 * (all values identical), returns the input unchanged — there are no outliers
 * to trim, and dividing would introduce NaN.
 */
export function trimOutliers(values: number[]): number[] {
  if (values.length < 5) return [...values]
  const med = median(values)
  const m = mad(values)
  if (m === 0) return [...values]
  const threshold = MAD_MULTIPLIER * m
  return values.filter(v => Math.abs(v - med) <= threshold)
}

export interface ComputeMarketStatsInput {
  soldPrices: number[]
  activePrices: number[]
  /** True if the sold-comps fetch returned its full page limit. */
  soldPageLimited?: boolean
  /** True if the active fetch returned its full page limit. */
  activePageLimited?: boolean
}

export function computeMarketStats(input: ComputeMarketStatsInput): MarketStats {
  const rawSoldPrices = input.soldPrices.filter(p => p > 0)
  const activePrices = input.activePrices.filter(p => p > 0)

  const trimmed = trimOutliers(rawSoldPrices)
  const trimmedSoldCount = trimmed.length

  const averageSoldPrice = trimmed.length > 0
    ? trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length
    : 0

  const medianSoldPrice = median(trimmed)
  // Withhold p10/p90 when the sample is too thin to percentile-rank
  // meaningfully. With N<5 the linear interpolation pulls extremes inward —
  // two comps get averaged into a band that looks tighter than reality
  // exactly when uncertainty is highest. Consumers already fall back to
  // priceRange.min/max in this case.
  const hasBand = trimmed.length >= 5
  const p10 = hasBand ? percentile(trimmed, 0.10) : undefined
  const p90 = hasBand ? percentile(trimmed, 0.90) : undefined

  const priceRange = trimmed.length > 0
    ? { min: Math.min(...trimmed), max: Math.max(...trimmed) }
    : { min: 0, max: 0 }

  const soldCount = rawSoldPrices.length
  const activeCount = activePrices.length
  const sellThroughRate = (soldCount + activeCount) > 0
    ? (soldCount / (soldCount + activeCount)) * 100
    : 0

  const soldPageLimited = Boolean(input.soldPageLimited)
  const activePageLimited = Boolean(input.activePageLimited)
  const pageLimited = soldPageLimited || activePageLimited

  let sampleQuality: SampleQuality = 'ok'
  if (trimmed.length < 5) {
    sampleQuality = 'thin'
  } else if (medianSoldPrice > 0) {
    const skew = Math.abs(averageSoldPrice - medianSoldPrice) / medianSoldPrice
    if (skew > 0.25) sampleQuality = 'skewed'
  }

  const recommendedPrice = medianSoldPrice > 0 ? medianSoldPrice : averageSoldPrice

  return {
    averageSoldPrice,
    medianSoldPrice,
    p10,
    p90,
    priceRange,
    soldCount,
    activeCount,
    trimmedSoldCount,
    sellThroughRate,
    soldPageLimited,
    activePageLimited,
    pageLimited,
    sampleQuality,
    recommendedPrice,
    rawSoldPrices,
  }
}
