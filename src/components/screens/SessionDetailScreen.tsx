import { useState, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { ArrowLeft, Clock, TrendUp, Target, Trophy, Package, PencilSimple, Check, X, MapPin } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Session, ScannedItem, ProfitGoal, ThriftStoreLocation } from '@/types'

interface SessionDetailScreenProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetailScreen({ sessionId, onBack }: SessionDetailScreenProps) {
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [queue] = useKV<ScannedItem[]>('queue', [])
  const [scanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [goals] = useKV<ProfitGoal[]>('profit-goals', [])
  const [filter, setFilter] = useState<'all' | 'GO' | 'PASS'>('all')

  // Editing states
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [editLocationName, setEditLocationName] = useState('')
  const [editLocationAddress, setEditLocationAddress] = useState('')
  const [editLocationType, setEditLocationType] = useState<ThriftStoreLocation['type']>('thrift-store')
  const [editingGoal, setEditingGoal] = useState(false)
  const [editGoalAmount, setEditGoalAmount] = useState('')

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

  const updateSession = useCallback((updates: Partial<Session>) => {
    setAllSessions(prev =>
      (prev || []).map(s => s.id === sessionId ? { ...s, ...updates } : s)
    )
  }, [setAllSessions, sessionId])

  const handleSaveName = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed) {
      updateSession({ name: trimmed })
      toast.success('Session name updated')
    }
    setEditingName(false)
  }, [editName, updateSession])

  const handleSaveLocation = useCallback(() => {
    const name = editLocationName.trim()
    if (name) {
      const location: ThriftStoreLocation = {
        id: session?.location?.id || Date.now().toString(),
        name,
        address: editLocationAddress.trim() || undefined,
        type: editLocationType,
      }
      updateSession({ location })
      toast.success('Location updated')
    }
    setEditingLocation(false)
  }, [editLocationName, editLocationAddress, editLocationType, session, updateSession])

  const handleSaveGoal = useCallback(() => {
    const amount = parseFloat(editGoalAmount)
    if (amount > 0) {
      updateSession({ profitGoal: amount })
      toast.success('Profit goal updated')
    }
    setEditingGoal(false)
  }, [editGoalAmount, updateSession])

  const startEditName = useCallback(() => {
    setEditName(session?.name || '')
    setEditingName(true)
  }, [session])

  const startEditLocation = useCallback(() => {
    setEditLocationName(session?.location?.name || '')
    setEditLocationAddress(session?.location?.address || '')
    setEditLocationType(session?.location?.type || 'thrift-store')
    setEditingLocation(true)
  }, [session])

  const startEditGoal = useCallback(() => {
    setEditGoalAmount(session?.profitGoal?.toString() || '')
    setEditingGoal(true)
  }, [session])

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
    const percentageComplete = goal.targetAmount > 0 ? Math.min((currentAmount / goal.targetAmount) * 100, 100) : 0
    return { currentAmount, percentageComplete }
  }

  const locationTypes: { value: ThriftStoreLocation['type']; label: string }[] = [
    { value: 'goodwill', label: 'Goodwill' },
    { value: 'salvation-army', label: 'Salvation Army' },
    { value: 'thrift-store', label: 'Thrift Store' },
    { value: 'estate-sale', label: 'Estate Sale' },
    { value: 'garage-sale', label: 'Garage Sale' },
    { value: 'flea-market', label: 'Flea Market' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-s2">
        <button onClick={onBack} className="p-1 -ml-1 active:opacity-60 transition-opacity">
          <ArrowLeft size={20} className="text-t1" />
        </button>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm font-bold"
                placeholder="Session name"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setEditName('') } }}
              />
              <button onClick={handleSaveName} className="text-green p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Check size={18} /></button>
              <button onClick={() => { setEditingName(false); setEditName('') }} className="text-red p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={18} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-t1 truncate">
                {session.name || startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h1>
              <button onClick={startEditName} className="text-t3 hover:text-t1 transition-colors flex-shrink-0">
                <PencilSimple size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-t3 mt-0.5">
            <Clock size={10} />
            <span>{formatDuration(duration)}</span>
            <span>{startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        {/* Location (editable) */}
        <Card className="p-3">
          {editingLocation ? (
            <div className="space-y-2">
              <Label className="text-[10px] text-t3 uppercase">Location</Label>
              <Input
                value={editLocationName}
                onChange={(e) => setEditLocationName(e.target.value)}
                placeholder="Store name"
                className="h-8 text-xs"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') setEditingLocation(false) }}
              />
              <Input
                value={editLocationAddress}
                onChange={(e) => setEditLocationAddress(e.target.value)}
                placeholder="Address (optional)"
                className="h-8 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') setEditingLocation(false) }}
              />
              <div className="flex flex-wrap gap-1">
                {locationTypes.map(lt => (
                  <button
                    key={lt.value}
                    onClick={() => setEditLocationType(lt.value)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                      editLocationType === lt.value ? 'bg-b1 text-white' : 'bg-s1 text-t3'
                    )}
                  >
                    {lt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveLocation} className="flex items-center gap-1 text-xs text-green font-bold">
                  <Check size={12} /> Save
                </button>
                <button onClick={() => setEditingLocation(false)} className="flex items-center gap-1 text-xs text-t3">
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startEditLocation} className="flex items-center gap-2 w-full text-left">
              <MapPin size={14} className={session.location ? 'text-b1' : 'text-t3'} />
              <span className="text-xs text-t1 flex-1 truncate">
                {session.location ? (
                  <>
                    {session.location.name}
                    {session.location.address && <span className="text-t3 ml-1">· {session.location.address}</span>}
                  </>
                ) : (
                  <span className="text-t3 italic">Tap to add location</span>
                )}
              </span>
              <PencilSimple size={12} className="text-t3 flex-shrink-0" />
            </button>
          )}
        </Card>

        {/* Profit Goal (editable) */}
        <Card className="p-3">
          {editingGoal ? (
            <div className="space-y-2">
              <Label className="text-[10px] text-t3 uppercase">Session Profit Goal</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-t1 font-bold">$</span>
                <Input
                  type="number"
                  value={editGoalAmount}
                  onChange={(e) => setEditGoalAmount(e.target.value)}
                  placeholder="Target amount"
                  className="h-8 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') { setEditingGoal(false); setEditGoalAmount('') } }}
                />
                <button onClick={handleSaveGoal} className="text-green p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Check size={18} /></button>
                <button onClick={() => { setEditingGoal(false); setEditGoalAmount('') }} className="text-red p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <button onClick={startEditGoal} className="flex items-center gap-2 w-full text-left">
              <Target size={14} className={session.profitGoal ? 'text-b1' : 'text-t3'} />
              <div className="flex-1">
                {session.profitGoal ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-t1">Session Goal: ${session.profitGoal.toFixed(2)}</span>
                      <span className="text-[10px] font-mono text-t3">
                        ${session.totalPotentialProfit.toFixed(2)} / ${session.profitGoal.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={session.profitGoal > 0 ? Math.min((session.totalPotentialProfit / session.profitGoal) * 100, 100) : 0} className="h-1.5 mt-1" />
                    <p className="text-[10px] text-t3 mt-0.5">
                      {session.profitGoal > 0 ? Math.round((session.totalPotentialProfit / session.profitGoal) * 100) : 0}% achieved
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-t3 italic">Tap to set a profit goal</span>
                )}
              </div>
              <PencilSimple size={12} className="text-t3 flex-shrink-0" />
            </button>
          )}
        </Card>

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
