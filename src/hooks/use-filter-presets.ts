import { useKV } from '@github/spark/hooks'
import { useCallback } from 'react'
import type { AdvancedFilterOptions } from '@/components/AdvancedFilters'

export interface FilterPreset {
  id: string
  name: string
  filters: AdvancedFilterOptions
  timestamp: number
  usageCount: number
  lastUsed?: number
}

export function useFilterPresets() {
  const [presets, setPresets] = useKV<FilterPreset[]>('filter-presets', [])

  const savePreset = useCallback((name: string, filters: AdvancedFilterOptions) => {
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name,
      filters,
      timestamp: Date.now(),
      usageCount: 0,
    }

    setPresets((current) => [...(current || []), newPreset])
    return newPreset
  }, [setPresets])

  const updatePreset = useCallback((id: string, updates: Partial<FilterPreset>) => {
    setPresets((current) => {
      const currentPresets = current || []
      return currentPresets.map(preset => 
        preset.id === id ? { ...preset, ...updates } : preset
      )
    })
  }, [setPresets])

  const deletePreset = useCallback((id: string) => {
    setPresets((current) => {
      const currentPresets = current || []
      return currentPresets.filter(preset => preset.id !== id)
    })
  }, [setPresets])

  const applyPreset = useCallback((id: string) => {
    const preset = (presets || []).find(p => p.id === id)
    if (preset) {
      updatePreset(id, {
        usageCount: preset.usageCount + 1,
        lastUsed: Date.now()
      })
      return preset.filters
    }
    return null
  }, [presets, updatePreset])

  const renamePreset = useCallback((id: string, newName: string) => {
    updatePreset(id, { name: newName })
  }, [updatePreset])

  return {
    presets: presets || [],
    savePreset,
    updatePreset,
    deletePreset,
    applyPreset,
    renamePreset
  }
}
