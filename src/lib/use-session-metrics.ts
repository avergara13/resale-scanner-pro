import { useMemo } from 'react'
import type { ScannedItem, AppSettings } from '@/types'
import { getEstimatedNetProfit } from '@/lib/profit-utils'

export interface SessionMetrics {
  buyItems: ScannedItem[]
  buyCount: number
  passCount: number
  maybeCount: number
  totalDecisioned: number
  /** BUY items as % of decisioned (BUY+PASS+MAYBE). PENDING excluded. */
  buyRate: number
  totalInvested: number
  totalRevenue: number
  estimatedProfit: number
  /** Fee-adjusted ROI %. 0 when no investment — check hasROI before rendering. */
  avgROI: number
  /** False when buyCount === 0. Callers should render "—" instead of "+0%". */
  hasROI: boolean
  bestFind: ScannedItem | null
}

/**
 * Plain function — call anywhere including map() callbacks (SessionScreen).
 * All metric logic lives here; nothing is duplicated in the screens.
 */
export function computeSessionMetrics(items: ScannedItem[], settings?: AppSettings): SessionMetrics {
  const buyItems = items.filter(i => i.decision === 'BUY')
  const passCount = items.filter(i => i.decision === 'PASS').length
  const maybeCount = items.filter(i => i.decision === 'MAYBE').length
  const totalDecisioned = buyItems.length + passCount + maybeCount
  const buyRate = totalDecisioned > 0 ? Math.round((buyItems.length / totalDecisioned) * 100) : 0
  const totalInvested = buyItems.reduce((s, i) => s + i.purchasePrice, 0)
  const totalRevenue = buyItems.reduce((s, i) => s + (i.estimatedSellPrice || 0), 0)
  const estimatedProfit = buyItems.reduce((s, i) => s + getEstimatedNetProfit(i, settings).netProfit, 0)
  const avgROI = totalInvested > 0 ? Math.round((estimatedProfit / totalInvested) * 100) : 0
  const bestFind = buyItems.length > 0
    ? buyItems.reduce((best, i) => (i.profitMargin || 0) > (best.profitMargin || 0) ? i : best)
    : null

  return {
    buyItems,
    buyCount: buyItems.length,
    passCount,
    maybeCount,
    totalDecisioned,
    buyRate,
    totalInvested,
    totalRevenue,
    estimatedProfit,
    avgROI,
    hasROI: buyItems.length > 0,
    bestFind,
  }
}

/**
 * Hook wrapper — memoises computeSessionMetrics for stable item lists.
 * Use in SessionDetailScreen and CostTrackingScreen.
 * Use computeSessionMetrics directly in map() callbacks (SessionScreen).
 */
export function useSessionMetrics(items: ScannedItem[], settings?: AppSettings): SessionMetrics {
  return useMemo(() => computeSessionMetrics(items, settings), [items, settings])
}
