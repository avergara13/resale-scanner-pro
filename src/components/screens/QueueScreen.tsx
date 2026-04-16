import { useState, useMemo, useEffect, useCallback } from 'react'
import { Trash, Lightning, DownloadSimple, X, Tag, ChartBar, MapPin, DotsSixVertical, ArrowCounterClockwise, TrendUp, TrendDown, Minus, CaretDown, Package, Plus } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { SessionLiveBanner } from '@/components/SessionLiveBanner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { logActivity } from '@/lib/activity-log'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AdvancedFilters, type AdvancedFilterOptions } from '@/components/AdvancedFilters'
import { ActiveFiltersSummary } from '@/components/ActiveFiltersSummary'
import { FilterPresetsManager } from '../FilterPresetsManager'
import { BulkTagOperations } from '../BulkTagOperations'
import { LocationInsights } from '../LocationInsights'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { useSortFilterPreference } from '@/hooks/use-sort-filter-preference'
import { useAdvancedFilterPreference } from '@/hooks/use-advanced-filter-preference'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { cn } from '@/lib/utils'
import type { ScannedItem, CategoryPreset, ItemTag, Decision } from '@/types'
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
  onAddManualItem?: (item: ScannedItem) => void
  isBatchAnalyzing?: boolean
  geminiService?: GeminiService | null
  onNavigateToTagAnalytics?: () => void
  onNavigateToLocationInsights?: () => void
  onMarkAsSold?: (itemId: string, soldPrice: number, soldOn: 'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other') => void
  onDelist?: (itemId: string) => void
  personalSessionIds?: Set<string>
  onReanalyze?: (itemId: string) => void
  onBuyItem?: (id: string) => void
  /** WO-RSP-010: opens the in-app ListingBuilder (card body tap + edit) */
  onOpenListingBuilder?: (itemId: string) => void
  /** Quick-list: opens ListingBuilder with gate drawer pre-opened */
  onListItem?: (itemId: string) => void
  /** Item to scroll-to and flash-highlight (from Agent "View in Queue") */
  highlightItemId?: string | null
  /** Clear highlight after animation completes */
  onHighlightClear?: () => void
  /** Re-scan: return a BUY item to the scan pile for re-research */
  onReScanItem?: (id: string) => void
}

type FilterOption = 'ALL' | 'ITEMS' | 'LISTED'
type SortOption = 'profit-desc' | 'profit-asc' | 'date-desc' | 'date-asc' | 'category-asc' | 'category-desc' | 'tag-count-desc' | 'tag-count-asc' | 'tag-name-asc' | 'tag-name-desc' | 'manual'

interface SortableItemProps {
  item: ScannedItem
  isSelected: boolean
  allTags: ItemTag[]
  isPersonal?: boolean
  isHighlighted?: boolean
  onToggleSelect: (id: string) => void
  onRemove: (id: string) => void
  onCreateListing: (id: string) => void
  onEditTags: (itemId: string, tags: string[]) => void
  onOpenSoldDialog?: (item: ScannedItem) => void
  onDelist?: (itemId: string) => void
  onReanalyze?: (itemId: string) => void
  onBuyItem?: (id: string) => void
  onOpenListingBuilder?: (itemId: string) => void
  onListItem?: (itemId: string) => void
  onReScanItem?: (id: string) => void
}

