import { useState, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { CheckCircle, XCircle, TrendUp, Target, Package, PencilSimple, Check, X, MapPin } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AgentPanel } from '../AgentPanel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Session, ScannedItem, ThriftStoreLocation } from '@/types'

interface SessionDetailScreenProps {
  sessionId: string
  onBack: () => void
}

export function SessionDetailScreen({ sessionId, onBack }: SessionDetailScreenProps) {
  const [allSessions, setAllSessions] = useKV<Session[]>('all-sessions', [])
  const [queue] = useKV<ScannedItem[]>('queue', [])
  const [scanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [filter, setFilter] = useState<'all' | 'BUY' | 'PASS'>('all')

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

  const handleDelete = useCallback(() => {
    setAllSessions(prev => (prev || []).filter(s => s.id !== sessionId))
    onBack()
    toast.success('Session deleted')
  }, [setAllSessions, sessionId, onBack])

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
  const buyRate = session.itemsScanned > 0 ? Math.round((session.buyCount / session.itemsScanned) * 100) : 0

  const locationTypes: { value: ThriftStoreLocation['type']; label: string }[] = [
    { value: 'goodwill', label: 'Goodwill' },
    { value: 'salvation-army', label: 'Salvation Army' },
    { value: 'ross', label: 'Ross' },
    { value: 'tjmaxx', label: 'TJ Maxx' },
    { value: 'marshalls', label: "Marshall's" },
    { value: 'homegoods', label: 'HomeGoods' },
    { value: 'ollies', label: "Ollie's" },
    { value: 'burlington', label: 'Burlington' },
    { value: 'thrift-store', label: 'Thrift Store' },
    { value: 'estate-sale', label: 'Estate Sale' },
    { value: 'garage-sale', label: 'Garage Sale' },
    { value: 'flea-market', label: 'Flea Market' },
    { value: 'other', label: 'Other' },
  ]

  // Geolocation: detect nearby stores
  const [geoLoading, setGeoLoading] = useState(false)
  const handleAutoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Location not supported on this device')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false)
        setEditLocationAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
        setEditingLocation(true)
        toast.success('Location detected — pick a store')
      },
      () => {
        setGeoLoading(false)
        // Fallback: just open the location editor
        startEditLocation()
        toast.info('Could not detect location — enter manually')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [startEditLocation])

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 pt-3 pb-6">
          {/* Header — session name + compact action buttons */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-lg font-black"
                    placeholder="Session name"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setEditName('') } }}
                  />
                  <button onClick={handleSaveName} className="text-green p-2"><Check size={18} /></button>
                  <button onClick={() => { setEditingName(false); setEditName('') }} className="text-red p-2"><X size={18} /></button>
                </div>
              ) : (
                <button onClick={startEditName} className="flex items-center gap-2 active:opacity-70 transition-opacity">
                  <h1 className="text-lg font-black tracking-tight text-t1">
                    {session.name || startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h1>
                  <PencilSimple size={14} className="text-t3" />
                </button>
              )}

              {/* Compact action buttons: type, location, goal */}
              {!editingName && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = session.sessionType === 'personal' ? 'business' : 'personal'
                      updateSession({ sessionType: next })
                    }}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                      session.sessionType === 'personal' ? 'bg-purple-500/10 text-purple-500' : 'bg-b1/10 text-b1'
                    )}
                  >
                    {session.sessionType === 'personal' ? '👤' : '💼'}
                  </button>
                  <button
                    onClick={handleAutoLocation}
                    disabled={geoLoading}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                      session.location ? 'bg-green/10 text-green' : 'bg-s1 text-t3'
                    )}
                  >
                    <MapPin size={13} weight={session.location ? 'fill' : 'regular'} />
                    {geoLoading ? '...' : session.location?.name?.split(' ')[0] || '📍'}
                  </button>
                  <button
                    onClick={startEditGoal}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                      session.profitGoal ? 'bg-amber/10 text-amber' : 'bg-s1 text-t3'
                    )}
                  >
                    <Target size={13} weight={session.profitGoal ? 'fill' : 'regular'} />
                    {session.profitGoal ? `$${session.profitGoal}` : '🎯'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-t3 font-medium uppercase tracking-wider">
              <span>{startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              <span>·</span>
              <span>{startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              {session.location && (
                <>
                  <span>·</span>
                  <span>{session.location.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Expandable location editor */}
          {editingLocation && (
            <Card className="p-3 mb-3">
              <Label className="text-[10px] text-t3 uppercase mb-2 block">Pick a Store</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {locationTypes.map(lt => (
                  <button
                    key={lt.value}
                    onClick={() => {
                      setEditLocationType(lt.value!)
                      setEditLocationName(lt.label)
                    }}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors',
                      editLocationType === lt.value && editLocationName === lt.label ? 'bg-b1 text-white' : 'bg-s1 text-t3'
                    )}
                  >
                    {lt.label}
                  </button>
                ))}
              </div>
              <Input
                value={editLocationName}
                onChange={(e) => setEditLocationName(e.target.value)}
                placeholder="Store name"
                className="h-8 text-sm mb-2"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveLocation} className="bg-b1 text-white text-xs h-8 flex-1">Save Location</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingLocation(false)} className="text-xs h-8">Cancel</Button>
              </div>
            </Card>
          )}

          {/* Expandable goal editor */}
          {editingGoal && (
            <Card className="p-3 mb-3">
              <Label className="text-[10px] text-t3 uppercase mb-2 block">Session Profit Goal</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-t1 font-bold">$</span>
                <Input
                  type="number"
                  value={editGoalAmount}
                  onChange={(e) => setEditGoalAmount(e.target.value)}
                  placeholder="Target amount"
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') { setEditingGoal(false); setEditGoalAmount('') } }}
                />
                <Button size="sm" onClick={handleSaveGoal} className="bg-b1 text-white text-xs h-8">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingGoal(false); setEditGoalAmount('') }} className="text-xs h-8">Cancel</Button>
              </div>
            </Card>
          )}

          {/* Stats row — matches active session layout */}
          <div className="flex gap-2 mb-4">
            <div className="stat-card flex-1 p-3">
              <div className="text-base font-bold text-green leading-tight">
                ${session.totalPotentialProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Est. Profit</div>
            </div>
            <div className="stat-card flex-1 p-3">
              <div className="text-base font-bold text-t1 leading-tight">{session.itemsScanned}</div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Scans</div>
            </div>
            <div className="stat-card flex-1 p-3">
              <div className="text-base font-bold text-b1 leading-tight">{buyRate}%</div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">BUY Rate</div>
            </div>
          </div>

          {/* BUY / PASS card — matches active session */}
          <Card className="p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary" className="bg-t3 text-white px-3 py-1 uppercase text-xs font-bold">
                Completed
              </Badge>
              <span className="text-sm mono text-t3">{formatDuration(duration)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">BUY</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold mono text-green">{session.buyCount}</p>
                  <CheckCircle size={20} weight="fill" className="text-green" />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">PASS</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold mono text-red">{session.passCount}</p>
                  <XCircle size={20} weight="fill" className="text-red" />
                </div>
              </div>
            </div>
          </Card>

          {/* Potential Profit card — matches active session */}
          <Card className="p-6 mb-4">
            <h3 className="text-sm font-semibold text-t3 uppercase tracking-wide mb-3">Potential Profit</h3>
            <p className="text-4xl font-bold mono text-t1">
              ${session.totalPotentialProfit.toFixed(2)}
            </p>
            <p className="text-sm text-t3 mt-2">
              From {session.buyCount} items{' '}
              {session.buyCount > 0 && (
                <span className="mono">
                  (${(session.totalPotentialProfit / session.buyCount).toFixed(2)} avg)
                </span>
              )}
            </p>
          </Card>

          {/* Items from this session */}
          {sessionItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-t3 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} />
                  Items ({sessionItems.length})
                </h3>
                <div className="flex gap-1">
                  {(['all', 'BUY', 'PASS'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-2.5 py-1 rounded text-[11px] font-bold transition-colors',
                        filter === f ? 'bg-b1 text-white' : 'bg-s1 text-t3 hover:bg-s2'
                      )}
                    >
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {filteredItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-s1 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0 flex-shrink-0',
                          item.decision === 'BUY' ? 'bg-green/10 text-green' :
                          item.decision === 'PASS' ? 'bg-red/10 text-red' :
                          'bg-amber/10 text-amber'
                        )}
                      >
                        {item.decision}
                      </Badge>
                      <span className="text-xs text-t1 truncate font-medium">{item.productName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-t3">${item.purchasePrice.toFixed(2)}</span>
                      {item.estimatedSellPrice != null && (
                        <>
                          <TrendUp size={10} className="text-t3" />
                          <span className="text-[10px] font-mono text-green">${item.estimatedSellPrice.toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profit Goals */}
          <AgentPanel />

          {/* Delete */}
          <Button
            onClick={handleDelete}
            variant="outline"
            className="w-full h-12 border-red text-red hover:bg-red/10 font-medium mt-4"
          >
            Delete Session
          </Button>
        </div>
      </div>
    </div>
  )
}
