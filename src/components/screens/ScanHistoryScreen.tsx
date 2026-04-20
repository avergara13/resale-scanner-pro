import { useState, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Trash, FloppyDisk, CheckSquare, Square, Clock, Package } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { getCardPhoto } from '@/lib/photo'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import type { ScannedItem } from '@/types'

interface ScanHistoryScreenProps {
  onBack: () => void
  onSaveAsDraft: (item: ScannedItem) => void
  sessionId?: string
  scanHistory?: ScannedItem[]
  // Permanent delete with Supabase photo cascade owned by App.tsx.
  // Pass nothing (undefined) to clear entire scan history.
  onDeleteItems?: (ids?: string[]) => void
}

export function ScanHistoryScreen({ onBack, onSaveAsDraft, sessionId, scanHistory: scanHistoryProp, onDeleteItems }: ScanHistoryScreenProps) {
  // Read-only: provides data when no scanHistoryProp is passed (non-session view).
  // Write path goes through onDeleteItems (App-level, Supabase-photo-safe). Never
  // call the KV setter directly — that would skip Supabase photo cleanup.
  const [globalScanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'BUY' | 'MAYBE' | 'PASS' | 'PENDING'>('all')
  // 2-step delete verification: 'none' = idle, 'selected' = armed for bulk delete, 'all' = armed for clear-all.
  const [armedDelete, setArmedDelete] = useState<'none' | 'selected' | 'all'>('none')

  // Use prop data when session-scoped, fall back to global KV
  const effectiveHistory = scanHistoryProp ?? globalScanHistory

  // Session-scoped base — used for "All (N)" count and Clear visibility
  const sessionScopedHistory = useMemo(() => {
    const items = effectiveHistory || []
    return sessionId ? items.filter(i => i.sessionId === sessionId) : items
  }, [effectiveHistory, sessionId])

  const filteredHistory = useMemo(() => {
    let items = sessionScopedHistory
    if (filter !== 'all') items = items.filter(i => i.decision === filter)
    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [sessionScopedHistory, filter])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredHistory.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredHistory.map(i => i.id)))
    }
  }, [selectedIds.size, filteredHistory])

  const deleteSelected = useCallback(() => {
    // 2-step verification: first tap arms (sets armedDelete='selected'),
    // second tap within 4s commits. Prevents accidental loss of work + photos.
    if (armedDelete !== 'selected') {
      setArmedDelete('selected')
      setTimeout(() => setArmedDelete(prev => prev === 'selected' ? 'none' : prev), 4000)
      return
    }
    onDeleteItems?.(Array.from(selectedIds))
    setSelectedIds(new Set())
    setArmedDelete('none')
  }, [armedDelete, selectedIds, onDeleteItems])

  const clearAll = useCallback(() => {
    if (armedDelete !== 'all') {
      setArmedDelete('all')
      setTimeout(() => setArmedDelete(prev => prev === 'all' ? 'none' : prev), 4000)
      return
    }
    onDeleteItems?.(undefined)   // undefined = clear entire history KV
    setSelectedIds(new Set())
    setArmedDelete('none')
  }, [armedDelete, onDeleteItems])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const handlePullRefresh = useCallback(async () => {
    // ScanHistory is local KV — just a brief delay for tactile feedback
    await new Promise(resolve => setTimeout(resolve, 500))
  }, [])

  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    threshold: 80,
    maxPullDistance: 150,
    enabled: true,
  })

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-4 pt-3 pb-3 border-b border-s2 bg-fg">
        {/* Filter tabs + Clear All */}
        <div className="flex items-center gap-1.5">
          {(['all', 'BUY', 'MAYBE', 'PASS', 'PENDING'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all',
                filter === f ? 'bg-b1 text-white' : 'bg-s1 text-t3'
              )}
            >
              {f === 'all' ? `All (${sessionScopedHistory.length})` : f}
            </button>
          ))}
          {sessionScopedHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className={cn(
                'text-[10px] px-2 h-7 flex-shrink-0',
                armedDelete === 'all' ? 'bg-red text-white hover:bg-red/90' : 'text-red'
              )}
            >
              {armedDelete === 'all' ? 'Tap to confirm' : 'Clear'}
            </Button>
          )}
        </div>
        {armedDelete === 'all' && (
          <p className="mt-2 text-[10px] font-bold text-red leading-snug">
            Tap again to permanently delete all scans + photos. This cannot be undone.
          </p>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-b1/10 border-b border-b1/20">
          <div className="flex items-center justify-between">
            <button onClick={selectAll} className="flex items-center gap-2 text-xs font-bold text-b1">
              {selectedIds.size === filteredHistory.length ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectedIds.size} selected
            </button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={deleteSelected}
                className={cn(
                  'h-7 text-[10px]',
                  armedDelete === 'selected' ? 'bg-red text-white border-red hover:bg-red/90' : 'text-red border-red/30'
                )}
              >
                <Trash size={12} className="mr-1" />
                {armedDelete === 'selected' ? 'Tap to confirm' : 'Delete'}
              </Button>
            </div>
          </div>
          {armedDelete === 'selected' && (
            <p className="mt-1.5 text-[10px] font-bold text-red leading-snug">
              Tap Delete again to permanently remove {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} + their photos. This cannot be undone.
            </p>
          )}
        </div>
      )}

      {/* History list — PTR-enabled */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollable-content overscroll-y-contain"
      >
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          progress={progress}
          shouldTrigger={shouldTrigger}
        />
        <div
          className="px-3 py-3 space-y-2 pb-24"
          style={{
            transform: `translateY(${isPulling ? pullDistance : isRefreshing ? 60 : 0}px)`,
            transition: isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: isPulling || isRefreshing ? 'transform' : 'auto',
          }}
        >
          {filteredHistory.length === 0 ? (
            <EmptyState
              icon={<Clock weight="regular" />}
              title="No scan history"
              description="Scans will appear here as you use the AI camera."
            />
          ) : (
            filteredHistory.map(item => {
              const isSelected = selectedIds.has(item.id)
              return (
                <Card
                  key={item.id}
                  className={cn(
                    'p-3 transition-all',
                    isSelected ? 'border border-b1 bg-b1/5' : 'border border-s2/60 material-thin'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleSelect(item.id)} className="mt-0.5 flex-shrink-0">
                      {isSelected
                        ? <CheckSquare size={18} weight="fill" className="text-b1" />
                        : <Square size={18} className="text-t3" />
                      }
                    </button>

                    {(() => {
                      const photo = getCardPhoto(item)
                      return photo ? (
                        <img
                          src={photo}
                          alt={item.productName || 'Scan'}
                          className="w-12 h-12 rounded-xl object-cover bg-s1 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-s1 flex items-center justify-center flex-shrink-0">
                          <Package size={20} className="text-t3" />
                        </div>
                      )
                    })()}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-t1 truncate">{item.productName || 'Unknown Item'}</p>
                          <p className="text-[10px] text-t3 mt-0.5">{formatTime(item.timestamp)}</p>
                        </div>
                        <StatusChip
                          tone={
                            item.decision === 'BUY' ? 'success' :
                            item.decision === 'PASS' ? 'danger' :
                            'warning'
                          }
                          className="h-5 px-2 text-[10px] flex-shrink-0"
                        >
                          {item.decision}
                        </StatusChip>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-t2 font-mono">Buy: ${item.purchasePrice.toFixed(2)}</span>
                        {item.estimatedSellPrice !== undefined && item.estimatedSellPrice > 0 && (
                          <span className="text-[10px] text-t2 font-mono">Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
                        )}
                        {item.profitMargin != null && isFinite(item.profitMargin) && (
                          <span className={cn(
                            'text-[10px] font-mono font-bold',
                            item.profitMargin > 0 ? 'text-green' : 'text-red'
                          )}>
                            {item.profitMargin >= 0 ? '+' : ''}{item.profitMargin.toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {!item.inQueue && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSaveAsDraft(item)}
                          className="mt-2 h-7 text-[10px] border-b1/30 text-b1"
                        >
                          <FloppyDisk size={12} className="mr-1" /> Save as Draft
                        </Button>
                      )}
                      {item.inQueue && (
                        <span className="text-[9px] text-green font-bold mt-1.5 block">In Queue</span>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
