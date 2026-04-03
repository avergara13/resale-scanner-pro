import { useState, useMemo, useEffect } from 'react'
import { Trash, ArrowRight, Lightning, Funnel, DownloadSimple, CheckSquare, Square, ArrowsDownUp, PencilSimple, MagnifyingGlass, X, BookmarkSimple, Tag, ChartBar, MapPin, DotsSixVertical, ArrowCounterClockwise, TrendUp, TrendDown, Minus, CaretDown } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { ItemEditDialog } from '@/components/ItemEditDialog'
import { ThemeToggle } from '../ThemeToggle'
import { AdvancedFilters, type AdvancedFilterOptions } from '@/components/AdvancedFilters'
import { ActiveFiltersSummary } from '@/components/ActiveFiltersSummary'
import { FilterPresetsManager } from '@/components/FilterPresetsManager'
import { BulkTagOperations } from '@/components/BulkTagOperations'
import { LocationInsights } from '@/components/LocationInsights'
import { useSortFilterPreference } from '@/hooks/use-sort-filter-preference'
import { useAdvancedFilterPreference } from '@/hooks/use-advanced-filter-preference'
import { cn } from '@/lib/utils'
import type { ScannedItem, CategoryPreset, ItemTag } from '@/types'
import type { GeminiService } from '@/lib/gemini-service'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface QueueScreenProps {
  queueItems: ScannedItem[]
  onRemove: (id: string) => void
  onCreateListing: (id: string) => void
  onEdit: (itemId: string, updates: Partial<ScannedItem>) => void
  onReorder?: (items: ScannedItem[]) => void
  onBatchAnalyze?: () => void
  isBatchAnalyzing?: boolean
  geminiService?: GeminiService | null
  onNavigateToTagAnalytics?: () => void
  onNavigateToLocationInsights?: () => void
}

type FilterOption = 'ALL' | 'GO' | 'PASS' | 'PENDING'
type SortOption = 'profit-desc' | 'profit-asc' | 'date-desc' | 'date-asc' | 'category-asc' | 'category-desc' | 'tag-count-desc' | 'tag-count-asc' | 'tag-name-asc' | 'tag-name-desc' | 'manual'

interface SortableItemProps {
  item: ScannedItem
  isSelected: boolean
  allTags: ItemTag[]
  onToggleSelect: (id: string) => void
  onEdit: (item: ScannedItem) => void
  onRemove: (id: string) => void
  onCreateListing: (id: string) => void
  onEditTags: (itemId: string, tags: string[]) => void
}

