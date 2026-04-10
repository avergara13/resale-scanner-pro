import { Play, CheckCircle, XCircle, ChartLine, Trophy, MapPin, CaretDown, CaretUp, Trash, Clock, TrendUp, ArrowLeft } from '@phosphor-icons/react'
import { useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TrendVisualization } from '../TrendVisualization'
import { ProfitGoalManager } from '../ProfitGoalManager'
import { GoalAchievementTracker } from '../GoalAchievementTracker'
import { LocationInsights } from '../LocationInsights'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { useKV } from '@github/spark/hooks'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import type { Session, ScannedItem, ProfitGoal } from '@/types'

function PastSessionCard({
  session, items, buyCount, passCount, totalProfit, bestFind, duration, buyRate, formatDuration, onDelete, onViewDetail
}: {
  session: Session
  items: ScannedItem[]
  buyCount: number
  passCount: number
  totalProfit: number
  bestFind: ScannedItem | null
  duration: number
  buyRate: number
  formatDuration: (ms: number) => string
  onDelete: () => void
  onViewDetail: () => void
})
 {
  const [expanded, setExpanded] = useState(false)
  const startDate = new Date(session.startTime)

  return (
    <Card className="border-s2 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 text-left active:bg-s1/50 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Clock size={14} className={session.active ? 'text-green flex-shrink-0' : 'text-t3 flex-shrink-0'} />
            <span className="text-xs font-bold text-t1 truncate">
              {session.name || startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {session.active && (
              <span className="text-[8px] font-bold bg-green/15 text-green px-1.5 py-0.5 rounded-md uppercase">Open</span>
            )}
            {session.sessionType === 'personal' && (
              <span className="text-[8px] font-bold bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded-md uppercase">Personal</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-t3 font-mono">{formatDuration(duration)}</span>
            {expanded ? <CaretUp size={14} className="text-t3" /> : <CaretDown size={14} className="text-t3" />}
          </div>
        </div>
        <div className="text-[10px] text-t3 mb-1.5 ml-6">
          {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {session.location && ` · ${session.location.name}`}
        </div>
        <div className="flex gap-3 text-[10px] ml-6">
          <span className="text-t2">{session.itemsScanned} scans</span>
          <span className="text-green font-bold">{buyCount} BUY</span>
          <span className="text-red font-bold">{passCount} PASS</span>
          <span className="text-green font-mono font-bold">${totalProfit.toFixed(2)}</span>
          <span className="text-b1 font-bold">{buyRate}%</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-s2 px-3 py-2 space-y-2">
          {/* Micro-analytics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-s1 rounded-lg">
              <p className="text-[9px] text-t3 uppercase">Avg Profit</p>
              <p className="text-xs font-bold text-t1 font-mono">
                ${buyCount > 0 ? (totalProfit / buyCount).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="p-2 bg-s1 rounded-lg">
              <p className="text-[9px] text-t3 uppercase">Revenue</p>
              <p className="text-xs font-bold text-t1 font-mono">
                ${items.filter(i => i.decision === 'BUY').reduce((s, i) => s + (i.estimatedSellPrice || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="p-2 bg-s1 rounded-lg">
              <p className="text-[9px] text-t3 uppercase">BUY Rate</p>
              <p className="text-xs font-bold text-b1">{buyRate}%</p>
            </div>
          </div>

          {bestFind && (
            <div className="flex items-center gap-2 p-2 bg-green/5 border border-green/20 rounded-lg">
              <TrendUp size={14} className="text-green flex-shrink-0" />
              <span className="text-[10px] text-t2 truncate">Best: <span className="font-bold text-t1">{bestFind.productName}</span> ({bestFind.profitMargin?.toFixed(0)}%)</span>
            </div>
          )}

          {/* Session items */}
          {items.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-2 bg-bg rounded text-[10px]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className={`text-[8px] px-1 py-0 flex-shrink-0 ${item.decision === 'BUY' ? 'bg-green/10 text-green' : item.decision === 'PASS' ? 'bg-red/10 text-red' : 'bg-amber/10 text-amber'}`}>
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
            className="w-full py-2 text-xs text-b1 font-bold bg-b1/10 rounded-lg hover:bg-b1/20 transition-colors"
          >
            View Full Session
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="w-full py-1.5 text-[10px] text-red/60 hover:text-red font-bold transition-colors">
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
}

export function SessionScreen({ showTrends = false, onCloseTrends, onAgentMessage, isAgentProcessing = false, onStartSession, onResumeSession, onDeleteSession, onViewSessionDetail, allSessions: allSessionsProp, deletedSessions = [], onRestoreSession, onPermanentDeleteSession, queueItems: queueProp, scanHistory: scanHistoryProp }: SessionScreenProps) {
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('trends')
  // Use props from App.tsx (single source of truth) instead of local useKV
  // This ensures deletes/updates propagate immediately
  const queue = queueProp
  const allSessions = allSessionsProp

  // Memoize combined items to avoid recreating on every render
  const scanHistory = scanHistoryProp
  const allCombinedItems = useMemo(() => {
    const items = [...(queue || []), ...(scanHistory || [])]
    const seen = new Set<string>()
    return items.filter(i => {
      if (seen.has(i.id)) return false
      seen.add(i.id)
      return true
    })
  }, [queue, scanHistory])
  const [goals] = useKV<ProfitGoal[]>('profit-goals', [])

  const personalSessionIds = useMemo(() => {
    const ids = new Set<string>()
    ;(allSessions || []).forEach(s => { if (s.sessionType === 'personal') ids.add(s.id) })
    return ids
  }, [allSessions])

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
  }, [])

  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxPullDistance: 150,
    enabled: true,
  })

  return (
    <div 
      ref={containerRef}
      id="scr-session" 
      className="flex flex-col h-full overflow-y-auto scrollable-content"
      style={{
        paddingTop: isPulling ? `${pullDistance}px` : isRefreshing ? '60px' : '0px',
        transition: isPulling ? 'none' : 'padding-top 0.2s ease-out'
      }}
    >
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />

      <div className="px-4 pt-3 pb-6">

      {showTrends ? (
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          {/* Back button */}
          <button
            onClick={onCloseTrends}
            className="flex items-center gap-1.5 mb-4 text-b1 active:opacity-60 transition-opacity"
          >
            <ArrowLeft size={16} weight="bold" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Back to Session</span>
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
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
                  <div className="text-[9px] text-t3 uppercase tracking-wider font-bold">Stores Visited</div>
                </button>
                <button onClick={() => setTrendsTab('goals')} className="stat-card p-3 text-left active:scale-[0.97] transition-transform">
                  <Trophy size={16} className="text-amber mb-1" />
                  <div className="text-sm font-bold text-t1">{(goals || []).filter(g => g.active).length}</div>
                  <div className="text-[9px] text-t3 uppercase tracking-wider font-bold">Active Goals</div>
                </button>
              </div>
              <TrendVisualization
                items={queue || []}
                sessions={allSessions || []}
              />
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
          <p className="text-[11px] text-t3 font-medium uppercase tracking-wider">
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
              <h2 className="text-sm font-bold text-t1">Start New Session</h2>
              <p className="text-[11px] text-t3">Begin tracking scans and profits</p>
            </div>
          </button>

          {/* Recently deleted — recoverable within 60s */}
          {deletedSessions.length > 0 && (
            <div className="p-3 bg-amber/5 border border-amber/20 rounded-xl">
              <div className="text-[10px] font-bold text-amber uppercase tracking-wide mb-2">Recently Deleted</div>
              {deletedSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-t2 truncate flex-1">{s.name || 'Unnamed session'}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() => onRestoreSession?.(s.id)}
                      className="text-[10px] font-bold text-b1 px-2 py-1 bg-b1/10 rounded-lg active:scale-95 transition-transform"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => onPermanentDeleteSession?.(s.id)}
                      className="p-1.5 rounded-lg text-red/50 hover:text-red hover:bg-red/10 active:scale-95 transition-all"
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              ))}
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
                    const buyItems = sessionItems.filter(i => i.decision === 'BUY')
                    const passItems = sessionItems.filter(i => i.decision === 'PASS')
                    const totalProfit = buyItems.reduce((sum, i) => sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0)
                    const bestFind = buyItems.length > 0 ? buyItems.reduce((best, i) => (i.profitMargin || 0) > (best.profitMargin || 0) ? i : best) : null
                    const duration = (s.endTime || Date.now()) - s.startTime
                    const buyRate = s.itemsScanned > 0 ? Math.round((s.buyCount / s.itemsScanned) * 100) : 0
                    return (
                      <PastSessionCard
                        key={s.id}
                        session={s}
                        items={sessionItems}
                        buyCount={buyItems.length}
                        passCount={passItems.length}
                        totalProfit={totalProfit}
                        bestFind={bestFind}
                        duration={duration}
                        buyRate={buyRate}
                        formatDuration={formatDuration}
                        onDelete={() => onDeleteSession?.(s.id)}
                        onViewDetail={() => onResumeSession?.(s.id)}
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
                    const buyItems = sessionItems.filter(i => i.decision === 'BUY')
                    const passItems = sessionItems.filter(i => i.decision === 'PASS')
                    const totalProfit = buyItems.reduce((sum, i) => sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0)
                    const bestFind = buyItems.length > 0 ? buyItems.reduce((best, i) => (i.profitMargin || 0) > (best.profitMargin || 0) ? i : best) : null
                    const duration = (s.endTime || Date.now()) - s.startTime
                    const buyRate = s.itemsScanned > 0 ? Math.round((s.buyCount / s.itemsScanned) * 100) : 0
                    return (
                      <PastSessionCard
                        key={s.id}
                        session={s}
                        items={sessionItems}
                        buyCount={buyItems.length}
                        passCount={passItems.length}
                        totalProfit={totalProfit}
                        bestFind={bestFind}
                        duration={duration}
                        buyRate={buyRate}
                        formatDuration={formatDuration}
                        onDelete={() => onDeleteSession?.(s.id)}
                        onViewDetail={() => onViewSessionDetail?.(s.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
      </div>
    </div>
  )
}
