import { useState } from 'react'
import { Trash, ArrowRight, Lightning, Funnel, DownloadSimple, CheckSquare, Square } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { ScannedItem } from '@/types'

interface QueueScreenProps {
  queueItems: ScannedItem[]
  onRemove: (id: string) => void
  onCreateListing: (id: string) => void
  onBatchAnalyze?: () => void
  isBatchAnalyzing?: boolean
}

type FilterOption = 'ALL' | 'GO' | 'PASS' | 'PENDING'

export function QueueScreen({ queueItems, onRemove, onCreateListing, onBatchAnalyze, isBatchAnalyzing }: QueueScreenProps) {
  const [filter, setFilter] = useState<FilterOption>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  const filteredItems = queueItems.filter(item => {
    if (filter === 'ALL') return true
    if (filter === 'GO') return item.decision === 'GO'
    if (filter === 'PASS') return item.decision === 'PASS'
    if (filter === 'PENDING') return item.decision === 'PENDING'
    return true
  })
  
  const sortedItems = [...filteredItems].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0))
  const unanalyzedItems = queueItems.filter(item => !item.productName || item.productName === 'Quick Draft')
  const analyzedItems = queueItems.filter(item => item.productName && item.productName !== 'Quick Draft')
  
  const goCount = queueItems.filter(item => item.decision === 'GO').length
  const passCount = queueItems.filter(item => item.decision === 'PASS').length
  const pendingCount = queueItems.filter(item => item.decision === 'PENDING').length

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)))
    }
  }

  const handleBulkRemove = () => {
    if (selectedIds.size === 0) return
    
    selectedIds.forEach(id => {
      onRemove(id)
    })
    
    toast.success(`Removed ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`)
    setSelectedIds(new Set())
  }

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
      toast.error('No items selected')
      return
    }

    const selectedItems = queueItems.filter(item => selectedIds.has(item.id))
    
    const headers = ['Product Name', 'Purchase Price', 'Estimated Sell Price', 'Profit Margin', 'Decision', 'Category', 'Description', 'Timestamp']
    const rows = selectedItems.map(item => [
      item.productName || 'Unknown',
      item.purchasePrice.toFixed(2),
      item.estimatedSellPrice?.toFixed(2) || '',
      item.profitMargin?.toFixed(1) || '',
      item.decision,
      item.category || '',
      (item.description || '').replace(/,/g, ';'),
      new Date(item.timestamp).toLocaleString()
    ])
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resale-scanner-export-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} to CSV`)
  }

  const allFilteredSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length
  const someFilteredSelected = selectedIds.size > 0 && selectedIds.size < filteredItems.length

  return (
    <div id="scr-queue" className="flex flex-col h-full">
      <div className="px-4 py-6 border-b border-s2">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-fg mb-2">Queue</h1>
            <p className="text-sm text-s4">{queueItems.length} items ready to list</p>
          </div>
          {unanalyzedItems.length > 0 && onBatchAnalyze && (
            <Button
              onClick={onBatchAnalyze}
              disabled={isBatchAnalyzing}
              className="bg-b1 hover:bg-b2 text-bg font-medium text-sm h-10 px-4"
            >
              <Lightning size={18} weight="fill" className="mr-2" />
              {isBatchAnalyzing ? 'Analyzing...' : `Analyze ${unanalyzedItems.length}`}
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <Funnel size={16} weight="bold" className="text-s4" />
          <div className="flex gap-2 flex-1 overflow-x-auto">
            <Button
              onClick={() => setFilter('ALL')}
              size="sm"
              variant={filter === 'ALL' ? 'default' : 'outline'}
              className={`h-8 px-3 text-xs font-medium flex-shrink-0 ${
                filter === 'ALL' 
                  ? 'bg-b1 hover:bg-b2 text-bg border-0' 
                  : 'border border-s2 bg-bg text-s4 hover:bg-s1 hover:text-fg'
              }`}
            >
              All ({queueItems.length})
            </Button>
            <Button
              onClick={() => setFilter('GO')}
              size="sm"
              variant={filter === 'GO' ? 'default' : 'outline'}
              className={`h-8 px-3 text-xs font-medium flex-shrink-0 ${
                filter === 'GO' 
                  ? 'bg-green hover:bg-green text-bg border-0' 
                  : 'border border-s2 bg-bg text-s4 hover:bg-green/10 hover:text-green'
              }`}
            >
              GO ({goCount})
            </Button>
            <Button
              onClick={() => setFilter('PASS')}
              size="sm"
              variant={filter === 'PASS' ? 'default' : 'outline'}
              className={`h-8 px-3 text-xs font-medium flex-shrink-0 ${
                filter === 'PASS' 
                  ? 'bg-red hover:bg-red text-bg border-0' 
                  : 'border border-s2 bg-bg text-s4 hover:bg-red/10 hover:text-red'
              }`}
            >
              PASS ({passCount})
            </Button>
            <Button
              onClick={() => setFilter('PENDING')}
              size="sm"
              variant={filter === 'PENDING' ? 'default' : 'outline'}
              className={`h-8 px-3 text-xs font-medium flex-shrink-0 ${
                filter === 'PENDING' 
                  ? 'bg-amber hover:bg-amber text-bg border-0' 
                  : 'border border-s2 bg-bg text-s4 hover:bg-amber/10 hover:text-amber'
              }`}
            >
              Pending ({pendingCount})
            </Button>
          </div>
        </div>
        
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSelectAll}
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium border border-s2 bg-bg text-s4 hover:bg-s1 hover:text-fg"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare size={14} weight="fill" className="mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square size={14} weight="bold" className="mr-1" />
                  Select All
                </>
              )}
            </Button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-b1">
                  {selectedIds.size} selected
                </span>
                <Button
                  onClick={handleExportCSV}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-medium border border-s2 bg-bg text-s4 hover:bg-s1 hover:text-fg"
                >
                  <DownloadSimple size={14} weight="bold" className="mr-1" />
                  Export
                </Button>
                <Button
                  onClick={handleBulkRemove}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-medium border border-red/30 bg-bg text-red hover:bg-red/10 hover:text-red"
                >
                  <Trash size={14} weight="bold" className="mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        )}
        
        {unanalyzedItems.length > 0 && (
          <div className="bg-t4 border border-t3 rounded-md px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-t1 font-medium">
              {unanalyzedItems.length} quick draft{unanalyzedItems.length !== 1 ? 's' : ''} pending analysis
            </span>
          </div>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-s1 flex items-center justify-center mb-4">
            <p className="text-3xl">
              {filter === 'GO' ? '✅' : filter === 'PASS' ? '❌' : filter === 'PENDING' ? '⏳' : '📦'}
            </p>
          </div>
          <h2 className="text-lg font-semibold text-fg mb-2">
            {queueItems.length === 0 ? 'Queue is empty' : `No ${filter} items`}
          </h2>
          <p className="text-sm text-s4 max-w-xs">
            {queueItems.length === 0 
              ? 'Scan items and add GO decisions to your queue'
              : `Try selecting a different filter to view items`
            }
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const isSelected = selectedIds.has(item.id)
              return (
                <Card 
                  key={item.id} 
                  className={`p-4 border transition-colors ${
                    isSelected ? 'border-b1 bg-t4' : 'border-s2'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-2 items-center justify-start pt-1">
                      <Checkbox
                        id={`select-${item.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(item.id)}
                        className="w-5 h-5 border-2 data-[state=checked]:bg-b1 data-[state=checked]:border-b1"
                      />
                      {item.imageData && (
                        <img
                          src={item.imageData}
                          alt={item.productName || 'Item'}
                          className="w-20 h-20 object-cover rounded-md border border-s2 flex-shrink-0"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-fg text-sm line-clamp-2">
                          {item.productName || 'Unknown Item'}
                        </h3>
                        {item.profitMargin !== undefined && (
                          <Badge
                            variant="secondary"
                            className={`flex-shrink-0 font-mono font-medium ${
                              item.profitMargin > 50
                                ? 'bg-green/20 text-green'
                                : item.profitMargin > 20
                                ? 'bg-amber/20 text-amber'
                                : 'bg-red/20 text-red'
                            }`}
                          >
                            +{item.profitMargin.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-s4 mb-3">
                        <span>Cost: ${item.purchasePrice.toFixed(2)}</span>
                        {item.estimatedSellPrice && (
                          <span>Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onCreateListing(item.id)}
                          className="flex-1 bg-b1 hover:bg-b2 text-bg h-8 text-xs font-medium"
                        >
                          <ArrowRight size={14} weight="bold" className="mr-1" />
                          Create Listing
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemove(item.id)}
                          className="h-8 w-8 p-0 text-s4 hover:text-red hover:bg-red/10"
                        >
                          <Trash size={16} weight="bold" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