function SortableItem({ 
  item, 
  isSelected, 
  allTags, 
  onToggleSelect, 
  onEdit, 
  onRemove, 
  onCreateListing,
  onEditTags 
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 border transition-colors",
        isSelected ? 'border-b1 bg-t4' : 'border-s2'
      )}
    >
      <div className="flex gap-3">
        <div className="flex flex-col gap-2 items-center justify-start pt-1">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-s1 rounded transition-colors"
            aria-label="Drag to reorder"
          >
            <DotsSixVertical size={20} weight="bold" className="text-s3" />
          </div>
          <Checkbox
            id={`select-${item.id}`}
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(item.id)}
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
          <div className="flex items-center gap-4 text-xs font-mono text-s4 mb-2">
            <span>Cost: ${item.purchasePrice.toFixed(2)}</span>
            {item.estimatedSellPrice && (
              <span>Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
            )}
          </div>
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-3">
              <Tag size={12} weight="bold" className="text-s4 flex-shrink-0" />
              {item.tags.map((tagId) => {
                const tag = allTags.find(t => t.id === tagId)
                if (!tag) return null
                return (
                  <Badge
                    key={tagId}
                    variant="outline"
                    className="text-[10px] h-5 pl-2 pr-1 font-medium border flex items-center gap-1 group hover:opacity-80 transition-opacity"
                    style={{
                      borderColor: tag.color,
                      backgroundColor: `${tag.color}15`,
                      color: tag.color
                    }}
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const updatedTags = item.tags?.filter(t => t !== tagId) || []
                        onEditTags(item.id, updatedTags)
                        toast.success(`Removed tag: ${tag.name}`)
                      }}
                      className="flex items-center justify-center hover:opacity-70 transition-opacity"
                      aria-label={`Remove ${tag.name} tag`}
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onEdit(item)}
              variant="outline"
              className="h-8 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
            >
              <PencilSimple size={14} weight="bold" className="mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={() => onCreateListing(item.id)}
              className="flex-1 bg-b1 hover:bg-b2 text-white h-8 text-xs font-medium"
            >
              <ArrowRight size={14} weight="bold" className="mr-1" />
              List
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item.id)}
              className="h-8 w-8 p-0 text-t2 hover:text-red hover:bg-red/10"
            >
              <Trash size={16} weight="bold" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function QueueScreen({ queueItems, onRemove, onCreateListing, onEdit, onReorder, onBatchAnalyze, isBatchAnalyzing, geminiService, onNavigateToTagAnalytics, onNavigateToLocationInsights }: QueueScreenProps) {
  const { sortBy, filter, setSortBy, setFilter } = useSortFilterPreference<SortOption, FilterOption>(
    'queue-screen',
    'manual',
    'ALL'
  )
  const { filters: advancedFilters, setFilters: setAdvancedFilters } = useAdvancedFilterPreference('queue-screen')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<ScannedItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [allTags, setAllTags] = useKV<ItemTag[]>('all-tags', [])
  const [previousItemCount, setPreviousItemCount] = useState<number>(queueItems.length)
  const [previousFilteredCount, setPreviousFilteredCount] = useState<number | null>(null)
  const [showTrendIndicator, setShowTrendIndicator] = useState(false)
  const [locationInsightsOpen, setLocationInsightsOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !onReorder) {
      return
    }

    const oldIndex = sortedItems.findIndex((item) => item.id === active.id)
    const newIndex = sortedItems.findIndex((item) => item.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedItems = arrayMove(sortedItems, oldIndex, newIndex)
      
      if (sortBy !== 'manual') {
        setSortBy('manual')
        toast.success('Switched to manual ordering')
      }
      
      onReorder(reorderedItems)
      toast.success('Queue reordered')
    }
  }

  const handleApplyPreset = (preset: CategoryPreset) => {
    if (preset.filters) {
      const newFilters: AdvancedFilterOptions = {}
      
      if (preset.filters.minProfit || preset.filters.maxProfit) {
        newFilters.profitMarginRange = {
          min: preset.filters.minProfit || 0,
          max: preset.filters.maxProfit || 100
        }
      }
      
      setAdvancedFilters(newFilters)
    }
    
    if (preset.filters?.decision && preset.filters.decision.length === 1) {
      setFilter(preset.filters.decision[0] as FilterOption)
    } else {
      setFilter('ALL')
    }
    
    if (preset.sortBy && preset.sortOrder) {
      setSortBy(`${preset.sortBy}-${preset.sortOrder}` as SortOption)
    }
    
    setPresetsOpen(false)
  }

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    queueItems.forEach(item => {
      if (item.category) categories.add(item.category)
    })
    return Array.from(categories).sort()
  }, [queueItems])

  const availableLocations = useMemo(() => {
    const locations = new Map<string, { id: string; name: string }>()
    queueItems.forEach(item => {
      if (item.location) {
        locations.set(item.location.id, {
          id: item.location.id,
          name: item.location.name
        })
      }
    })
    return Array.from(locations.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [queueItems])

  const priceRange = useMemo(() => {
    if (queueItems.length === 0) return { min: 0, max: 1000 }
    const prices = queueItems.map(item => item.purchasePrice)
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices))
    }
  }, [queueItems])
  
  const filteredItems = queueItems.filter(item => {
    const matchesFilter = 
      filter === 'ALL' ||
      (filter === 'GO' && item.decision === 'GO') ||
      (filter === 'PASS' && item.decision === 'PASS') ||
      (filter === 'PENDING' && item.decision === 'PENDING')
    
    if (!matchesFilter) return false

    if (advancedFilters.priceRange) {
      if (item.purchasePrice < advancedFilters.priceRange.min || 
          item.purchasePrice > advancedFilters.priceRange.max) {
        return false
      }
    }

    if (advancedFilters.profitMarginRange && item.profitMargin !== undefined) {
      if (item.profitMargin < advancedFilters.profitMarginRange.min || 
          item.profitMargin > advancedFilters.profitMarginRange.max) {
        return false
      }
    }

    if (advancedFilters.dateRange) {
      if (item.timestamp < advancedFilters.dateRange.start || 
          item.timestamp > advancedFilters.dateRange.end) {
        return false
      }
    }

    if (advancedFilters.categories && advancedFilters.categories.length > 0) {
      if (!item.category || !advancedFilters.categories.includes(item.category)) {
        return false
      }
    }

    if (advancedFilters.locations && advancedFilters.locations.length > 0) {
      if (!item.location || !advancedFilters.locations.includes(item.location.id)) {
        return false
      }
    }

    if (advancedFilters.tags && advancedFilters.tags.length > 0) {
      if (!item.tags || !advancedFilters.tags.some(tagId => item.tags?.includes(tagId))) {
        return false
      }
    }
    
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase().trim()
    const productName = (item.productName || '').toLowerCase()
    const description = (item.description || '').toLowerCase()
    const category = (item.category || '').toLowerCase()
    const notes = (item.notes || '').toLowerCase()
    const locationName = (item.location?.name || '').toLowerCase()
    
    return (
      productName.includes(query) ||
      description.includes(query) ||
      category.includes(query) ||
      notes.includes(query) ||
      locationName.includes(query)
    )
  })
  
  const sortedItems = sortBy === 'manual' ? filteredItems : [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'profit-desc':
        return (b.profitMargin || 0) - (a.profitMargin || 0)
      case 'profit-asc':
        return (a.profitMargin || 0) - (b.profitMargin || 0)
      case 'date-desc':
        return b.timestamp - a.timestamp
      case 'date-asc':
        return a.timestamp - b.timestamp
      case 'category-asc':
        return (a.category || 'Uncategorized').localeCompare(b.category || 'Uncategorized')
      case 'category-desc':
        return (b.category || 'Uncategorized').localeCompare(a.category || 'Uncategorized')
      case 'tag-count-desc':
        return (b.tags?.length || 0) - (a.tags?.length || 0)
      case 'tag-count-asc':
        return (a.tags?.length || 0) - (b.tags?.length || 0)
      case 'tag-name-asc': {
        const aFirstTag = a.tags?.[0] ? (allTags || []).find(t => t.id === a.tags![0])?.name || '' : ''
        const bFirstTag = b.tags?.[0] ? (allTags || []).find(t => t.id === b.tags![0])?.name || '' : ''
        return aFirstTag.localeCompare(bFirstTag)
      }
      case 'tag-name-desc': {
        const aFirstTag = a.tags?.[0] ? (allTags || []).find(t => t.id === a.tags![0])?.name || '' : ''
        const bFirstTag = b.tags?.[0] ? (allTags || []).find(t => t.id === b.tags![0])?.name || '' : ''
        return bFirstTag.localeCompare(aFirstTag)
      }
      default:
        return 0
    }
  })
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

  useEffect(() => {
    if (sortedItems.length !== previousItemCount) {
      const diff = sortedItems.length - previousItemCount
      setPreviousItemCount(sortedItems.length)
      
      if (diff !== 0 && previousItemCount !== queueItems.length) {
        const diffAmount = Math.abs(diff)
        const itemText = diffAmount !== 1 ? 's' : ''
        
        if (diff > 0) {
          toast.success(`📈 Showing ${diffAmount} more item${itemText}`, {
            duration: 2000,
            className: 'bg-green/10 border-green/30 text-green',
          })
        } else {
          toast.info(`📉 Showing ${diffAmount} fewer item${itemText}`, {
            duration: 2000,
            className: 'bg-amber/10 border-amber/30 text-amber',
          })
        }
      }
    }

    if (previousFilteredCount !== null && sortedItems.length !== previousFilteredCount) {
      setShowTrendIndicator(true)
      const timer = setTimeout(() => {
        setShowTrendIndicator(false)
        setPreviousFilteredCount(sortedItems.length)
      }, 3000)
      return () => clearTimeout(timer)
    }
    
    if (previousFilteredCount === null && sortedItems.length > 0) {
      setPreviousFilteredCount(sortedItems.length)
    }
  }, [sortedItems.length, previousItemCount, queueItems.length, previousFilteredCount])

  const handleEdit = (item: ScannedItem) => {
    setEditingItem(item)
  }

  const handleSaveEdit = (itemId: string, updates: Partial<ScannedItem>) => {
    onEdit(itemId, updates)
    toast.success('Item updated successfully')
  }

  const handleRemoveFilter = (filterKey: keyof AdvancedFilterOptions, value?: string) => {
    const newFilters = { ...advancedFilters }
    
    if (filterKey === 'categories' && value) {
      const currentCategories = newFilters.categories || []
      newFilters.categories = currentCategories.filter((c: string) => c !== value)
      if (newFilters.categories.length === 0) {
        delete newFilters.categories
      }
    } else if (filterKey === 'locations' && value) {
      const currentLocations = newFilters.locations || []
      newFilters.locations = currentLocations.filter((l: string) => l !== value)
      if (newFilters.locations.length === 0) {
        delete newFilters.locations
      }
    } else if (filterKey === 'tags' && value) {
      const currentTags = newFilters.tags || []
      newFilters.tags = currentTags.filter((t: string) => t !== value)
      if (newFilters.tags.length === 0) {
        delete newFilters.tags
      }
    } else {
      delete newFilters[filterKey]
    }
    
    setAdvancedFilters(newFilters)
  }

  const handleBulkApplyTags = (tagIds: string[]) => {
    selectedIds.forEach((itemId) => {
      const item = queueItems.find((i) => i.id === itemId)
      if (!item) return

      const currentTags = item.tags || []
      const newTags = Array.from(new Set([...currentTags, ...tagIds]))
      onEdit(itemId, { tags: newTags })
    })
  }

  const handleBulkRemoveTags = (tagIds: string[]) => {
    selectedIds.forEach((itemId) => {
      const item = queueItems.find((i) => i.id === itemId)
      if (!item) return

      const currentTags = item.tags || []
      const newTags = currentTags.filter((tagId) => !tagIds.includes(tagId))
      onEdit(itemId, { tags: newTags })
    })
  }

  const handleCreateTag = (newTag: ItemTag) => {
    setAllTags((prev) => [...(prev || []), newTag])
  }

  return (
    <div id="scr-queue" className="flex flex-col h-full">
      <ItemEditDialog
        item={editingItem}
        isOpen={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
        geminiService={geminiService}
      />
      <BulkTagOperations
        isOpen={bulkTagDialogOpen}
        onClose={() => setBulkTagDialogOpen(false)}
        selectedCount={selectedIds.size}
        availableTags={allTags || []}
        onApplyTags={handleBulkApplyTags}
        onRemoveTags={handleBulkRemoveTags}
        onCreateTag={handleCreateTag}
      />
      <div className="px-4 pt-4 pb-4 border-b border-s1">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black tracking-tight">LISTING QUEUE</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-t3 font-medium uppercase tracking-wider">
                  {queueItems.length} Items Total
                </p>
                {sortedItems.length !== queueItems.length && (
                  (() => {
                    const percentage = Math.round((sortedItems.length / queueItems.length) * 100)
                    const isHighVisibility = percentage >= 80
                    const isMediumVisibility = percentage >= 50 && percentage < 80
                    const isLowVisibility = percentage < 50
                    
                    const trendDirection = previousFilteredCount !== null 
                      ? sortedItems.length > previousFilteredCount 
                        ? 'up' 
                        : sortedItems.length < previousFilteredCount 
                          ? 'down' 
                          : 'same'
                      : 'same'
                    
                    const getTrendColor = () => {
                      if (!showTrendIndicator || trendDirection === 'same') {
                        if (isHighVisibility) return { bg: 'bg-green/15', text: 'text-green', border: 'border-green/30' }
                        if (isMediumVisibility) return { bg: 'bg-amber/15', text: 'text-amber', border: 'border-amber/30' }
                        return { bg: 'bg-red/15', text: 'text-red', border: 'border-red/30' }
                      }
                      
                      if (trendDirection === 'up') {
                        return { bg: 'bg-green/20', text: 'text-green', border: 'border-green/40' }
                      }
                      
                      return { bg: 'bg-red/20', text: 'text-red', border: 'border-red/40' }
                    }
                    
                    const colors = getTrendColor()
                    
                    return (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "h-5 px-2 text-[10px] font-bold border transition-all duration-300",
                          colors.bg,
                          colors.text,
                          colors.border,
                          showTrendIndicator && "animate-pulse shadow-sm",
                          showTrendIndicator && trendDirection === 'up' && "trend-indicator-up",
                          showTrendIndicator && trendDirection === 'down' && "trend-indicator-down"
                        )}
                      >
                        <span className="flex items-center gap-1">
                          {sortedItems.length} visible ({percentage}%)
                          {showTrendIndicator && trendDirection === 'up' && (
                            <TrendUp size={12} weight="bold" className="animate-bounce" />
                          )}
                          {showTrendIndicator && trendDirection === 'down' && (
                            <TrendDown size={12} weight="bold" className="animate-bounce" />
                          )}
                          {showTrendIndicator && trendDirection === 'same' && (
                            <Minus size={12} weight="bold" className="opacity-60" />
                          )}
                        </span>
                      </Badge>
                    )
                  })()
                )}
              </div>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToLocationInsights && queueItems.some(item => item.location) && (
              <Button
                onClick={onNavigateToLocationInsights}
                variant="outline"
                className="h-9 px-3 border-s2 hover:bg-s1 text-t2 font-bold text-xs transition-all flex-shrink-0"
              >
                <MapPin size={16} weight="bold" className="mr-1.5" />
                Locations
              </Button>
            )}
            {onNavigateToTagAnalytics && (allTags || []).length > 0 && (
              <Button
                onClick={onNavigateToTagAnalytics}
                variant="outline"
                className="h-9 px-3 border-s2 hover:bg-s1 text-t2 font-bold text-xs transition-all flex-shrink-0"
              >
                <ChartBar size={16} weight="bold" className="mr-1.5" />
                Tag ROI
              </Button>
            )}
            {unanalyzedItems.length > 0 && onBatchAnalyze && (
              <Button
                onClick={onBatchAnalyze}
                disabled={isBatchAnalyzing}
                className="bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white font-bold text-xs h-9 px-3 shadow-lg active:scale-95 transition-all flex-shrink-0"
              >
                <Lightning size={16} weight="fill" className="mr-1.5" />
                {isBatchAnalyzing ? 'Analyzing...' : `Analyze ${unanalyzedItems.length}`}
              </Button>
            )}
          </div>
        </div>
        
        <div className="px-0 mb-4">
          <div className="tab-bar">
            <button 
              onClick={() => setFilter('ALL')}
              className={cn('tab-btn', filter === 'ALL' && 'active')}
            >
              ALL
            </button>
            <button 
              onClick={() => setFilter('GO')}
              className={cn('tab-btn', filter === 'GO' && 'active')}
            >
              GO {goCount > 0 && `(${goCount})`}
            </button>
            <button 
              onClick={() => setFilter('PASS')}
              className={cn('tab-btn', filter === 'PASS' && 'active')}
            >
              PASS {passCount > 0 && `(${passCount})`}
            </button>
            <button 
              onClick={() => setFilter('PENDING')}
              className={cn('tab-btn', filter === 'PENDING' && 'active')}
            >
              PENDING {pendingCount > 0 && `(${pendingCount})`}
            </button>
          </div>
        </div>
        
        <div className="mb-3 relative">
          <MagnifyingGlass 
            size={18} 
            weight="bold" 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-s3 pointer-events-none" 
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, description, category..."
            className="h-10 pl-10 pr-10 bg-bg border-s2 text-t1 placeholder:text-t3 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 hover:text-t1 transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
        
        <div className="flex flex-col gap-2 mb-3">
          {availableLocations.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin size={16} weight="bold" className="text-s4 flex-shrink-0" />
              <Select
                value={advancedFilters.locations?.[0] || 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setAdvancedFilters({ ...advancedFilters, locations: undefined })
                  } else {
                    setAdvancedFilters({ ...advancedFilters, locations: [value] })
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs font-medium border-s2 bg-fg text-t1 flex-1">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Locations</SelectItem>
                  {availableLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id} className="text-xs">
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(allTags || []).length > 0 && (
            <div className="flex items-center gap-2">
              <Tag size={16} weight="bold" className="text-s4 flex-shrink-0" />
              <Select
                value={advancedFilters.tags?.[0] || 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setAdvancedFilters({ ...advancedFilters, tags: undefined })
                  } else {
                    setAdvancedFilters({ ...advancedFilters, tags: [value] })
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs font-medium border-s2 bg-fg text-t1 flex-1">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Tags</SelectItem>
                  {(allTags || []).map(tag => (
                    <SelectItem key={tag.id} value={tag.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <ArrowsDownUp size={16} weight="bold" className="text-s4 flex-shrink-0" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-9 text-xs font-medium border-s2 bg-fg text-t1 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual" className="text-xs">Manual Order</SelectItem>
                <SelectItem value="profit-desc" className="text-xs">Profit (High to Low)</SelectItem>
                <SelectItem value="profit-asc" className="text-xs">Profit (Low to High)</SelectItem>
                <SelectItem value="date-desc" className="text-xs">Date (Newest First)</SelectItem>
                <SelectItem value="date-asc" className="text-xs">Date (Oldest First)</SelectItem>
                <SelectItem value="category-asc" className="text-xs">Category (A to Z)</SelectItem>
                <SelectItem value="category-desc" className="text-xs">Category (Z to A)</SelectItem>
                <SelectItem value="tag-count-desc" className="text-xs">Tag Count (Most First)</SelectItem>
                <SelectItem value="tag-count-asc" className="text-xs">Tag Count (Least First)</SelectItem>
                <SelectItem value="tag-name-asc" className="text-xs">Tag Name (A to Z)</SelectItem>
                <SelectItem value="tag-name-desc" className="text-xs">Tag Name (Z to A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sortBy !== 'manual' && (
            <div className="bg-gradient-to-r from-b1/10 to-amber/10 border border-b1/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-b1 animate-pulse flex-shrink-0" />
              <span className="text-xs text-t1 font-bold flex-1">
                Active: {sortBy === 'profit-desc' && '↓ Profit (High to Low)'}
                {sortBy === 'profit-asc' && '↑ Profit (Low to High)'}
                {sortBy === 'date-desc' && '↓ Date (Newest First)'}
                {sortBy === 'date-asc' && '↑ Date (Oldest First)'}
                {sortBy === 'category-asc' && '↑ Category (A to Z)'}
                {sortBy === 'category-desc' && '↓ Category (Z to A)'}
                {sortBy === 'tag-count-desc' && '↓ Tag Count (Most First)'}
                {sortBy === 'tag-count-asc' && '↑ Tag Count (Least First)'}
                {sortBy === 'tag-name-asc' && '↑ Tag Name (A to Z)'}
                {sortBy === 'tag-name-desc' && '↓ Tag Name (Z to A)'}
              </span>
              <Button
                onClick={() => {
                  setSortBy('manual')
                  toast.success('Switched to manual ordering')
                }}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-bold text-b1 hover:bg-b1/20 hover:text-b1 flex-shrink-0"
              >
                <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                Reset
              </Button>
            </div>
          )}
          {sortBy !== 'manual' && onReorder && (
            <div className="bg-s1 border border-s2 rounded-lg px-3 py-2 flex items-center gap-2">
              <DotsSixVertical size={14} weight="bold" className="text-s3 flex-shrink-0" />
              <span className="text-xs text-t2 font-medium">
                Drag items to switch to manual ordering
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <AdvancedFilters
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              availableCategories={availableCategories}
              priceMin={priceRange.min}
              priceMax={priceRange.max}
            />
            <Button
              onClick={() => setPresetsOpen(true)}
              size="sm"
              variant="outline"
              className="h-9 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1 flex-1"
            >
              <BookmarkSimple size={14} weight="bold" className="mr-1.5" />
              Presets
            </Button>
          </div>
        </div>

        <FilterPresetsManager
          isOpen={presetsOpen}
          onClose={() => setPresetsOpen(false)}
          onApplyPreset={handleApplyPreset}
        />

        <ActiveFiltersSummary
          filters={advancedFilters}
          onRemoveFilter={handleRemoveFilter}
          className="mb-3"
        />
        
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSelectAll}
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
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
                  onClick={() => setBulkTagDialogOpen(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
                >
                  <Tag size={14} weight="bold" className="mr-1" />
                  Tags
                </Button>
                <Button
                  onClick={handleExportCSV}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
                >
                  <DownloadSimple size={14} weight="bold" className="mr-1" />
                  Export
                </Button>
                <Button
                  onClick={handleBulkRemove}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-medium border border-red/30 bg-transparent text-red hover:bg-red/10 hover:text-red"
                >
                  <Trash size={14} weight="bold" className="mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        )}
        
        {unanalyzedItems.length > 0 && (
          <div className="bg-blue-bg border border-b1/30 rounded-lg px-3 py-2.5 flex items-center gap-2 mt-3">
            <Lightning size={14} weight="fill" className="text-b1 flex-shrink-0" />
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
              {searchQuery ? '🔍' : filter === 'GO' ? '✅' : filter === 'PASS' ? '❌' : filter === 'PENDING' ? '⏳' : '📦'}
            </p>
          </div>
          <h2 className="text-lg font-semibold text-t1 mb-2">
            {searchQuery 
              ? 'No items found' 
              : queueItems.length === 0 
                ? 'Queue is empty' 
                : `No ${filter} items`
            }
          </h2>
          <p className="text-sm text-t2 max-w-xs">
            {searchQuery 
              ? `No items match "${searchQuery}". Try a different search term.`
              : queueItems.length === 0 
                ? 'Scan items and add GO decisions to your queue'
                : `Try selecting a different filter to view items`
            }
          </p>
          {searchQuery && (
            <Button
              onClick={() => setSearchQuery('')}
              variant="outline"
              className="mt-4 border-s2 text-t2 hover:bg-s1 hover:text-t1"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 py-4">
          {onReorder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {sortedItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      allTags={allTags || []}
                      onToggleSelect={handleToggleSelect}
                      onEdit={handleEdit}
                      onRemove={onRemove}
                      onCreateListing={onCreateListing}
                      onEditTags={(itemId, tags) => onEdit(itemId, { tags })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
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
                        <div className="flex items-center gap-4 text-xs font-mono text-s4 mb-2">
                          <span>Cost: ${item.purchasePrice.toFixed(2)}</span>
                          {item.estimatedSellPrice && (
                            <span>Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
                          )}
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mb-3">
                            <Tag size={12} weight="bold" className="text-s4 flex-shrink-0" />
                            {item.tags.map((tagId) => {
                              const tag = (allTags || []).find(t => t.id === tagId)
                              if (!tag) return null
                              return (
                                <Badge
                                  key={tagId}
                                  variant="outline"
                                  className="text-[10px] h-5 pl-2 pr-1 font-medium border flex items-center gap-1 group hover:opacity-80 transition-opacity"
                                  style={{
                                    borderColor: tag.color,
                                    backgroundColor: `${tag.color}15`,
                                    color: tag.color
                                  }}
                                >
                                  <span>{tag.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const updatedTags = item.tags?.filter(t => t !== tagId) || []
                                      onEdit(item.id, { tags: updatedTags })
                                      toast.success(`Removed tag: ${tag.name}`)
                                    }}
                                    className="flex items-center justify-center hover:opacity-70 transition-opacity"
                                    aria-label={`Remove ${tag.name} tag`}
                                  >
                                    <X size={10} weight="bold" />
                                  </button>
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEdit(item)}
                            variant="outline"
                            className="h-8 px-3 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
                          >
                            <PencilSimple size={14} weight="bold" className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => onCreateListing(item.id)}
                            className="flex-1 bg-b1 hover:bg-b2 text-white h-8 text-xs font-medium"
                          >
                            <ArrowRight size={14} weight="bold" className="mr-1" />
                            List
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemove(item.id)}
                            className="h-8 w-8 p-0 text-t2 hover:text-red hover:bg-red/10"
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
          )}

          {availableLocations.length > 0 && (
            <Collapsible 
              open={locationInsightsOpen} 
              onOpenChange={setLocationInsightsOpen}
              className="mt-6"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-12 px-4 border-s2 hover:bg-s1 text-t1 font-bold text-sm transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <span className="uppercase tracking-wide">Best Performing Stores</span>
                    <Badge 
                      variant="secondary" 
                      className="h-5 px-2 text-[10px] font-bold bg-b1/15 text-b1 border border-b1/30"
                    >
                      {availableLocations.length}
                    </Badge>
                  </div>
                  <CaretDown 
                    size={20} 
                    weight="bold" 
                    className={cn(
                      "transition-transform duration-200",
                      locationInsightsOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <LocationInsights items={queueItems} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </ScrollArea>
      )}
    </div>
  )
}
