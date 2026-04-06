import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { ArrowLeft, Clock, CheckCircle, XCircle, TrendUp, Target, Trophy, Package, Funnel } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Session, ScannedItem, ProfitGoal } from '@/types'

interface SessionDetailScreenProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetailScreen({ sessionId, onBack }: SessionDetailScreenProps) {
  const [allSessions] = useKV<Session[]>('all-sessions', [])
  const [queue] = useKV<ScannedItem[]>('queue', [])
  const [scanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [goals] = useKV<ProfitGoal[]>('profit-goals', [])
  const [filter, setFilter] = useState<'all' | 'GO' | 'PASS'>('all')

  const session = useMemo(() =>
    (allSessions || []).find(s => s.id === sessionId),
    [allSessions, sessionId]
  )

  const sessionItems = useMemo(() => {
    const allItems = [...(queue || []), ...(scanHistory || [])]
    const seen = new Set<string>()
    return allItems
      .filter(i => {
        if (i.sessionId !== sessionId || seen.has(i.id)) return false
        seen.add(i.id)
        return true
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [queue, scanHistory, sessionId])

  const filteredItems = useMemo(() => {
    if (filter === 'all') return sessionItems
    return sessionItems.filter(i => i.decision === filter)
  }, [sessionItems, filter])

  const overlappingGoals = useMemo(() => {
    if (!session) return []
    const sessionEnd = session.endTime || Date.now()
    return (goals || []).filter(g =>
      g.active && g.startDate < sessionEnd && g.endDate > session.startTime
    )
  }, [goals, session])

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-t3">Session not found</p>
      </div>
    )
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  const duration = (session.endTime || Date.now()) - session.startTime
  const startDate = new Date(session.startTime)
  const goRate = session.itemsScanned > 0 ? Math.round((session.goCount / session.itemsScanned) * 100) : 0
  const avgProfitPerGo = session.goCount > 0 ? session.totalPotentialProfit / session.goCount : 0

  const calculateSessionGoalProgress = (goal: ProfitGoal) => {
    const goItems = sessionItems.filter(i => i.decision === 'GO' && i.profitMargin !== undefined)
    const currentAmount = goItems.reduce((sum, i) => sum + ((i.estimatedSellPrice || 0) - i.purchasePrice), 0)
    const percentageComplete = Math.min((currentAmount / goal.targetAmount) * 100, 100)
    return { currentAmount, percentageComplete }
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-s2">
        <button onClick={onBack} className="p-1 -ml-1 active:opacity-60 transition-opacity">
          <ArrowLeft size={20} className="text-t1" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-t1 truncate">
            {session.name || startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-t3">
            <Clock size={10} />
            <span>{formatDuration(duration)}</span>
            <span>{startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            {session.location && <span>· {session.location.name}</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">Scans</p>
            <p className="text-lg font-bold text-t1 font-mono">{session.itemsScanned}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">GO</p>
            <p className="text-lg font-bold text-green font-mono">{session.goCount}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">PASS</p>
            <p className="text-lg font-bold text-red font-mono">{session.passCount}</p>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">Profit</p>
            <p className="text-base font-bold text-green font-mono">${session.totalPotentialProfit.toFixed(2)}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">GO Rate</p>
            <p className="text-base font-bold text-b1 font-mono">{goRate}%</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[9px] text-t3 uppercase tracking-wider">Avg/GO</p>
            <p className="text-base font-bold text-t1 font-mono">${avgProfitPerGo.toFixed(2)}</p>
          </Card>
        </div>

        {/* Goals Progress */}
        {overlappingGoals.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-t3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target size={12} />
              Goals
            </h3>
            <div className="space-y-2">
              {overlappingGoals.map(goal => {
                const { currentAmount, percentageComplete } = calculateSessionGoalProgress(goal)
                const achieved = percentageComplete >= 100
                return (
                  <Card key={goal.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {achieved ? <Trophy size={14} className="text-amber" /> : <Target size={14} className="text-b1" />}
                        <span className="text-xs font-bold text-t1 capitalize">{goal.type} Goal</span>
                      </div>
                      <span className="text-[10px] font-mono text-t3">
                        ${currentAmount.toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={percentageComplete} className="h-1.5" />
                    <p className="text-[10px] text-t3 mt-1">{Math.round(percentageComplete)}% from this session</p>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Items List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-t3 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={12} />
              Items ({sessionItems.length})
            </h3>
            <div className="flex gap-1">
              {(['all', 'GO', 'PASS'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
                    filter === f ? 'bg-b1 text-white' : 'bg-s1 text-t3 hover:bg-s2'
                  )}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-xs text-t3">No items found</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {filteredItems.map(item => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0 flex-shrink-0',
                          item.decision === 'GO' ? 'bg-green/10 text-green' :
                          item.decision === 'PASS' ? 'bg-red/10 text-red' :
                          'bg-amber/10 text-amber'
                        )}
                      >
                        {item.decision}
                      </Badge>
                      <span className="text-xs text-t1 truncate font-medium">{item.productName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-t3">${item.purchasePrice.toFixed(2)}</span>
                      {item.estimatedSellPrice != null && (
                        <>
                          <TrendUp size={10} className="text-t3" />
                          <span className="text-[10px] font-mono text-green">${item.estimatedSellPrice.toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {item.decision === 'GO' && item.profitMargin != null && (
                    <p className="text-[10px] text-t3 mt-1">
                      Profit: <span className="font-mono text-green">${((item.estimatedSellPrice || 0) - item.purchasePrice).toFixed(2)}</span>
                      <span className="ml-2">({item.profitMargin.toFixed(0)}% margin)</span>
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
