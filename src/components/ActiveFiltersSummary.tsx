import { X } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { useKV } from '@github/spark/hooks'
import type { AdvancedFilterOptions } from './AdvancedFilters'
import type { ItemTag } from '@/types'
import { cn } from '@/lib/utils'

// Guards against `RangeError: Invalid time value` from date-fns when a
// dateRange loaded from persisted storage (or a partial preset) is missing
// start/end or contains NaN. Returns null if the value can't be formatted.
function safeFormat(ts: unknown, fmt: string): string | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  try {
    return format(d, fmt)
  } catch {
    return null
  }
}

interface ActiveFiltersSummaryProps {
  filters: AdvancedFilterOptions
  onRemoveFilter: (filterKey: keyof AdvancedFilterOptions, value?: string) => void
  className?: string
}

export function ActiveFiltersSummary({ filters, onRemoveFilter, className }: ActiveFiltersSummaryProps) {
  const [allTags] = useKV<ItemTag[]>('all-tags', [])

  const hasActiveFilters = 
    filters.priceRange || 
    filters.profitMarginRange || 
    filters.dateRange || 
    (filters.categories && filters.categories.length > 0) ||
    (filters.tags && filters.tags.length > 0)

  if (!hasActiveFilters) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {filters.priceRange && (
        <Badge
          className="bg-b1/10 text-b1 border border-b1/30 hover:bg-b1/20 text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
          onClick={() => onRemoveFilter('priceRange')}
        >
          <span>Price: ${filters.priceRange.min} - ${filters.priceRange.max}</span>
          <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
        </Badge>
      )}

      {filters.profitMarginRange && (
        <Badge
          className="bg-green/10 text-green border border-green/30 hover:bg-green/20 text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
          onClick={() => onRemoveFilter('profitMarginRange')}
        >
          <span>Profit: {filters.profitMarginRange.min}% - {filters.profitMarginRange.max}%</span>
          <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
        </Badge>
      )}

      {filters.dateRange && (() => {
        const startLabel = safeFormat(filters.dateRange.start, 'MMM d')
        const endLabel = safeFormat(filters.dateRange.end, 'MMM d, yyyy')
        // Drop the badge entirely if neither endpoint is valid — better than
        // crashing the whole screen on a corrupt persisted filter.
        if (!startLabel && !endLabel) return null
        const label = startLabel && endLabel
          ? `${startLabel} - ${endLabel}`
          : (startLabel || endLabel)
        return (
          <Badge
            className="bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
            onClick={() => onRemoveFilter('dateRange')}
          >
            <span>{label}</span>
            <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
          </Badge>
        )
      })()}

      {filters.categories && filters.categories.map((category) => (
        <Badge
          key={category}
          className="bg-t4 text-t1 border border-s2 hover:bg-s1 text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
          onClick={() => onRemoveFilter('categories', category)}
        >
          <span>{category}</span>
          <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
        </Badge>
      ))}

      {filters.tags && filters.tags.map((tagId) => {
        const tag = (allTags || []).find(t => t.id === tagId)
        if (!tag) return null
        return (
          <Badge
            key={tagId}
            className="text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
            style={{
              backgroundColor: `${tag.color}15`,
              borderColor: tag.color,
              color: tag.color,
              border: '1px solid'
            }}
            onClick={() => onRemoveFilter('tags', tagId)}
          >
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: tag.color }}
            />
            <span>{tag.name}</span>
            <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
          </Badge>
        )
      })}
    </div>
  )
}