function SortableItem({
  item,
  isSelected,
  allTags,
  isPersonal,
  isHighlighted,
  onToggleSelect,
  onRemove,
  onCreateListing,
  onEditTags,
  onOpenSoldDialog,
  onDelist,
  onReanalyze,
  onBuyItem,
  onOpenListingBuilder,
  onListItem,
  onReScanItem,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const [confirmDelete, setConfirmDelete] = useState(false)

  // Card state — determines left border accent + available actions
  const cardState: 'unoptimized' | 'ready' | 'live' = item.ebayListingId
    ? 'live'
    : item.optimizedListing
    ? 'ready'
    : 'unoptimized'

  // Gate completion score (7 required fields) — replaces old 6-field completion %
  const gateScore = useMemo(() => {
    if (item.decision !== 'BUY' || item.listingStatus === 'published') return null
    const l = item.optimizedListing
    const checks = [
      !!(l?.title || item.productName)?.trim() && ((l?.title || item.productName) || '').length <= 80,  // title
      !!(l?.condition || item.condition),                                                                // condition
      (l?.description || item.description || '').length >= 400,                                          // description
      (item.photoUrls?.length || item.additionalImageData?.length || item.imageData ? 1 : 0) >= 1,      // photo
      (l?.price || item.estimatedSellPrice || 0) > 0,                                                   // price
      !!(l?.itemSpecifics?.['Brand'] || item.productName?.match(/^([A-Z][a-zA-Z&]{1,19})(?:\s|$)/)?.[1]), // brand
      !!(l?.ebayCategoryId) && l?.ebayCategoryId !== '99',                                               // category
    ]
    return { passed: checks.filter(Boolean).length, total: 7 }
  }, [item])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: 'color-mix(in oklch, var(--fg) 88%, transparent)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  return (
    <Card
      ref={setNodeRef}
      id={`queue-item-${item.id}`}
      style={style}
      className={cn(
        "border overflow-hidden flex flex-col gap-0 p-0 py-0 transition-colors rounded-2xl border-l-[3px]",
        isSelected ? 'border-b1' : 'border-s2/60',
        // Left border accent by card state
        cardState === 'live' ? 'border-l-green' : cardState === 'ready' ? 'border-l-indigo-500' : 'border-l-amber',
        // Flash highlight from "View in Queue"
        isHighlighted && 'ring-2 ring-b1 ring-opacity-80 animate-pulse'
      )}
    >
      {/* ── Gate completion bar — scores 7 required fields ── */}
      {gateScore && (
        <div className="relative w-full h-1.5 flex-shrink-0" style={{ background: 'color-mix(in oklch, var(--s2) 40%, transparent)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(gateScore.passed / gateScore.total) * 100}%`,
              background: gateScore.passed >= 7
                ? 'var(--green)'
                : gateScore.passed >= 4
                ? 'var(--amber)'
                : 'var(--red)',
            }}
          />
        </div>
      )}

      {/* ── Info row ── */}
      <div className={cn(
        "p-3 flex gap-2.5 items-start",
        isSelected && "bg-accent-3/15"
      )}>
        {/* Control column: drag handle + checkbox */}
        <div className="flex flex-col gap-1 items-center justify-start pt-0.5 flex-shrink-0">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5 hover:bg-s1 rounded transition-colors"
            aria-label="Drag to reorder"
          >
            <DotsSixVertical size={12} weight="bold" className="text-s3" />
          </div>
          <label
            htmlFor={`select-${item.id}`}
            className="flex items-center justify-center w-8 h-8 -m-1.5 cursor-pointer"
          >
            <Checkbox
              id={`select-${item.id}`}
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(item.id)}
              className="w-3 h-3 border data-[state=checked]:bg-b1 data-[state=checked]:border-b1"
            />
          </label>
        </div>

        {/* Tappable zone: thumbnail + content → opens ListingBuilder */}
        <div
          className="flex gap-2.5 flex-1 min-w-0 cursor-pointer active:opacity-80 transition-opacity"
          role="button"
          tabIndex={0}
          onClick={() => onOpenListingBuilder?.(item.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenListingBuilder?.(item.id) }}
        >
        {/* Thumbnail — rounded-lg to match scan cards */}
        {(item.imageThumbnail || item.imageData) ? (
          <img
            src={item.imageThumbnail || item.imageData}
            alt={item.productName || 'Item'}
            className="w-14 h-14 object-cover object-center rounded-xl border border-s2/60 flex-shrink-0 self-start"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl border border-s2/60 flex-shrink-0 self-start bg-s1 flex items-center justify-center">
            <Package size={20} weight="duotone" className="text-s3" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title + margin badge */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-t1 text-[11px] line-clamp-2 leading-snug tracking-tight">
                {item.productName || 'Unknown Item'}
              </h3>
              {isPersonal && (
                <span className="text-[7px] font-bold bg-purple-500/15 text-purple-500 px-1 py-0.5 rounded flex-shrink-0 uppercase">Personal</span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {gateScore && (
                <span className={cn(
                  "font-mono font-bold text-[8px] px-1 py-0.5 rounded",
                  gateScore.passed >= 7 ? 'text-green' : gateScore.passed >= 4 ? 'text-amber' : 'text-red'
                )}>
                  {gateScore.passed}/{gateScore.total}
                </span>
              )}
              {item.profitMargin != null && isFinite(item.profitMargin) && (
                <span className={cn(
                  "font-mono font-bold text-[9px] px-1.5 py-0.5 rounded border",
                  item.profitMargin > 40
                    ? 'bg-green/10 text-green border-green/30'
                    : item.profitMargin > 25
                    ? 'bg-amber/10 text-amber border-amber/30'
                    : 'bg-red/10 text-red border-red/30'
                )}>
                  {item.profitMargin >= 0 ? '+' : ''}{item.profitMargin.toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Prices */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-t2">
            <span>Cost ${item.purchasePrice.toFixed(2)}</span>
            {item.estimatedSellPrice != null && item.estimatedSellPrice > 0 ? (
              <>
                <span className="text-s3">→</span>
                <span>Sell ${item.estimatedSellPrice.toFixed(2)}</span>
              </>
            ) : (
              <span className="text-s3">Sell —</span>
            )}
          </div>

          {/* Card state pill + gate score */}
          <div className="flex items-center gap-1.5">
            {cardState === 'live' ? (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border bg-green/10 text-green border-green/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
                </span>
                eBay Live
              </span>
            ) : cardState === 'ready' ? (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                Ready to List
              </span>
            ) : item.decision === 'BUY' ? (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border bg-amber/10 text-amber border-amber/30">
                Needs Optimization
              </span>
            ) : null}
            {gateScore && (
              <span className={cn(
                "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full",
                gateScore.passed >= 7 ? 'text-green' : gateScore.passed >= 4 ? 'text-amber' : 'text-red'
              )}>
                {gateScore.passed}/{gateScore.total}
              </span>
            )}
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-0.5">
              <Tag size={10} weight="bold" className="text-s4 flex-shrink-0" />
              {item.tags.map((tagId) => {
                const tag = (allTags || []).find(t => t.id === tagId)
                if (!tag) return null
                return (
                  <Badge
                    key={tagId}
                    variant="outline"
                    className="text-[8px] h-[16px] pl-1 pr-0.5 font-medium border flex items-center gap-0.5 hover:opacity-80 transition-opacity"
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
                        logActivity(`Removed tag: ${tag.name}`)
                      }}
                      className="flex items-center justify-center hover:opacity-70 transition-opacity p-0.5"
                      aria-label={`Remove ${tag.name} tag`}
                    >
                      <X size={8} weight="bold" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
        </div>{/* close tappable zone */}
      </div>

      {/* ── Action bar — simplified: Optimize | List | Delete ── */}
      <div className="px-3 py-2 flex items-center gap-1.5">

        {/* Published items: Sold + Delist */}
        {item.listingStatus === 'published' && onOpenSoldDialog ? (
          <>
            <button
              onClick={() => onOpenSoldDialog(item)}
              aria-label="Mark as sold"
              className="h-8 px-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white rounded-full active:scale-95 transition-all"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', background: 'linear-gradient(135deg, var(--green) 0%, color-mix(in oklch, var(--green) 80%, var(--b1)) 100%)' }}
            >
              Sold
            </button>
            {onDelist && (
              <button
                onClick={() => onDelist(item.id)}
                title="Delist"
                aria-label="Delist item"
                className="h-8 w-8 flex items-center justify-center rounded-full text-red/60 bg-red/10 hover:bg-red/20 active:scale-95 transition-all"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </>
        ) : item.decision === 'BUY' ? (
          <>
            {/* Optimize */}
            <button
              onClick={() => onCreateListing(item.id)}
              aria-label={item.optimizedListing ? "Re-optimize listing" : "Optimize listing"}
              className={cn(
                "h-8 px-3 flex items-center justify-center gap-1 text-[11px] font-bold rounded-full active:scale-95 transition-all",
                !item.optimizedListing ? "text-white bg-b1 hover:bg-b2" : "text-t2 bg-s1/80 hover:bg-s2"
              )}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <Lightning size={12} weight="bold" />
              Optimize
            </button>
            {/* List — quick-list path with gate pre-opened */}
            {item.optimizedListing && !item.ebayListingId && onListItem && (
              <button
                onClick={() => onListItem(item.id)}
                aria-label="List on eBay"
                className="h-8 px-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white rounded-full active:scale-95 transition-all"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' }}
              >
                List
              </button>
            )}
            {/* eBay LIVE */}
            {item.ebayListingId && (
              <a
                href={`https://www.ebay.com/itm/${item.ebayListingId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View eBay listing"
                className="h-8 px-3 flex items-center justify-center gap-1 text-[10px] font-bold text-white rounded-full active:scale-95 transition-all"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', background: 'color-mix(in oklch, var(--green) 80%, var(--b1))' }}
              >
                eBay LIVE
              </a>
            )}
          </>
        ) : null}

        {/* Re-scan — return to scan pile for re-research (not available once live on eBay) */}
        {onReScanItem && !item.ebayListingId && (
          <button
            onClick={() => onReScanItem(item.id)}
            aria-label="Return to scan pile"
            className="h-8 px-2.5 flex items-center justify-center gap-1 text-[10px] font-bold text-amber rounded-full bg-amber/10 hover:bg-amber/20 active:scale-95 transition-all"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <ArrowCounterClockwise size={12} weight="bold" />
            Re-scan
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(v => !v)}
          title="Delete"
          aria-label="Delete item"
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-full transition-all active:scale-95',
            confirmDelete ? 'text-red bg-red/10' : 'text-t3 bg-s1/80 hover:bg-s2'
          )}
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <Trash size={13} weight="bold" />
        </button>
      </div>
      {/* More options panel — decision override + remove */}
      {confirmDelete && (
        <div className="px-3 pb-3 pt-2 border-t border-s2/60">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-t3 leading-tight">Remove this item from queue?</p>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] font-semibold text-t3 hover:text-t1 px-3 py-1 rounded-full bg-s1/80 hover:bg-s2 transition-all active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onRemove(item.id); setConfirmDelete(false) }}
                className="text-[10px] font-bold text-white px-3 py-1 rounded-full bg-red hover:bg-red/90 transition-all active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function QueueScreen({ queueItems, onRemove, onCreateListing, onEdit, onReorder, onBatchAnalyze, onAddManualItem, isBatchAnalyzing, geminiService, onNavigateToTagAnalytics, onNavigateToLocationInsights, onMarkAsSold, onDelist, personalSessionIds, onReanalyze, onBuyItem, onOpenListingBuilder, onListItem, highlightItemId, onHighlightClear, onReScanItem }: QueueScreenProps) {
  const { sortBy, filter, setSortBy, setFilter } = useSortFilterPreference<SortOption, FilterOption>(
    'queue-screen',
    'manual',
    'ALL'
  )
  const { filters: advancedFilters, setFilters: setAdvancedFilters } = useAdvancedFilterPreference('queue-screen')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [allTags, setAllTags] = useKV<ItemTag[]>('all-tags', [])
  const [previousItemCount, setPreviousItemCount] = useState<number>(queueItems.length)
  const [previousFilteredCount, setPreviousFilteredCount] = useState<number | null>(null)
  const [soldDialogItemId, setSoldDialogItemId] = useState<string | null>(null)
  const [soldPrice, setSoldPrice] = useState('')
  const [soldMarketplace, setSoldMarketplace] = useState<'ebay' | 'mercari' | 'poshmark' | 'facebook' | 'whatnot' | 'other'>('ebay')
  const [showTrendIndicator, setShowTrendIndicator] = useState(false)
  const [locationInsightsOpen, setLocationInsightsOpen] = useState(false)

  // Scroll-to + flash-highlight when arriving from "View in Queue"
  const [flashId, setFlashId] = useState<string | null>(null)
  useEffect(() => {
    if (!highlightItemId) return
    // Small delay to let the screen render first
    const timer = setTimeout(() => {
      const el = document.getElementById(`queue-item-${highlightItemId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setFlashId(highlightItemId)
        setTimeout(() => setFlashId(null), 1500)
      }
      onHighlightClear?.()
    }, 200)
    return () => clearTimeout(timer)
  }, [highlightItemId, onHighlightClear])

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
        // silent
      }
      
      onReorder(reorderedItems)
      // silent
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
      const validFilters: FilterOption[] = ['ALL', 'ITEMS', 'LISTED']
      const val = preset.filters.decision[0]
      setFilter(validFilters.includes(val as FilterOption) ? (val as FilterOption) : 'ALL')
    } else {
      setFilter('ALL')
    }

    if (preset.sortBy && preset.sortOrder) {
      const candidate = `${preset.sortBy}-${preset.sortOrder}`
      const validSorts: SortOption[] = ['profit-desc','profit-asc','date-desc','date-asc','category-asc','category-desc','tag-count-desc','tag-count-asc','tag-name-asc','tag-name-desc','manual']
      setSortBy(validSorts.includes(candidate as SortOption) ? (candidate as SortOption) : 'manual')
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
  
  // Statuses that belong in Sold tab — never show in queue
  const DONE_STATUSES = ['sold', 'shipped', 'completed', 'returned', 'delisted']

  const filteredItems = queueItems.filter(item => {
    // Exclude items that have moved to the Sold tab or been delisted
    if (DONE_STATUSES.includes(item.listingStatus ?? '')) {
      return false
    }

    // Listing Queue only shows BUY items — MAYBE/PENDING/PASS belong in the scan pile or session history
    if (item.decision === 'MAYBE' || item.decision === 'PENDING' || item.decision === 'PASS') return false

    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'ITEMS' && item.decision === 'BUY' && item.listingStatus !== 'published') ||
      (filter === 'LISTED' && item.listingStatus === 'published')
    
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
      case 'tag-name-asc':
      case 'tag-name-desc': {
        const getName = (tags?: string[]) =>
          (allTags || []).find(t => t.id === tags?.[0])?.name || ''
        const cmp = getName(a.tags).localeCompare(getName(b.tags))
        return sortBy === 'tag-name-asc' ? cmp : -cmp
      }
      default:
        return 0
    }
  })
  const unanalyzedItems = queueItems.filter(item => !item.productName || item.productName === 'Quick Draft')
  
  // Badge counts must use the same exclusions as filteredItems so the number
  // on the tab always equals the number of cards that actually render.
  const itemsCount = queueItems.filter(item =>
    !DONE_STATUSES.includes(item.listingStatus ?? '') &&
    item.decision === 'BUY' &&
    item.listingStatus !== 'published'
  ).length
  const listedCount = queueItems.filter(item =>
    item.listingStatus === 'published'
  ).length
  const hasActiveAdvancedFilters =
    (advancedFilters.tags?.length ?? 0) > 0 ||
    (advancedFilters.locations?.length ?? 0) > 0 ||
    (advancedFilters.categories?.length ?? 0) > 0 ||
    !!advancedFilters.profitMarginRange ||
    !!advancedFilters.dateRange

  const hasActiveFilters = searchQuery.trim() !== ''
    || sortBy !== 'manual'
    || hasActiveAdvancedFilters

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
    
    logActivity(`Removed ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`)
    setSelectedIds(new Set())
  }

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
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
    
    logActivity(`Exported ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} to CSV`)
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
          logActivity(`📈 Showing ${diffAmount} more item${itemText}`)
        } else {
          logActivity(`📉 Showing ${diffAmount} fewer item${itemText}`, 'info')
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


  const handleSaveEdit = (itemId: string, updates: Partial<ScannedItem>) => {
    onEdit(itemId, updates)
    // silent
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

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 800))

    try {
      const currentQueue = await window.spark?.kv?.get<ScannedItem[]>('queue')
      const currentTags = await window.spark?.kv?.get<ItemTag[]>('all-tags')

      if (currentQueue && queueItems !== currentQueue) {
        // silent refresh
      } else {
        // silent — already up to date
      }
    } catch {
      // Spark runtime not available
    }
  }, [queueItems])

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
      id="scr-queue"
      className="h-full w-full overflow-y-auto overflow-x-hidden scrollable-content overscroll-y-contain"
    >
      {/* Live session banner — sticky at top of scroll container */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <SessionLiveBanner />
      </div>
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />
      {/* GPU-composited transform wrapper — replaces paddingTop reflow */}
      <div
        style={{
          transform: `translateY(${isPulling ? pullDistance : isRefreshing ? 60 : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: isPulling || isRefreshing ? 'transform' : 'auto',
        }}
      >
      <BulkTagOperations
        isOpen={bulkTagDialogOpen}
        onClose={() => setBulkTagDialogOpen(false)}
        selectedCount={selectedIds.size}
        availableTags={allTags || []}
        onApplyTags={handleBulkApplyTags}
        onRemoveTags={handleBulkRemoveTags}
        onCreateTag={handleCreateTag}
      />

      {/* Mark as Sold Dialog */}
      <Dialog open={soldDialogItemId !== null} onOpenChange={(open) => { if (!open) { setSoldDialogItemId(null); setSoldPrice(''); setSoldMarketplace('ebay') } }}>
        <DialogContent className="max-w-sm bg-card border-s1 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-t1">
              <Tag size={20} weight="duotone" className="text-green" />
              Mark as Sold
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wide block mb-1.5">Sold Price</label>
              <Input
                type="number"
                value={soldPrice}
                onChange={e => setSoldPrice(e.target.value)}
                placeholder="0.00"
                className="h-10 text-base font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wide block mb-1.5">Marketplace</label>
              <div className="flex flex-wrap gap-1.5">
                {(['ebay', 'mercari', 'poshmark', 'facebook', 'whatnot', 'other'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setSoldMarketplace(m)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all',
                      soldMarketplace === m ? 'bg-b1 text-white' : 'bg-s1 text-t3 hover:bg-s2'
                    )}
                  >
                    {m === 'ebay' ? 'eBay' : m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 text-white h-10 font-bold active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg, var(--green) 0%, color-mix(in oklch, var(--green) 80%, var(--b1)) 100%)' }}
                onClick={() => {
                  if (soldDialogItemId && onMarkAsSold) {
                    const price = parseFloat(soldPrice) || 0
                    onMarkAsSold(soldDialogItemId, price, soldMarketplace)
                    setSoldDialogItemId(null)
                    setSoldPrice('')
                  }
                }}
              >
                Confirm Sale
              </Button>
              <Button variant="outline" className="h-10" onClick={() => setSoldDialogItemId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md bg-card border-s1 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-t1">
              <Package size={20} weight="duotone" className="text-b1" />
              Add Item Manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-t2 uppercase mb-1 block">Product Name *</label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Nike Air Max 90"
                className="bg-bg border-s2"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-t2 uppercase mb-1 block">Buy Price ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-bg border-s2 font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-t2 uppercase mb-1 block">Category</label>
                <Input
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  placeholder="e.g. Electronics"
                  className="bg-bg border-s2"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-t2 uppercase mb-1 block">Notes (Optional)</label>
              <Input
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Condition, details, etc."
                className="bg-bg border-s2"
              />
            </div>
            <Button
              onClick={() => {
                if (!manualName.trim() || !onAddManualItem) return
                const item: ScannedItem = {
                  id: Date.now().toString(),
                  timestamp: Date.now(),
                  purchasePrice: parseFloat(manualPrice) || 0,
                  productName: manualName.trim(),
                  description: manualNotes.trim() || undefined,
                  category: manualCategory.trim() || 'General',
                  decision: 'PENDING',
                  inQueue: true,
                }
                onAddManualItem(item)
                setManualName('')
                setManualPrice('')
                setManualCategory('')
                setManualNotes('')
                setShowAddDialog(false)
              }}
              disabled={!manualName.trim()}
              className="w-full bg-b1 hover:bg-b2 text-white font-bold h-11"
            >
              <Plus size={18} weight="bold" className="mr-2" />
              Add to Queue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="px-3 sm:px-4 md:px-5 pt-2 pb-0 border-b border-s1 bg-fg sticky top-0 z-10 shadow-sm">
        {/* Action buttons — only rendered when at least one is visible */}
        {((onNavigateToLocationInsights && queueItems.some(item => item.location)) ||
          (onNavigateToTagAnalytics && (allTags || []).length > 0) ||
          unanalyzedItems.length > 0) && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2">
            {onNavigateToLocationInsights && queueItems.some(item => item.location) && (
              <Button
                onClick={onNavigateToLocationInsights}
                variant="outline"
                className="h-8 px-2 sm:px-3 border-s2 hover:bg-s1 text-t2 font-bold text-[10px] sm:text-xs transition-all flex-shrink-0"
              >
                <MapPin size={14} weight="bold" className="mr-1" />
                Locations
              </Button>
            )}
            {onNavigateToTagAnalytics && (allTags || []).length > 0 && (
              <Button
                onClick={onNavigateToTagAnalytics}
                variant="outline"
                className="h-8 px-2 sm:px-3 border-s2 hover:bg-s1 text-t2 font-bold text-[10px] sm:text-xs transition-all flex-shrink-0"
              >
                <ChartBar size={14} weight="bold" className="mr-1" />
                Tag ROI
              </Button>
            )}
            {unanalyzedItems.length === 1 && onReanalyze && (
              <Button
                onClick={() => onReanalyze(unanalyzedItems[0].id)}
                disabled={isBatchAnalyzing}
                className="bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white font-bold text-[10px] sm:text-xs h-8 px-2 sm:px-3 shadow-lg active:scale-95 transition-all flex-shrink-0"
              >
                <Lightning size={14} weight="fill" className="mr-1" />
                {isBatchAnalyzing ? 'Analyzing...' : 'Analyze 1'}
              </Button>
            )}
            {unanalyzedItems.length > 1 && onBatchAnalyze && (
              <Button
                onClick={onBatchAnalyze}
                disabled={isBatchAnalyzing}
                className="bg-gradient-to-br from-b1 to-amber hover:opacity-90 text-white font-bold text-[10px] sm:text-xs h-8 px-2 sm:px-3 shadow-lg active:scale-95 transition-all flex-shrink-0"
              >
                <Lightning size={14} weight="fill" className="mr-1" />
                {isBatchAnalyzing ? 'Analyzing...' : `Analyze ${unanalyzedItems.length}`}
              </Button>
            )}
          </div>
        )}

        <div className="px-0 mb-2">
          <div className="tab-bar">
            <button
              onClick={() => setFilter('ALL')}
              className={cn('tab-btn', filter === 'ALL' && 'active')}
            >
              <span>All</span>
            </button>
            <button
              onClick={() => setFilter('ITEMS')}
              className={cn('tab-btn', filter === 'ITEMS' && 'active')}
            >
              <span>Items{itemsCount > 0 && ` (${itemsCount})`}</span>
            </button>
            <button
              onClick={() => setFilter('LISTED')}
              className={cn('tab-btn', filter === 'LISTED' && 'active')}
            >
              <span>✅ Listed{listedCount > 0 && ` (${listedCount})`}</span>
            </button>
          </div>
        </div>
        
        {/* Single action strip — Filters + Presets (left), Select All (right) */}
        <div
          className="border-b border-s1/60"
          style={{
            background: 'color-mix(in oklch, var(--fg) 85%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            paddingLeft: '12px',
            paddingRight: '12px',
          }}
        >
          <div className="flex items-center gap-2 flex-1">
            <AdvancedFilters
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              availableCategories={availableCategories}
              priceMin={priceRange.min}
              priceMax={priceRange.max}
              showPresets={false}
              className="h-auto px-0 text-[9px] font-bold text-t1 uppercase tracking-wide border-0 bg-transparent shadow-none rounded-md hover:bg-transparent hover:text-t1 hover:opacity-70"
            />
            <button
              onClick={() => setPresetsOpen(true)}
              className="text-[9px] font-bold text-t1 uppercase tracking-wide transition-opacity active:opacity-50 flex-shrink-0 hover:opacity-70"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              Presets
            </button>
          </div>
          <button
            onClick={handleSelectAll}
            className="text-[9px] font-bold text-t1 uppercase tracking-wide transition-opacity active:opacity-50 flex-shrink-0"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
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

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-s1/60">
            <span className="text-xs font-medium text-b1 flex-shrink-0">
              {selectedIds.size} selected
            </span>
            <Button
              onClick={() => setBulkTagDialogOpen(true)}
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
            >
              <Tag size={12} weight="bold" className="mr-1" />
              Tags
            </Button>
            <Button
              onClick={handleExportCSV}
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium border border-s2 bg-transparent text-t2 hover:bg-s1 hover:text-t1"
            >
              <DownloadSimple size={12} weight="bold" className="mr-1" />
              Export
            </Button>
            <Button
              onClick={handleBulkRemove}
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium border border-red/30 bg-transparent text-red hover:bg-red/10 hover:text-red"
            >
              <Trash size={12} weight="bold" className="mr-1" />
              Remove
            </Button>
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
        <div className="flex flex-col items-center justify-center min-h-[58vh] px-6 text-center">
          {queueItems.length === 0 && onAddManualItem ? (
            <>
              <button
                onClick={() => setShowAddDialog(true)}
                className="w-24 h-24 rounded-3xl bg-gradient-to-br from-b1 to-b2 flex items-center justify-center mb-5 shadow-lg active:scale-95 transition-all"
                style={{ boxShadow: 'var(--send-glow)', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <Package size={44} weight="duotone" className="text-white" />
              </button>
              <h2 className="text-xl font-bold text-t1 mb-2">Queue is empty</h2>
              <p className="text-sm text-t2 max-w-[220px] leading-relaxed">
                Tap the icon above to add an item manually, or use the camera to scan one
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-3xl bg-s1 flex items-center justify-center mb-5">
                <p className="text-3xl">
                  {searchQuery ? '🔍' : filter === 'LISTED' ? '✅' : '📦'}
                </p>
              </div>
              <h2 className="text-xl font-bold text-t1 mb-2">
                {searchQuery
                  ? 'No items found'
                  : filter === 'LISTED'
                    ? 'Nothing listed yet'
                    : 'No items to list'
                }
              </h2>
              <p className="text-sm text-t2 max-w-[220px] leading-relaxed">
                {searchQuery
                  ? `No items match "${searchQuery}". Try a different search term.`
                  : filter === 'LISTED'
                    ? 'Items will appear here once pushed to eBay or Notion'
                    : 'Try selecting a different filter to view items'}
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
            </>
          )}
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 pt-3 sm:pt-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
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
                <div className="space-y-2 sm:space-y-3">
                  {sortedItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      allTags={allTags || []}
                      isPersonal={!!item.sessionId && !!personalSessionIds?.has(item.sessionId)}
                      isHighlighted={flashId === item.id}
                      onToggleSelect={handleToggleSelect}
                      onRemove={onRemove}
                      onCreateListing={onCreateListing}
                      onEditTags={(itemId, tags) => onEdit(itemId, { tags })}
                      onOpenSoldDialog={onMarkAsSold ? (soldItem) => {
                        setSoldDialogItemId(soldItem.id)
                        setSoldPrice(soldItem.estimatedSellPrice ? soldItem.estimatedSellPrice.toString() : '')
                        setSoldMarketplace('ebay')
                      } : undefined}
                      onDelist={onDelist}
                      onReanalyze={onReanalyze}
                      onBuyItem={onBuyItem}
                      onOpenListingBuilder={onOpenListingBuilder}
                      onListItem={onListItem}
                      onReScanItem={onReScanItem}
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
                    className={cn(
                      "p-2 sm:p-3 md:p-4 border transition-colors",
                      isSelected ? 'border-b1 bg-accent-3/40' : 'border-s2'
                    )}
                  >
                    <div className="flex gap-1.5 sm:gap-3 md:gap-3.5">
                      <div className="flex flex-col gap-2 items-center justify-start pt-0.5 flex-shrink-0">
                        <label
                          htmlFor={`select-bulk-${item.id}`}
                          className="flex items-center justify-center w-8 h-8 -m-1.5 cursor-pointer"
                        >
                          <Checkbox
                            id={`select-bulk-${item.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(item.id)}
                            className="w-3 h-3 border data-[state=checked]:bg-b1 data-[state=checked]:border-b1"
                          />
                        </label>
                      </div>
                      {(item.imageThumbnail || item.imageData) && (
                        <img
                          src={item.imageThumbnail || item.imageData}
                          alt={item.productName || 'Item'}
                          className="w-14 h-14 sm:w-[72px] sm:h-[72px] md:w-20 md:h-20 object-cover object-center rounded-md border border-s2 flex-shrink-0 self-start"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5 md:mb-2.5">
                          <h3 className="font-bold text-t1 text-[11px] sm:text-sm md:text-base line-clamp-2 leading-snug tracking-tight">
                            {item.productName || 'Unknown Item'}
                          </h3>
                          {item.profitMargin != null && isFinite(item.profitMargin) && (
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
                              {item.profitMargin >= 0 ? '+' : ''}{item.profitMargin.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-4 text-[10px] sm:text-xs font-mono text-s4 mb-1 sm:mb-2">
                          <span>Cost: ${item.purchasePrice.toFixed(2)}</span>
                          {item.estimatedSellPrice != null && item.estimatedSellPrice > 0
                            ? <span>Sell: ${item.estimatedSellPrice.toFixed(2)}</span>
                            : <span className="text-s3">Sell: —</span>
                          }
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
                                      logActivity(`Removed tag: ${tag.name}`)
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
                        <div className="flex gap-1 items-center mt-1 md:mt-1.5">
                          {item.decision === 'BUY' && (
                            <Button
                              size="sm"
                              onClick={() => onCreateListing(item.id)}
                              aria-label={item.optimizedListing ? "Re-optimize" : "Optimize"}
                              className={cn(
                                "h-7 md:h-8 text-[11px] md:text-xs font-semibold",
                                !item.optimizedListing ? "flex-1 bg-b1 hover:bg-b2 text-white" : "px-3 text-t2 bg-s1/80 hover:bg-s2"
                              )}
                            >
                              Optimize
                            </Button>
                          )}
                          {item.decision === 'BUY' && item.optimizedListing && !item.ebayListingId && onListItem && (
                            <Button
                              size="sm"
                              onClick={() => onListItem(item.id)}
                              aria-label="List on eBay"
                              className="h-7 md:h-8 text-[11px] md:text-xs font-bold text-white"
                              style={{ background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' }}
                            >
                              List
                            </Button>
                          )}
                          {onReScanItem && !item.ebayListingId && (
                            <button
                              onClick={() => onReScanItem(item.id)}
                              aria-label="Return to scan pile"
                              className="h-7 md:h-8 px-2.5 flex items-center justify-center gap-1 text-[10px] font-bold text-amber rounded-full bg-amber/10 hover:bg-amber/20 active:scale-95 transition-all"
                              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                            >
                              <ArrowCounterClockwise size={12} weight="bold" />
                              Re-scan
                            </button>
                          )}
                          <div className="flex-1" />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemove(item.id)}
                            title="Remove"
                            aria-label="Remove item"
                            className="h-7 w-7 md:h-8 md:w-8 p-0 text-t2 hover:text-red hover:bg-red/10"
                          >
                            <Trash size={13} weight="bold" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {availableLocations.length > 0 && (() => {
            const totalProfit = queueItems
              .filter(item => item.location && item.decision === 'BUY' && (!item.sessionId || !personalSessionIds?.has(item.sessionId)))
              .reduce((sum, item) => sum + ((item.estimatedSellPrice || 0) - item.purchasePrice), 0)
            
            const avgProfitPerStore = availableLocations.length > 0 
              ? totalProfit / availableLocations.length 
              : 0
            
            return (
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
                      <Badge 
                        variant="secondary" 
                        className="h-5 px-2 text-[10px] font-bold bg-green/15 text-green border border-green/30"
                      >
                        ${totalProfit.toFixed(0)}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className="h-5 px-2 text-[10px] font-bold bg-amber/15 text-amber border border-amber/30"
                      >
                        ~${avgProfitPerStore.toFixed(0)}/store
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
            )
          })()}
        </div>
      )}
      </div> {/* end transform wrapper */}
    </div>
  )
}
