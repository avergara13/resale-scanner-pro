/**
 * Session archive — frozen per-session aggregates.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose (the two-tier metrics model):
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   • Tier 1 (hot) — raw ScannedItems in queue + scanHistory. Deleted when
 *     the owning session is deleted. Consumed by session-scoped surfaces
 *     (SessionDetail, SessionLiveBanner, AgentScreen).
 *
 *   • Tier 2 (cold) — this archive. One SessionArchive row per session,
 *     frozen at session-end or just-in-time before session-delete. Survives
 *     session deletion. Consumed by Performance Trends so time-series
 *     history is stable even after the user cleans up old sessions.
 *
 * Invariant — FREEZE BEFORE PURGE:
 *   Any code path that purges session items (handleDeleteSession's 60s
 *   hard-delete, handlePermanentDeleteSession) must call ensureArchived()
 *   first, so the archive row exists before the items it was computed
 *   from are gone.
 *
 * Active session:
 *   The currently-active session does NOT have a frozen row. Trends
 *   treats it as a live archive via buildLiveArchive() at read time.
 */
import { computeBuyMetrics } from '@/lib/use-buy-metrics'
import type { Session, ScannedItem, AppSettings, SessionArchive } from '@/types'

export const ARCHIVE_KV_KEY = 'session-archives'

/**
 * Compute a SessionArchive row from a session and its items.
 * Pure — no I/O. Safe to call in any context.
 */
export function computeArchive(
  session: Session,
  items: ScannedItem[],
  settings?: AppSettings,
): SessionArchive {
  const metrics = computeBuyMetrics(items, settings)
  return {
    schemaVersion: 1,
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    sessionName: session.name,
    sessionType: session.sessionType,
    operatorId: session.operatorId,
    storeName: session.location?.name,
    startTime: session.startTime,
    endTime: session.endTime,
    itemsScanned: items.length,
    buyCount: metrics.buyCount,
    passCount: metrics.passCount,
    maybeCount: metrics.maybeCount,
    totalInvested: metrics.totalInvested,
    totalRevenue: metrics.totalRevenue,
    estimatedProfit: metrics.estimatedProfit,
    avgROI: metrics.avgROI,
    buyRate: metrics.buyRate,
  }
}

/**
 * Upsert an archive row into the store. Keyed by sessionId — re-freezing
 * the same session overwrites the prior row (end → reopen → end-again).
 */
export function upsertArchive(
  prev: SessionArchive[] | undefined,
  archive: SessionArchive,
): SessionArchive[] {
  const existing = prev || []
  const idx = existing.findIndex(a => a.sessionId === archive.sessionId)
  if (idx === -1) return [...existing, archive]
  const next = [...existing]
  next[idx] = archive
  return next
}

/**
 * Freeze-before-purge helper. Returns the archive array with a row for
 * the given session, computing one if it didn't already exist.
 *
 * Call this BEFORE removing a session's items from queue/scanHistory,
 * otherwise the archive computation would see an empty item list and
 * freeze zeros. Idempotent — calling it twice is safe.
 */
export function ensureArchived(
  prev: SessionArchive[] | undefined,
  session: Session,
  items: ScannedItem[],
  settings?: AppSettings,
): SessionArchive[] {
  return upsertArchive(prev, computeArchive(session, items, settings))
}

/**
 * Synthesize an archive row for the currently-active session so it
 * shows up alongside frozen rows in Trends. Not persisted.
 */
export function buildLiveArchive(
  session: Session,
  items: ScannedItem[],
  settings?: AppSettings,
): SessionArchive {
  return computeArchive(session, items, settings)
}
