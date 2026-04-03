import { useState, useEffect } from 'react'
import { Funnel, X, CaretDown, CalendarBlank, CurrencyDollar } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface AdvancedFilterOptions {
  priceRange?: {
    min: number
    max: number
  }
  profitMarginRange?: {
    min: number
    max: number
  }
  dateRange?: {
    start: number
    end: number
  }
  categories?: string[]
}

interface AdvancedFiltersProps {
  filters: AdvancedFilterOptions
  onFiltersChange: (filters: AdvancedFilterOptions) => void
  availableCategories?: string[]
  priceMin?: number
  priceMax?: number
  className?: string
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableCategories = [],
  priceMin = 0,
  priceMax = 1000,
  className
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<AdvancedFilterOptions>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const activeFilterCount = [
    filters.priceRange && (filters.priceRange.min > priceMin || filters.priceRange.max < priceMax),
    filters.profitMarginRange,
    filters.dateRange,
    filters.categories && filters.categories.length > 0
  ].filter(Boolean).length

  const handleApply = () => {
    onFiltersChange(localFilters)
    setIsOpen(false)
  }

  const handleClear = () => {
    const clearedFilters: AdvancedFilterOptions = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const handlePriceRangeChange = (values: number[]) => {
    setLocalFilters(prev => ({
      ...prev,
      priceRange: { min: values[0], max: values[1] }
    }))
  }

  const handleProfitMarginChange = (values: number[]) => {
    setLocalFilters(prev => ({
      ...prev,
      profitMarginRange: { min: values[0], max: values[1] }
    }))
  }

  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    const timestamp = new Date(value).getTime()
    setLocalFilters(prev => ({
      ...prev,
      dateRange: {
        start: type === 'start' ? timestamp : (prev.dateRange?.start || Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: type === 'end' ? timestamp : (prev.dateRange?.end || Date.now())
      }
    }))
  }

  const handleCategoryToggle = (category: string) => {
    setLocalFilters(prev => {
      const currentCategories = prev.categories || []
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category]
      
      return {
        ...prev,
        categories: newCategories.length > 0 ? newCategories : undefined
      }
    })
  }

