import { X } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import type { AdvancedFilterOptions } from './AdvancedFilters'
import { cn } from '@/lib/utils'

interface ActiveFiltersSummaryProps {
  filters: AdvancedFilterOptions
  onRemoveFilter: (filterKey: keyof AdvancedFilterOptions, value?: string) => void
  className?: string
}

export function ActiveFiltersSummary({ filters, onRemoveFilter, className }: ActiveFiltersSummaryProps) {
  const hasActiveFilters = 
    filters.priceRange || 
    filters.profitMarginRange || 
    filters.dateRange || 
    (filters.categories && filters.categories.length > 0)

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

      {filters.dateRange && (
        <Badge
          className="bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 text-xs font-semibold px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-all group"
          onClick={() => onRemoveFilter('dateRange')}
        >
          <span>
            {format(filters.dateRange.start, 'MMM d')} - {format(filters.dateRange.end, 'MMM d, yyyy')}
          </span>
          <X size={12} weight="bold" className="group-hover:scale-110 transition-transform" />
        </Badge>
      )}

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
    </div>
  )
}
