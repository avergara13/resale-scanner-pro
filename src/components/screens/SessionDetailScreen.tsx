import { useState, useMemo, useCallback, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { CheckCircle, XCircle, Package, PencilSimple, Check, X, CaretRight, ChatCircle, Question, ArrowCounterClockwise, Camera } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { logActivity } from '@/lib/activity-log'
import { getEstimatedNetProfit } from '@/lib/profit-utils'
import { cn } from '@/lib/utils'
import type { Session, ScannedItem, ThriftStoreLocation, Screen, AppSettings } from '@/types'

interface SessionDetailScreenProps {
  sessionId: string
  onBack: () => void
  onDeleteSession?: (sessionId: string) => void
  onEndSession?: () => void
  onReopenSession?: (sessionId: string) => void
  allSessions?: Session[]
  onUpdateSessions?: (updater: (prev: Session[]) => Session[]) => void
  queueItems?: ScannedItem[]
  scanHistory?: ScannedItem[]
  onOpenItem?: (item: ScannedItem) => void
  onOpenChat?: () => void
  onNavigateTo?: (screen: Screen) => void
  /** Current device operator — used for ownership guards on End/Delete/Reopen */
  currentOperatorId?: string
  /** Restore a PASS item: changes decision to MAYBE and re-adds to scan pile. */
  onRestoreItem?: (item: ScannedItem) => void
  /** Open Photo Manager for any item (Entry Point C). */
  onOpenPhotoManager?: (item: ScannedItem) => void
  /** Business-rule settings — drives fee-aware profit projections (eBay rates, shipping, etc.) */
  settings?: AppSettings
}

export function SessionDetailScreen({ sessionId, onBack, onDeleteSession, onEndSession, onReopenSession, allSessions: allSessionsProp, onUpdateSessions, queueItems, scanHistory: scanHistoryProp, onOpenItem, onOpenChat, onNavigateTo, currentOperatorId, onRestoreItem, onOpenPhotoManager, settings }: SessionDetailScreenProps) {
  const [allSessionsFallback, setAllSessionsFallback] = useKV<Session[]>('all-sessions', [])
  const allSessions = allSessionsProp ?? allSessionsFallback
  const setAllSessions = onUpdateSessions ?? setAllSessionsFallback
  const queue = queueItems
  const scanHistory = scanHistoryProp
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
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())

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
      logActivity('Session name updated')
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
      logActivity('Location updated')
    }
    setEditingLocation(false)
  }, [editLocationName, editLocationAddress, editLocationType, session, updateSession])

  const handleSaveGoal = useCallback(() => {
    const amount = parseFloat(editGoalAmount)
    if (amount > 0) {
      updateSession({ profitGoal: amount })
      logActivity('Profit goal updated')
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

  // Geolocation: detect nearby stores (must be before early return — hooks can't be conditional)
  const [geoLoading, setGeoLoading] = useState(false)
  const handleAutoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      logActivity('Location not supported on this device', 'info')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false)
        setEditLocationAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
        setEditingLocation(true)
        logActivity('Location detected — pick a store')
      },
      () => {
        setGeoLoading(false)
        // Fallback: just open the location editor
        startEditLocation()
        logActivity('Could not detect location — enter manually', 'info')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [startEditLocation])

  useEffect(() => {
    if (session?.endTime) return

    const interval = window.setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [session?.endTime])

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-t3">Session not found</p>
      </div>
    )
  }

  // Ownership: only the operator who started the session can end/delete/reopen it
  // Sessions without operatorId (pre-feature) are unguarded — all actions available
  const isSessionOwner = !session.operatorId || session.operatorId === currentOperatorId

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  const duration = (session.endTime || currentTimestamp) - session.startTime
  const startDate = new Date(session.startTime)

  // Derive all counts from live item data — session metadata counters can lag
  const buyItems = sessionItems.filter(i => i.decision === 'BUY')
  const liveBuyCount = buyItems.length
  const livePassCount = sessionItems.filter(i => i.decision === 'PASS').length
  const maybeCount = sessionItems.filter(i => i.decision === 'MAYBE').length
  const totalScans = sessionItems.length
  // BUY Rate: denominator is decided items only (BUY + PASS + MAYBE).
  // PENDING items (still being analyzed) are excluded — they haven't been
  // decided yet and would skew the rate down if included in the denominator.
  // This makes RATE directly verifiable from the three numbers on the tally card.
  const totalDecisioned = liveBuyCount + livePassCount + maybeCount
  const buyRate = totalDecisioned > 0 ? Math.round((liveBuyCount / totalDecisioned) * 100) : 0
  const totalInvested = buyItems.reduce((s, i) => s + i.purchasePrice, 0)
  // Fee-aware net profit projection — applies platform fee schedule (eBay default) and
  // settings-driven rates (ebayFeePercent, ebayAdFeePercent, defaultShippingCost, shippingMaterialsCost).
  // Each item uses its own preferredPlatform so Mercari/Poshmark/Whatnot/FB items are
  // costed correctly rather than over-counted with eBay rates.
  const estimatedProfit = buyItems.reduce((s, i) => s + getEstimatedNetProfit(i, settings).netProfit, 0)
  // ROI — fee-adjusted profit / invested capital (mirrors CostTrackingScreen.tsx)
  const avgROI = totalInvested > 0 ? Math.round((estimatedProfit / totalInvested) * 100) : 0

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

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 pt-3 pb-6">
          {/* Header — session name on its own row, emoji action pills underneath */}
          <div className="mb-4">
            {editingName ? (
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-lg font-black flex-1"
                  placeholder="Session name"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setEditName('') } }}
                />
                <button onClick={handleSaveName} aria-label="Save name" className="w-10 h-10 flex items-center justify-center text-green active:scale-95 transition-transform"><Check size={20} weight="bold" /></button>
                <button onClick={() => { setEditingName(false); setEditName('') }} aria-label="Cancel edit" className="w-10 h-10 flex items-center justify-center text-red active:scale-95 transition-transform"><X size={20} weight="bold" /></button>
              </div>
            ) : (
              <button
                onClick={startEditName}
                className="flex items-center gap-2 mb-1 active:opacity-70 transition-opacity w-full text-left"
                aria-label="Edit session name"
              >
                <h1 className="text-2xl font-black tracking-tight text-t1 truncate">
                  {session.name || `#${String(session.sessionNumber ?? 1).padStart(3, '0')}`}
                </h1>
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-s1/60 text-t2 flex-shrink-0">
                  <PencilSimple size={14} weight="bold" />
                </span>
              </button>
            )}

            <div className="flex items-center gap-2 text-[11px] text-t3 font-medium uppercase tracking-wider mb-3">
              <span>{startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              <span>·</span>
              <span>{startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              {session.operatorName && (
                <>
                  <span>·</span>
                  <span className="truncate">{session.operatorName}</span>
                </>
              )}
              {session.location && (
                <>
                  <span>·</span>
                  <span className="truncate">{session.location.name}</span>
                </>
              )}
            </div>

            {/* Emoji action pills — Apple native feel, uniform height, proper spacing */}
            {!editingName && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const next = session.sessionType === 'personal' ? 'business' : 'personal'
                    updateSession({ sessionType: next })
                    logActivity(next === 'personal' ? '👤 Personal session' : '💼 Business session')
                  }}
                  aria-label={`Toggle to ${session.sessionType === 'personal' ? 'business' : 'personal'}`}
                  className={cn(
                    'h-9 flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95',
                    session.sessionType === 'personal'
                      ? 'bg-purple-500/10 text-purple-500'
                      : 'bg-b1/10 text-b1'
                  )}
                >
                  <span className="text-base leading-none">{session.sessionType === 'personal' ? '👤' : '💼'}</span>
                  <span>{session.sessionType === 'personal' ? 'Personal' : 'Business'}</span>
                </button>
                <button
                  onClick={handleAutoLocation}
                  disabled={geoLoading}
                  aria-label="Set location"
                  className={cn(
                    'h-9 flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60',
                    session.location ? 'bg-green/10 text-green' : 'bg-s1 text-t3'
                  )}
                >
                  <span className="text-base leading-none">📍</span>
                  <span>{geoLoading ? '...' : session.location?.name?.split(' ')[0] || 'Location'}</span>
                </button>
                <button
                  onClick={startEditGoal}
                  aria-label="Set profit goal"
                  className={cn(
                    'h-9 flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95',
                    session.profitGoal ? 'bg-amber/10 text-amber' : 'bg-s1 text-t3'
                  )}
                >
                  <span className="text-base leading-none">🎯</span>
                  <span>{session.profitGoal ? `$${session.profitGoal}` : 'Goal'}</span>
                </button>
                {onOpenChat && (
                  <button
                    onClick={onOpenChat}
                    aria-label="Open session chat"
                    className="h-9 flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95 bg-b1/10 text-b1"
                  >
                    <ChatCircle size={14} weight="bold" />
                    <span>Chat</span>
                  </button>
                )}
              </div>
            )}
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

          {/* Stats row — Invested · Scans · ROI (all three tap into relevant detail screens) */}
          <div className="flex gap-2 mb-4">
            <div
              onClick={() => onNavigateTo?.('cost-tracking')}
              className={cn(
                'stat-card flex-1 p-3 transition-colors',
                onNavigateTo && 'cursor-pointer hover:border-b1/40 hover:bg-b1/5 active:bg-b1/10'
              )}
            >
              <div className="text-base font-bold mono text-t1 leading-tight">
                ${totalInvested.toFixed(2)}
              </div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Invested</div>
            </div>
            <div
              onClick={() => onNavigateTo?.('scan-history')}
              className={cn(
                'stat-card flex-1 p-3 transition-colors',
                onNavigateTo && 'cursor-pointer hover:border-b1/40 hover:bg-b1/5 active:bg-b1/10'
              )}
            >
              <div className="text-base font-bold mono text-t1 leading-tight">{totalScans}</div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">Scans</div>
            </div>
            <div
              onClick={() => onNavigateTo?.('cost-tracking')}
              className={cn(
                'stat-card flex-1 p-3 transition-colors',
                onNavigateTo && 'cursor-pointer hover:border-b1/40 hover:bg-b1/5 active:bg-b1/10'
              )}
            >
              <div className={cn('text-base font-bold mono leading-tight', avgROI >= 0 ? 'text-green' : 'text-red')}>
                {avgROI >= 0 ? '+' : ''}{avgROI}%
              </div>
              <div className="text-[9px] text-t3 font-medium uppercase tracking-wider mt-0.5">ROI</div>
            </div>
          </div>

          {/* Tally card — BUY · PASS · MAYBE · RATE. Whole card taps into Scan History. */}
          <Card
            className={cn(
              'p-6 mb-4 transition-colors',
              onNavigateTo && 'cursor-pointer hover:border-b1/40 hover:bg-b1/5 active:bg-b1/10'
            )}
            onClick={() => onNavigateTo?.('scan-history')}
          >
            <div className="flex items-center justify-between mb-4">
              {session.active ? (
                <Badge variant="secondary" className="bg-green/15 text-green border border-green/30 px-3 py-1 uppercase text-xs font-bold flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  In Session
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-s2/60 text-t3 border border-s2 px-3 py-1 uppercase text-xs font-bold">
                  Ended
                </Badge>
              )}
              <span className="text-sm mono text-t3">{formatDuration(duration)}</span>
            </div>
            <div className="flex justify-around">
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">BUY</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold mono text-green">{liveBuyCount}</p>
                  <CheckCircle size={16} weight="fill" className="text-green" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">PASS</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold mono text-red">{livePassCount}</p>
                  <XCircle size={16} weight="fill" className="text-red" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">MAYBE</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold mono text-amber">{maybeCount}</p>
                  <Question size={16} weight="fill" className="text-amber" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-wide text-t3 mb-1">RATE</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold mono text-b1">{buyRate}</p>
                  <span className="text-base font-bold mono text-b1">%</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Potential Profit card — taps into Cost Tracking for full breakdown */}
          <Card
            className={cn(
              'p-6 mb-4 transition-colors',
              onNavigateTo && 'cursor-pointer hover:border-b1/40 hover:bg-b1/5 active:bg-b1/10'
            )}
            onClick={() => onNavigateTo?.('cost-tracking')}
          >
            <h3 className="text-sm font-semibold text-t3 uppercase tracking-wide mb-3">Potential Profit</h3>
            <p className="text-4xl font-bold mono text-t1">
              ${estimatedProfit.toFixed(2)}
            </p>
            <p className="text-sm text-t3 mt-2">
              From {liveBuyCount} items{' '}
              {liveBuyCount > 0 && (
                <span className="mono">
                  (${(estimatedProfit / liveBuyCount).toFixed(2)} avg)
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
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-s2/40"
                    style={{ background: 'color-mix(in oklch, var(--bg) 85%, transparent)' }}
                  >
                    {/* Left: badge + name (tappable to open) */}
                    <div
                      className={cn(
                        'flex items-center gap-2 min-w-0 flex-1',
                        onOpenItem && 'cursor-pointer active:opacity-70'
                      )}
                      onClick={() => onOpenItem?.(item)}
                    >
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
                    {/* Right: price + action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-t3 mr-1">${item.purchasePrice.toFixed(2)}</span>
                      {/* Photos button — all rows */}
                      {onOpenPhotoManager && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenPhotoManager(item) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-t3 hover:text-b1 hover:bg-b1/10 active:scale-90 transition-all"
                          aria-label="Manage photos"
                        >
                          <Camera size={13} weight="bold" />
                        </button>
                      )}
                      {/* Restore — PASS rows only */}
                      {item.decision === 'PASS' && onRestoreItem && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRestoreItem(item) }}
                          className="h-7 flex items-center gap-1 px-2 rounded-md text-amber hover:bg-amber/10 active:scale-95 transition-all text-[10px] font-bold"
                          aria-label="Restore to scan pile"
                        >
                          <ArrowCounterClockwise size={11} weight="bold" />
                          Restore
                        </button>
                      )}
                      {/* Open arrow */}
                      {onOpenItem && (
                        <button
                          onClick={() => onOpenItem(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-t3 hover:text-t1 active:scale-90 transition-all"
                          aria-label="Open item details"
                        >
                          <CaretRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Session — only when active, owner only */}
          {session.active && onEndSession && isSessionOwner && (
            <Button
              onClick={() => { onEndSession(); onBack() }}
              variant="outline"
              className="w-full h-12 border-orange-400/60 text-orange-500 hover:bg-orange-500/8 font-medium mt-4"
            >
              End Session
            </Button>
          )}

          {/* Reopen Session — only for past (ended) sessions, owner only */}
          {!session.active && onReopenSession && isSessionOwner && (
            <Button
              onClick={() => { onReopenSession(sessionId); onBack() }}
              variant="outline"
              className="w-full h-12 border-b1 text-b1 hover:bg-b1/10 font-medium mt-4 flex items-center gap-2"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              Reopen Session
            </Button>
          )}

          {/* Delete Session — 2-step confirmation, owner only */}
          {onDeleteSession && isSessionOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-red/60 hover:text-red hover:bg-red/5 text-xs font-medium mt-2"
                >
                  Delete Session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base font-bold">Delete this session?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-t2">
                    <strong>{session.name || `Session #${String(session.sessionNumber ?? 1).padStart(3, '0')}`}</strong> and all its session data will be deleted.
                    You'll have 60 seconds to undo from the Session tab.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { onDeleteSession(sessionId); onBack() }}
                    className="bg-red text-white hover:bg-red/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  )
}
