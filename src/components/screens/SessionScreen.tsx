import { Play, Stop, CheckCircle, XCircle, ChartLine, Trophy, MapPin, CaretDown, CaretUp, Trash, Clock, TrendUp, Package, ArrowLeft } from '@phosphor-icons/react'
import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendVisualization } from '../TrendVisualization'
import { ProfitGoalManager } from '../ProfitGoalManager'
import { GoalAchievementTracker } from '../GoalAchievementTracker'
import { AgentChatWidget } from '../AgentChatWidget'
import { SharedTodoList } from '../SharedTodoList'
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock size={14} className="text-t3 flex-shrink-0" />
            <span className="text-xs font-bold text-t1 truncate">
              {session.name || startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-t3 font-mono">{formatDuration(duration)}</span>
            {expanded ? <CaretUp size={14} className="text-t3" /> : <CaretDown size={14} className="text-t3" />}
          </div>
        </div>
        <div className="flex gap-3 text-[10px]">
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
  session?: Session
  showTrends?: boolean
  onCloseTrends?: () => void
  onAgentMessage?: (text: string) => void
  isAgentProcessing?: boolean
  onStartSession: () => void
  onEndSession: () => void
  onNavigateToQueue?: (filter?: string) => void
  onNavigateToHistory?: () => void
  onViewSessionDetail?: (sessionId: string) => void
}

