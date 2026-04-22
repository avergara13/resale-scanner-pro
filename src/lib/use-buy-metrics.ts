/**
 * Single source of truth for BUY-item financial metrics.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE CONTRACT — read this before changing where these metrics render.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two surfaces render these numbers. They use the SAME math at DIFFERENT scopes:
 *
 *   • Session Dashboard (SessionDetailScreen, SessionScreen cards)
 *       scope    = one session, all time
 *       input    = getSessionItems(queue, scanHistory, sessionId)
 *       purpose  = "How did this specific thrifting trip perform?"
 *
 *   • Cost Tracking (CostTrackingScreen)
 *       scope    = a time period (today / week / month / all), optionally
 *                  narrowed to one session
 *       input    = getPeriodItems(queue, scanHistory, cutoff, sessionId?)
 *       purpose  = "How am I performing over time?" (history tracker)
 *
 * Both feed their scoped item list into useBuyMetrics / computeBuyMetrics.
 * Math lives HERE ONLY — do not duplicate reduce/filter logic in screens.
 *
 * ROI formula: fee-adjusted net profit ÷ invested capital × 100.
 * BUY rate formula: BUY count ÷ (BUY + PASS + MAYBE). PENDING excluded.
 */
import { useMemo } from 'react'
import type { ScannedItem, AppSettings } from '@/types'
import { getEstimatedNetProfit } from '@/lib/profit-utils'
import { dedupById } from '@/lib/item-dedup'

export interface BuyMetrics {
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
 * All metric math lives here; nothing is duplicated in the screens.
 */
export function computeBuyMetrics(items: ScannedItem[], settings?: AppSettings): BuyMetrics {
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
 * Hook wrapper — memoises computeBuyMetrics for stable item lists.
 * Use in components that render once per commit (SessionDetailScreen, CostTrackingScreen).
 * Use computeBuyMetrics directly inside map() callbacks (SessionScreen) where hook rules forbid it.
 */
export function useBuyMetrics(items: ScannedItem[], settings?: AppSettings): BuyMetrics {
  return useMemo(() => computeBuyMetrics(items, settings), [items, settings])
}

// ── Scope helpers ────────────────────────────────────────────────────────────
// These pick the right item slice for each surface. Always go through these
// instead of doing inline [...queue, ...scanHistory] + dedup in the screens.

/**
 * Session Dashboard scope: all items belonging to a single session, all time.
 * Used by SessionDetailScreen and SessionScreen's per-session cards.
 *
 * Filter by sessionId BEFORE dedup: `dedupById` keeps first occurrence, so if an
 * ID ever collided across sessions (defensive — IDs should be globally unique)
 * the cross-session dupe would steal the slot and under-report this session.
 */
export function getSessionItems(
  queue: ScannedItem[] | undefined,
  scanHistory: ScannedItem[] | undefined,
  sessionId: string,
): ScannedItem[] {
  const scoped = [...(queue || []), ...(scanHistory || [])].filter(i => i.sessionId === sessionId)
  return dedupById(scoped).sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Cost Tracking scope: items within a time cutoff, optionally narrowed to one session.
 * Used by CostTrackingScreen. Pass cutoff = 0 for "All Time".
 *
 * Filter before dedup for the same reason as getSessionItems.
 */
export function getPeriodItems(
  queue: ScannedItem[] | undefined,
  scanHistory: ScannedItem[] | undefined,
  cutoff: number,
  sessionId?: string,
): ScannedItem[] {
  const scoped = [...(queue || []), ...(scanHistory || [])].filter(i => {
    if (sessionId && i.sessionId !== sessionId) return false
    return i.timestamp >= cutoff
  })
  return dedupById(scoped)
}
