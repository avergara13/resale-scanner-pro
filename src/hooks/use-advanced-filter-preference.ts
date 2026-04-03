import { useKV } from '@github/spark/hooks'
import type { AdvancedFilterOptions } from '@/components/AdvancedFilters'

export function useAdvancedFilterPreference(
  screenKey: string,
  defaultFilters: AdvancedFilterOptions = {}
) {
  const [filters, setFilters] = useKV<AdvancedFilterOptions>(
    `advanced-filters-${screenKey}`,
    defaultFilters
  )

  const updateFilters = (newFilters: AdvancedFilterOptions) => {
    setFilters(newFilters)
  }

  const clearFilters = () => {
    setFilters({})
  }

  return {
    filters: filters || defaultFilters,
    setFilters: updateFilters,
    clearFilters
  }
}