export function SessionScreen({ session, showTrends = false, onCloseTrends, onAgentMessage, isAgentProcessing = false, onStartSession, onEndSession, onNavigateToQueue, onNavigateToHistory, onViewSessionDetail }: SessionScreenProps) {
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('trends')
  const [queue, setQueue] = useKV<ScannedItem[]>('queue', [])
  const [scanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])

  // Memoize combined items to avoid recreating on every render
  const allCombinedItems = useMemo(() => {
    const items = [...(queue || []), ...(scanHistory || [])]
    const seen = new Set<string>()
    return items.filter(i => {
      if (seen.has(i.id)) return false
      seen.add(i.id)
      return true
    })
  }, [queue, scanHistory])
  const [goals, setGoals] = useKV<ProfitGoal[]>('profit-goals', [])
  
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 800))

    try {
      const currentQueue = await window.spark?.kv?.get<ScannedItem[]>('queue')
      const currentSessions = await window.spark?.kv?.get<Session[]>('all-sessions')
      const currentGoals = await window.spark?.kv?.get<ProfitGoal[]>('profit-goals')

      if (currentQueue) setQueue(currentQueue)
      if (currentSessions) setAllSessions(currentSessions)
      if (currentGoals) setGoals(currentGoals)
    } catch {
      // Spark runtime not available — silently ignore
    }
    
    // silent refresh
  }, [setQueue, setAllSessions, setGoals])

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
        paddingTop: isPulling || isRefreshing ? `${Math.max(pullDistance, 60)}px` : '0px',
        transition: isPulling ? 'none' : 'padding-top 0.3s ease-out'
      }}
    >
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />

      <div className="px-4 pt-4 pb-6">
      <div className="mb-5">
        <p className="text-[11px] text-t3 font-medium uppercase tracking-wider">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {showTrends ? (
        <div className="flex-1 overflow-y-auto pb-24">
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
              />
              <ProfitGoalManager sessions={allSessions || []} items={queue || []} />
            </div>
          )}
        </div>
      ) : !session?.active ? (
        <div className="flex-1 overflow-y-auto space-y-5 pb-24">
          {/* Start new session */}
          <div className="flex items-center gap-4">
            <button
              onClick={onStartSession}
              aria-label="Start scanning session"
              className="w-16 h-16 rounded-full bg-gradient-to-br from-b1 to-b2 flex items-center justify-center shadow-lg active:scale-95 transition-all flex-shrink-0"
            >
              <Play size={28} weight="fill" className="text-white ml-0.5" />
            </button>
            <div>
              <h2 className="text-base font-bold text-t1">Start New Session</h2>
              <p className="text-xs text-t3">Begin tracking scans and profits</p>
            </div>
          </div>

          {/* Past sessions */}
          {(allSessions || []).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-t3 uppercase tracking-wider mb-3">Past Sessions</h3>
              <div className="space-y-2">
                {(allSessions || []).slice().reverse().map(pastSession => {
                  const sessionItems = allCombinedItems.filter(i => i.sessionId === pastSession.id)
                  const buyItems = sessionItems.filter(i => i.decision === 'BUY')
                  const passItems = sessionItems.filter(i => i.decision === 'PASS')
                  const totalProfit = buyItems.reduce((sum, i) => sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0)
                  const bestFind = buyItems.length > 0 ? buyItems.reduce((best, i) => (i.profitMargin || 0) > (best.profitMargin || 0) ? i : best) : null
                  const duration = (pastSession.endTime || Date.now()) - pastSession.startTime
                  const buyRate = pastSession.itemsScanned > 0 ? Math.round((pastSession.buyCount / pastSession.itemsScanned) * 100) : 0

                  return (
                    <PastSessionCard
                      key={pastSession.id}
                      session={pastSession}
                      items={sessionItems}
                      buyCount={buyItems.length}
                      passCount={passItems.length}
                      totalProfit={totalProfit}
                      bestFind={bestFind}
                      duration={duration}
                      buyRate={buyRate}
                      formatDuration={formatDuration}
                      onDelete={() => {
                        setAllSessions(prev => (prev || []).filter(s => s.id !== pastSession.id))
                      }}
                      onViewDetail={() => onViewSessionDetail?.(pastSession.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          <AgentChatWidget
            onSendMessage={onAgentMessage}
            isProcessing={isAgentProcessing}
            compact
          />
          <SharedTodoList />
        </div>
      ) : (
        <div className="flex-1 space-y-3 pb-24">
          <div className="flex gap-2">
            <button onClick={() => onNavigateToQueue?.()} className="stat-card flex-1 p-3 text-left active:scale-[0.97] transition-transform">
              <div className="text-base font-bold text-green leading-tight">
                ${session.totalPotentialProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Est. Profit</div>
            </button>
            <button onClick={() => onNavigateToHistory?.()} className="stat-card flex-1 p-3 text-left active:scale-[0.97] transition-transform">
              <div className="text-base font-bold text-t1 leading-tight">{session.itemsScanned}</div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Scans</div>
            </button>
            <button onClick={() => onNavigateToQueue?.('BUY')} className="stat-card flex-1 p-3 text-left active:scale-[0.97] transition-transform">
              <div className="text-base font-bold text-b1 leading-tight">
                {session.itemsScanned > 0 ? Math.round((session.buyCount / session.itemsScanned) * 100) : 0}%
              </div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">BUY Rate</div>
            </button>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className="bg-green text-white px-3 py-1 uppercase text-xs font-bold">
                Active
              </Badge>
              <span className="text-sm mono text-t3">
                {formatDuration(Date.now() - session.startTime)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onNavigateToQueue?.('BUY')} className="text-left active:opacity-80 transition-opacity">
                <p className="text-[10px] uppercase tracking-wide text-t3 mb-0.5">BUY</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold mono text-green">{session.buyCount}</p>
                  <CheckCircle size={16} weight="fill" className="text-green" />
                </div>
              </button>
              <button onClick={() => onNavigateToQueue?.('PASS')} className="text-left active:opacity-80 transition-opacity">
                <p className="text-[10px] uppercase tracking-wide text-t3 mb-0.5">PASS</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold mono text-red">{session.passCount}</p>
                  <XCircle size={16} weight="fill" className="text-red" />
                </div>
              </button>
            </div>
          </Card>

          <AgentChatWidget
            onSendMessage={onAgentMessage}
            isProcessing={isAgentProcessing}
            compact
          />
          <SharedTodoList />

          <Button
            onClick={onEndSession}
            variant="outline"
            className="w-full h-10 border-red text-red hover:bg-red/10 font-medium text-sm"
          >
            <Stop size={18} weight="bold" className="mr-2" />
            End Session
          </Button>
        </div>
      )}
      </div>
    </div>
  )
}
