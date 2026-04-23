import { Play, ChartLine, Trophy, MapPin, CaretDown, CaretUp, Trash, TrendUp, ArrowLeft, ListMagnifyingGlass } from '@phosphor-icons/react'
import { useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { computeBuyMetrics } from '@/lib/use-buy-metrics'
import { dedupById } from '@/lib/item-dedup'
import { buildLiveArchive } from '@/lib/session-archive'
import { TrendVisualization } from '../TrendVisualization'
import { ProfitGoalManager } from '../ProfitGoalManager'
import { GoalAchievementTracker } from '../GoalAchievementTracker'
import { LocationInsights } from '../LocationInsights'
import { useKV } from '@github/spark/hooks'
import { useDeviceId } from '@/hooks/use-device-id'
import type { Session, ScannedItem, ProfitGoal, Screen, AppSettings, SessionArchive } from '@/types'

function PastSessionCard({
  session, items, buyCount, passCount, totalProfit, roi, bestFind, bestFindNetProfit, duration, buyRate, listedCount, formatDuration, onDelete, onViewDetail, onOpenItem, onNavigateTo, isCurrentSession = false
}: {
  session: Session
  items: ScannedItem[]
  buyCount: number
  passCount: number
  totalProfit: number
  roi: number
  bestFind: ScannedItem | null
  bestFindNetProfit: number
  duration: number
  buyRate: number
  listedCount: number
  formatDuration: (ms: number) => string
  onDelete: () => void
  onViewDetail: () => void
  onOpenItem?: (item: ScannedItem) => void
  onNavigateTo?: (screen: Screen) => void
  isCurrentSession?: boolean
})
 {
  const [expanded, setExpanded] = useState(false)
  const startDate = new Date(session.startTime)
  const sessionStatus = isCurrentSession ? 'live' : session.active ? 'idle' : 'ended'

  return (
    <Card className="material-thin overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left active:bg-s1/50 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Status dot — mirrors Sold page card dots for visual consistency */}
            <span className="relative h-2.5 w-2.5 flex-shrink-0">
              {sessionStatus === 'live' && (
                <span className="absolute inset-0 rounded-full bg-green animate-ping opacity-60" />
              )}
              <span className={cn(
                'relative block w-2.5 h-2.5 rounded-full',
                sessionStatus === 'live' && 'bg-green',
                sessionStatus === 'idle' && 'bg-amber',
                sessionStatus === 'ended' && 'bg-t3/40'
              )} />
            </span>
            <span className="truncate text-subheadline font-semibold text-t1">
              {session.name || startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span className={cn(
              'rounded-full px-2 py-1 text-caption-2 font-bold uppercase tracking-[0.14em] flex-shrink-0',
              sessionStatus === 'live' ? 'border border-system-green/15 bg-system-green/10 text-chip-label-green' :
              sessionStatus === 'idle' ? 'border border-system-orange/15 bg-system-orange/10 text-chip-label-orange' :
              'border border-separator/70 bg-system-fill text-secondary-label'
            )}>
              {sessionStatus === 'live' ? 'Live' : sessionStatus === 'idle' ? 'Idle' : 'Ended'}
            </span>
            {session.sessionType === 'personal' && (
              <span className="rounded-full border border-system-purple/15 bg-system-purple/10 px-2 py-1 text-caption-2 font-bold uppercase tracking-[0.14em] text-system-purple flex-shrink-0">Personal</span>
            )}
            {session.operatorInitial && (
              <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-caption-2 font-bold uppercase tracking-[0.14em] text-chip-label-blue flex-shrink-0">{session.operatorInitial}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-footnote text-secondary-label">{formatDuration(duration)}</span>
            {expanded ? <CaretUp size={14} className="text-t3" /> : <CaretDown size={14} className="text-t3" />}
          </div>
        </div>
        <div className="mb-2 ml-6 text-footnote text-t3">
          {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {session.location && ` · ${session.location.name}`}
        </div>
        <div className="ml-6 flex flex-wrap gap-3 text-footnote">
          <span className="text-t2">{items.length} scans</span>
          <span className="text-green font-bold">{buyCount} BUY</span>
          <span className="text-red font-bold">{passCount} PASS</span>
          <span className="text-green font-mono font-bold">${totalProfit.toFixed(2)}</span>
          <span className="text-b1 font-bold">{buyRate}%</span>
          {listedCount > 0 && (
            <span className="text-b1 font-bold">{listedCount} listed</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-s2/60 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="material-thin rounded-xl border border-s2/40 p-3">
              <p className="text-caption-1 uppercase tracking-[0.12em] text-t3">Avg Profit</p>
              <p className="text-footnote font-bold text-t1 font-mono">
                ${buyCount > 0 ? (totalProfit / buyCount).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="material-thin rounded-xl border border-s2/40 p-3">
              <p className="text-caption-1 uppercase tracking-[0.12em] text-t3">ROI</p>
              <p className={cn('text-footnote font-bold font-mono', buyCount === 0 ? 'text-t3' : roi >= 0 ? 'text-green' : 'text-red')}>
                {buyCount === 0 ? '—' : `${roi >= 0 ? '+' : ''}${roi}%`}
              </p>
            </div>
            <div className="material-thin rounded-xl border border-s2/40 p-3">
              <p className="text-caption-1 uppercase tracking-[0.12em] text-t3">BUY Rate</p>
              <p className="text-footnote font-bold text-b1">{buyRate}%</p>
            </div>
          </div>

          {bestFind && (
            <div
              onClick={() => bestFind && onOpenItem?.(bestFind)}
              className={cn(
                'flex items-center gap-2 p-2 bg-green/5 border border-green/20 rounded-lg',
                bestFind && onOpenItem && 'cursor-pointer hover:bg-green/10 active:bg-green/15 transition-colors'
              )}
            >
              <TrendUp size={14} className="text-green flex-shrink-0" />
              {bestFind.imageThumbnail && (
                <img src={bestFind.imageThumbnail} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
              )}
              <span className="text-[10px] font-bold text-t3 uppercase flex-shrink-0">Best:</span>
              <span className="min-w-0 flex-1 truncate text-footnote text-t2">
                <span className="font-bold text-t1">{bestFind.productName}</span>
                <span className="text-t3"> · +{bestFind.profitMargin?.toFixed(0)}% · ${bestFindNetProfit.toFixed(0)} net</span>
              </span>
            </div>
          )}

          {/* Session items */}
          {items.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => onOpenItem?.(item)}
                  className={cn(
                    'material-thin flex items-center justify-between rounded-xl px-3 py-2 text-footnote transition-colors',
                    onOpenItem && 'cursor-pointer hover:bg-b1/10 active:bg-b1/15'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className={`flex-shrink-0 px-1.5 py-0.5 text-caption-2 ${item.decision === 'BUY' ? 'bg-green/10 text-green' : item.decision === 'PASS' ? 'bg-red/10 text-red' : 'bg-amber/10 text-amber'}`}>
                      {item.decision}
                    </Badge>
                    <span className="truncate text-t1">{item.productName || 'Unknown'}</span>
                  </div>
                  <span className="font-mono text-t2 flex-shrink-0 ml-2">${item.purchasePrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail() }}
            className="w-full rounded-xl bg-b1/10 py-2.5 text-subheadline font-semibold text-b1 hover:bg-b1/20 transition-colors"
          >
            View Full Session
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="w-full py-2 text-footnote font-semibold text-red/70 hover:text-red transition-colors">
            Delete Session
          </button>
        </div>
      )}
    </Card>
  )
}

type TrendsTab = 'trends' | 'stores' | 'goals'

interface SessionScreenProps {
  showTrends?: boolean
  onCloseTrends?: () => void
  onAgentMessage?: (text: string) => void
  isAgentProcessing?: boolean
  onStartSession: () => void
  onResumeSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onViewSessionDetail?: (sessionId: string) => void
  allSessions?: Session[]
  deletedSessions?: Session[]
  onRestoreSession?: (sessionId: string) => void
  onPermanentDeleteSession?: (sessionId: string) => void
  queueItems?: ScannedItem[]
  scanHistory?: ScannedItem[]
  /** Tier-2 frozen aggregates — source of truth for Performance Trends. */
  sessionArchives?: SessionArchive[]
  onOpenItem?: (item: ScannedItem) => void
  onNavigateTo?: (screen: Screen) => void
  /** Business-rule settings — drives fee-aware profit projections on session cards */
  settings?: AppSettings
}

export function SessionScreen({ showTrends = false, onCloseTrends, onStartSession, onResumeSession, onDeleteSession, onViewSessionDetail, allSessions: allSessionsProp, deletedSessions = [], onRestoreSession, onPermanentDeleteSession, queueItems: queueProp, scanHistory: scanHistoryProp, sessionArchives, onOpenItem, onNavigateTo, settings }: SessionScreenProps) {
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('trends')
  // 2-step delete verification for permanent session delete: first tap arms the
  // button (shows warning copy), second tap within 4s actually purges. Prevents
  // accidental loss of session + all its items + all its Supabase photos.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const requestPermanentDelete = useCallback((sessionId: string) => {
    if (pendingDeleteId === sessionId) {
      // Second tap within arm window — execute
      setPendingDeleteId(null)
      onPermanentDeleteSession?.(sessionId)
      return
    }
    setPendingDeleteId(sessionId)
    // Auto-disarm after 4s if user doesn't confirm
    setTimeout(() => {
      setPendingDeleteId(prev => prev === sessionId ? null : prev)
    }, 4000)
  }, [pendingDeleteId, onPermanentDeleteSession])
  // Use props from App.tsx (single source of truth) instead of local useKV
  // This ensures deletes/updates propagate immediately
  const queue = queueProp
  const allSessions = allSessionsProp

  // Memoize combined items to avoid recreating on every render
  const scanHistory = scanHistoryProp
  const allCombinedItems = useMemo(
    () => dedupById([...(queue || []), ...(scanHistory || [])]),
    [queue, scanHistory]
  )
  const [goals] = useKV<ProfitGoal[]>('profit-goals', [])
  const deviceId = useDeviceId()
  const [currentDeviceSession] = useKV<Session | undefined>(`device-current-session-${deviceId}`, undefined)

  const personalSessionIds = useMemo(() => {
    const ids = new Set<string>()
    ;(allSessions || []).forEach(s => { if (s.sessionType === 'personal') ids.add(s.id) })
    return ids
  }, [allSessions])

  // Performance Trends data: frozen archives + a live archive for the active
  // session (if any). Active session overwrites any stale archive row for
  // the same sessionId (reopen-then-end path).
  const trendsArchives = useMemo<SessionArchive[]>(() => {
    const frozen = sessionArchives || []
    if (!currentDeviceSession?.active) return frozen
    const liveItems = (queue || []).concat(scanHistory || [])
      .filter(i => i.sessionId === currentDeviceSession.id)
    const live = buildLiveArchive(currentDeviceSession, liveItems, settings)
    return [...frozen.filter(a => a.sessionId !== live.sessionId), live]
  }, [sessionArchives, currentDeviceSession, queue, scanHistory, settings])

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  return (
    <div
      id="scr-session"
      className="h-full overflow-y-auto scrollable-content overscroll-y-contain"
    >
      <div className="px-4 pt-3 pb-6">

      {showTrends ? (
        <div
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          {/* Back button */}
          <button
            onClick={onCloseTrends}
            className="flex items-center gap-1.5 mb-4 text-b1 active:opacity-60 transition-opacity"
          >
            <ArrowLeft size={16} weight="bold" />
            <span className="text-footnote font-semibold uppercase tracking-[0.12em]">Back to Session</span>
          </button>

          {/* Sub-tabs */}
          <div className="flex gap-1.5 mb-4">
            {([
              { id: 'trends' as TrendsTab, label: 'Trends', icon: ChartLine },
              { id: 'stores' as TrendsTab, label: 'Stores', icon: MapPin },
              { id: 'goals' as TrendsTab, label: 'Goals', icon: Trophy },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setTrendsTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-caption-1 font-semibold uppercase tracking-[0.12em] transition-all ${
                  trendsTab === tab.id ? 'bg-b1 text-white' : 'bg-s1 text-t3'
                }`}
              >
                <tab.icon size={14} weight={trendsTab === tab.id ? 'fill' : 'regular'} />
                {tab.label}
              </button>
            ))}
          </div>

          {trendsTab === 'trends' && (
            <div className="space-y-4">
              {/* Summary nodes */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTrendsTab('stores')} className="stat-card p-3 text-left active:scale-[0.97] transition-transform">
                  <MapPin size={16} className="text-green mb-1" />
                  <div className="text-sm font-bold text-t1">{(allSessions || []).filter(s => s.location?.name).map(s => s.location?.name).filter((v, i, a) => v && a.indexOf(v) === i).length}</div>
                  <div className="text-caption-1 font-semibold uppercase tracking-[0.12em] text-t3">Stores Visited</div>
                </button>
                <button onClick={() => setTrendsTab('goals')} className="stat-card p-3 text-left active:scale-[0.97] transition-transform">
                  <Trophy size={16} className="text-amber mb-1" />
                  <div className="text-sm font-bold text-t1">{(goals || []).filter(g => g.active).length}</div>
                  <div className="text-caption-1 font-semibold uppercase tracking-[0.12em] text-t3">Active Goals</div>
                </button>
              </div>
              <TrendVisualization archives={trendsArchives} />
            </div>
          )}

          {trendsTab === 'stores' && (
            <LocationInsights items={queue || []} />
          )}

          {trendsTab === 'goals' && (
            <div className="space-y-4">
              <GoalAchievementTracker
                goals={goals || []}
                items={queue || []}
                personalSessionIds={personalSessionIds}
              />
              <ProfitGoalManager sessions={allSessions || []} items={queue || []} />
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto space-y-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          {/* Date */}
          <p className="text-footnote font-medium uppercase tracking-[0.12em] text-t3">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>

          {/* Start new session */}
          <button
            onClick={onStartSession}
            className="w-full flex items-center gap-4 p-4 bg-fg rounded-xl border border-s1 active:scale-[0.98] transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-b1 to-b2 flex items-center justify-center shadow-lg flex-shrink-0">
              <Play size={22} weight="fill" className="text-white ml-0.5" />
            </div>
            <div className="text-left">
              <h2 className="text-headline font-semibold text-t1">Start New Session</h2>
              <p className="text-footnote text-t3">Begin tracking scans and profits</p>
            </div>
          </button>

          {/* Recently deleted — recoverable within 60s */}
          {deletedSessions.length > 0 && (
            <div className="p-3 bg-amber/5 border border-amber/20 rounded-xl">
              <div className="mb-2 text-caption-1 font-semibold uppercase tracking-[0.12em] text-amber">Recently Deleted</div>
              {deletedSessions.map(s => {
                const isArmed = pendingDeleteId === s.id
                return (
                  <div key={s.id} className="py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-t2 truncate flex-1">{s.name || 'Unnamed session'}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setPendingDeleteId(null)
                            onRestoreSession?.(s.id)
                          }}
                          className="rounded-lg bg-b1/10 px-2.5 py-1 text-caption-1 font-semibold text-b1 active:scale-95 transition-transform"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => requestPermanentDelete(s.id)}
                          className={cn(
                            'p-1.5 rounded-lg active:scale-95 transition-all',
                            isArmed
                              ? 'text-white bg-red hover:bg-red/90'
                              : 'text-red/50 hover:text-red hover:bg-red/10'
                          )}
                          aria-label={isArmed ? 'Tap again to permanently delete' : 'Permanently delete session'}
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                    {isArmed && (
                      <p className="mt-1 text-caption-1 font-semibold leading-snug text-red">
                        Tap trash again to permanently delete this session, all its scans, and all its photos. This cannot be undone.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Open sessions — tap to resume */}
          {(() => {
            const openSessions = (allSessions || []).filter(s => s.active)
            if (openSessions.length === 0) return null
            return (
              <div>
                <h3 className="text-xs font-bold text-t3 uppercase tracking-wider mb-3">Open Sessions</h3>
                <div className="space-y-2">
                  {openSessions.slice().reverse().map(s => {
                    const sessionItems = allCombinedItems.filter(i => i.sessionId === s.id)
                    const listedItems = sessionItems.filter(i => i.listingStatus === 'published')
                    const { buyCount, passCount, estimatedProfit: totalProfit, avgROI: roi, bestFind, bestFindNetProfit, buyRate } = computeBuyMetrics(sessionItems, settings)
                    const duration = (s.endTime || Date.now()) - s.startTime
                    return (
                      <PastSessionCard
                        key={s.id}
                        session={s}
                        items={sessionItems}
                        buyCount={buyCount}
                        passCount={passCount}
                        listedCount={listedItems.length}
                        totalProfit={totalProfit}
                        roi={roi}
                        bestFind={bestFind}
                        bestFindNetProfit={bestFindNetProfit}
                        duration={duration}
                        buyRate={buyRate}
                        formatDuration={formatDuration}
                        onDelete={() => { onDeleteSession?.(s.id) }}
                        onViewDetail={() => { onResumeSession?.(s.id) }}
                        onOpenItem={onOpenItem}
                        onNavigateTo={onNavigateTo}
                        isCurrentSession={s.id === currentDeviceSession?.id}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Past sessions (ended) */}
          {(() => {
            const pastSessions = (allSessions || []).filter(s => !s.active)
            if (pastSessions.length === 0) return null
            return (
              <div>
                <h3 className="text-xs font-bold text-t3 uppercase tracking-wider mb-3">Past Sessions</h3>
                <div className="space-y-2">
                  {pastSessions.slice().reverse().map(s => {
                    const sessionItems = allCombinedItems.filter(i => i.sessionId === s.id)
                    const listedItems = sessionItems.filter(i => i.listingStatus === 'published')
                    const { buyCount, passCount, estimatedProfit: totalProfit, avgROI: roi, bestFind, bestFindNetProfit, buyRate } = computeBuyMetrics(sessionItems, settings)
                    const duration = (s.endTime || Date.now()) - s.startTime
                    return (
                      <PastSessionCard
                        key={s.id}
                        session={s}
                        items={sessionItems}
                        buyCount={buyCount}
                        passCount={passCount}
                        listedCount={listedItems.length}
                        totalProfit={totalProfit}
                        roi={roi}
                        bestFind={bestFind}
                        bestFindNetProfit={bestFindNetProfit}
                        duration={duration}
                        buyRate={buyRate}
                        formatDuration={formatDuration}
                        onDelete={() => { onDeleteSession?.(s.id) }}
                        onViewDetail={() => { onViewSessionDetail?.(s.id) }}
                        onOpenItem={onOpenItem}
                        onNavigateTo={onNavigateTo}
                        isCurrentSession={s.id === currentDeviceSession?.id}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Empty state — first-run / all sessions deleted */}
          {(allSessions || []).length === 0 && deletedSessions.length === 0 && (
            <EmptyState
              icon={<ListMagnifyingGlass weight="regular" />}
              title="No sessions yet"
              description="Start a new session to begin tracking scans, buys, and profits."
              actionLabel="Start New Session"
              onAction={onStartSession}
            />
          )}
        </div>
      )}
      </div>
    </div>
  )
}
