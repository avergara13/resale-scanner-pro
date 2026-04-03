import { useKV } from '@github/spark/hooks'
import { useCallback } from 'react'

export interface SortFilterPreferences<TSort = string, TFilter = string> {
  sortBy: TSort
  filter: TFilter
}

/**
 * Hook for persisting sort and filter preferences across sessions
 * 
 * @param key - Unique identifier for this preference set (e.g., 'queue-screen')
 * @param defaultSort - Default sort option
 * @param defaultFilter - Default filter option
 * 
 * @returns Object containing:
 *   - sortBy: Current sort value
 *   - filter: Current filter value
 *   - setSortBy: Function to update sort preference
 *   - setFilter: Function to update filter preference
 *   - setSortAndFilter: Function to update both at once
 *   - resetToDefaults: Function to reset to default values
 * 
 * @example
 * ```tsx
 * const { sortBy, filter, setSortBy, setFilter } = useSortFilterPreference<SortOption, FilterOption>(
 *   'queue-screen',
 *   'profit-desc',
 *   'ALL'
 * )
 * ```
 */
export function useSortFilterPreference<TSort = string, TFilter = string>(
  key: string,
  defaultSort: TSort,
  defaultFilter: TFilter
) {
  const [preferences, setPreferences] = useKV<SortFilterPreferences<TSort, TFilter>>(
    `sort-filter-${key}`,
    {
      sortBy: defaultSort,
      filter: defaultFilter,
    }
  )

  const setSortBy = useCallback(
    (sortBy: TSort) => {
      setPreferences((prev) => ({
        sortBy,
        filter: prev?.filter ?? defaultFilter,
      }))
    },
    [setPreferences, defaultFilter]
  )

  const setFilter = useCallback(
    (filter: TFilter) => {
      setPreferences((prev) => ({
        sortBy: prev?.sortBy ?? defaultSort,
        filter,
      }))
    },
    [setPreferences, defaultSort]
  )

  const setSortAndFilter = useCallback(
    (sortBy: TSort, filter: TFilter) => {
      setPreferences({ sortBy, filter })
    },
    [setPreferences]
  )

  const resetToDefaults = useCallback(() => {
    setPreferences({ sortBy: defaultSort, filter: defaultFilter })
  }, [setPreferences, defaultSort, defaultFilter])

  return {
    sortBy: preferences?.sortBy ?? defaultSort,
    filter: preferences?.filter ?? defaultFilter,
    setSortBy,
    setFilter,
    setSortAndFilter,
    resetToDefaults,
  }
}

