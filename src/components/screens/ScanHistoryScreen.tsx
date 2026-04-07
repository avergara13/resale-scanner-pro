import { useState, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Trash, FloppyDisk, CheckSquare, Square, ArrowLeft, Clock, Package, Funnel } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ScannedItem } from '@/types'

interface ScanHistoryScreenProps {
  onBack: () => void
  onSaveAsDraft: (item: ScannedItem) => void
}

export function ScanHistoryScreen({ onBack, onSaveAsDraft }: ScanHistoryScreenProps) {
  const [scanHistory, setScanHistory] = useKV<ScannedItem[]>('scan-history', [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'BUY' | 'PASS' | 'PENDING'>('all')

  const filteredHistory = useMemo(() => {
    const items = scanHistory || []
    if (filter === 'all') return items.sort((a, b) => b.timestamp - a.timestamp)
    return items.filter(i => i.decision === filter).sort((a, b) => b.timestamp - a.timestamp)
  }, [scanHistory, filter])

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
    setScanHistory(prev => (prev || []).filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
  }, [selectedIds, setScanHistory])

  const clearAll = useCallback(() => {
    setScanHistory([])
    setSelectedIds(new Set())
  }, [setScanHistory])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-4 pt-3 pb-3 border-b border-s2 bg-fg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-s1 transition-colors">
              <ArrowLeft size={20} weight="bold" className="text-t1" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-t1">Scan History</h1>
              <p className="text-[10px] text-t3 uppercase tracking-wider">{(scanHistory || []).length} total scans</p>
            </div>
          </div>
          {(scanHistory || []).length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-red text-xs">
              Clear All
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(['all', 'BUY', 'PASS', 'PENDING'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all',
                filter === f ? 'bg-b1 text-white' : 'bg-s1 text-t3'
              )}
            >
              {f === 'all' ? `All (${(scanHistory || []).length})` : f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-b1/10 border-b border-b1/20 flex items-center justify-between">
          <button onClick={selectAll} className="flex items-center gap-2 text-xs font-bold text-b1">
            {selectedIds.size === filteredHistory.length ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectedIds.size} selected
          </button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={deleteSelected} className="text-red border-red/30 h-7 text-[10px]">
              <Trash size={12} className="mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={40} weight="duotone" className="text-t3 mb-3" />
            <h3 className="text-base font-semibold text-t1 mb-1">No scan history</h3>
            <p className="text-xs text-t3 max-w-xs">Scans will appear here as you use the AI camera</p>
          </div>
        ) : (
          filteredHistory.map(item => {
            const isSelected = selectedIds.has(item.id)
            return (
              <Card
                key={item.id}
                className={cn(
                  'p-3 border transition-all',
                  isSelected ? 'border-b1 bg-b1/5' : 'border-s2'
                )}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleSelect(item.id)} className="mt-0.5 flex-shrink-0">
                    {isSelected
                      ? <CheckSquare size={18} weight="fill" className="text-b1" />
                      : <Square size={18} className="text-t3" />
                    }
                  </button>

                  {item.imageThumbnail || item.imageData ? (
                    <img
                      src={item.imageThumbnail || item.imageData}
                      alt={item.productName || 'Scan'}
                      className="w-12 h-12 rounded-lg object-cover bg-s1 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-s1 flex items-center justify-center flex-shrink-0">
                      <Package size={20} className="text-t3" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-t1 truncate">{item.productName || 'Unknown Item'}</p>
                        <p className="text-[10px] text-t3 mt-0.5">{formatTime(item.timestamp)}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] font-bold flex-shrink-0',
                          item.decision === 'BUY' ? 'bg-green/10 text-green' :
                          item.decision === 'PASS' ? 'bg-red/10 text-red' :
                          'bg-amber/10 text-amber'
                        )}
                      >
                        {item.decision}
                      </Badge>
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
  )
}