  const formatDateForInput = (timestamp?: number) => {
    if (!timestamp) return ''
    return format(timestamp, 'yyyy-MM-dd')
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 px-3 gap-2 text-xs font-semibold border-s2 bg-fg hover:bg-s1 text-t2 hover:text-t1 transition-all relative",
            activeFilterCount > 0 && "border-b1 text-b1 hover:text-b1",
            className
          )}
        >
          <Funnel size={16} weight="bold" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="h-5 w-5 p-0 flex items-center justify-center bg-b1 text-white text-[10px] font-bold border-0">
              {activeFilterCount}
            </Badge>
          )}
          <CaretDown size={14} weight="bold" className={cn("transition-transform", isOpen && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[340px] p-0 bg-fg border-s2 shadow-2xl" 
        align="end"
        sideOffset={8}
      >
        <div className="p-4 border-b border-s1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Funnel size={18} weight="bold" className="text-b1" />
            <h3 className="font-black text-sm tracking-tight">ADVANCED FILTERS</h3>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={handleClear}
              className="text-xs font-semibold text-t3 hover:text-red transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="p-4 space-y-5 max-h-[500px] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={16} weight="bold" className="text-s4" />
              <Label className="text-xs font-bold text-t2 uppercase tracking-wider">Purchase Price Range</Label>
            </div>
            <div className="space-y-3">
              <Slider
                min={priceMin}
                max={priceMax}
                step={1}
                value={[
                  localFilters.priceRange?.min ?? priceMin,
                  localFilters.priceRange?.max ?? priceMax
                ]}
                onValueChange={handlePriceRangeChange}
                className="w-full"
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={localFilters.priceRange?.min ?? priceMin}
                    onChange={(e) => handlePriceRangeChange([
                      Number(e.target.value),
                      localFilters.priceRange?.max ?? priceMax
                    ])}
                    placeholder="Min"
                    className="h-9 text-xs bg-bg border-s2"
                  />
                </div>
                <span className="text-xs text-t3 font-medium">to</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={localFilters.priceRange?.max ?? priceMax}
                    onChange={(e) => handlePriceRangeChange([
                      localFilters.priceRange?.min ?? priceMin,
                      Number(e.target.value)
                    ])}
                    placeholder="Max"
                    className="h-9 text-xs bg-bg border-s2"
                  />
                </div>
              </div>
              <p className="text-[10px] text-t3 font-medium">
                ${localFilters.priceRange?.min ?? priceMin} - ${localFilters.priceRange?.max ?? priceMax}
              </p>
            </div>
          </div>

          <div className="h-px bg-s1" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={16} weight="bold" className="text-s4" />
              <Label className="text-xs font-bold text-t2 uppercase tracking-wider">Profit Margin %</Label>
            </div>
            <div className="space-y-3">
              <Slider
                min={0}
                max={100}
                step={5}
                value={[
                  localFilters.profitMarginRange?.min ?? 0,
                  localFilters.profitMarginRange?.max ?? 100
                ]}
                onValueChange={handleProfitMarginChange}
                className="w-full"
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={localFilters.profitMarginRange?.min ?? 0}
                    onChange={(e) => handleProfitMarginChange([
                      Number(e.target.value),
                      localFilters.profitMarginRange?.max ?? 100
                    ])}
                    placeholder="Min %"
                    className="h-9 text-xs bg-bg border-s2"
                  />
                </div>
                <span className="text-xs text-t3 font-medium">to</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={localFilters.profitMarginRange?.max ?? 100}
                    onChange={(e) => handleProfitMarginChange([
                      localFilters.profitMarginRange?.min ?? 0,
                      Number(e.target.value)
                    ])}
                    placeholder="Max %"
                    className="h-9 text-xs bg-bg border-s2"
                  />
                </div>
              </div>
              <p className="text-[10px] text-t3 font-medium">
                {localFilters.profitMarginRange?.min ?? 0}% - {localFilters.profitMarginRange?.max ?? 100}%
              </p>
            </div>
          </div>

          <div className="h-px bg-s1" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} weight="bold" className="text-s4" />
              <Label className="text-xs font-bold text-t2 uppercase tracking-wider">Date Range</Label>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] text-t3 font-medium mb-1 block">From</Label>
                <Input
                  type="date"
                  value={formatDateForInput(localFilters.dateRange?.start)}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="h-9 text-xs bg-bg border-s2"
                />
              </div>
              <div>
                <Label className="text-[10px] text-t3 font-medium mb-1 block">To</Label>
                <Input
                  type="date"
                  value={formatDateForInput(localFilters.dateRange?.end)}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="h-9 text-xs bg-bg border-s2"
                />
              </div>
            </div>
          </div>

          {availableCategories.length > 0 && (
            <>
              <div className="h-px bg-s1" />

              <div className="space-y-3">
                <Label className="text-xs font-bold text-t2 uppercase tracking-wider">Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => {
                    const isSelected = localFilters.categories?.includes(category)
                    return (
                      <Badge
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className={cn(
                          "cursor-pointer text-xs font-semibold px-3 py-1.5 transition-all border",
                          isSelected
                            ? "bg-b1 text-white border-b1 hover:bg-b2"
                            : "bg-transparent text-t2 border-s2 hover:bg-s1 hover:text-t1"
                        )}
                      >
                        {category}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-s1 flex gap-2">
          <Button
            onClick={handleClear}
            variant="outline"
            className="flex-1 h-9 text-xs font-bold border-s2 bg-transparent hover:bg-s1"
          >
            Reset
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 h-9 text-xs font-bold bg-b1 hover:bg-b2 text-white"
          >
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
