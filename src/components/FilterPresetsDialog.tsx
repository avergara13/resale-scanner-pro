import { useState } from 'react'
import { BookmarkSimple, Pencil, Trash, Plus, Check, X, CopySimple, Sliders, DotsThreeVertical } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity-log'
import { useFilterPresets, type FilterPreset } from '@/hooks/use-filter-presets'
import type { AdvancedFilterOptions } from './AdvancedFilters'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// Guards against `RangeError: Invalid time value` from date-fns when a
// preset's persisted dateRange is missing start/end or contains NaN.
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

interface FilterPresetsDialogProps {
  currentFilters: AdvancedFilterOptions
  onApplyPreset: (filters: AdvancedFilterOptions) => void
  trigger?: React.ReactNode
}

export function FilterPresetsDialog({ currentFilters, onApplyPreset, trigger }: FilterPresetsDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [customizingId, setCustomizingId] = useState<string | null>(null)
  
  const { presets, savePreset, deletePreset, applyPreset, renamePreset, duplicatePreset } = useFilterPresets()

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name')
      return
    }

    const hasActiveFilters = Object.keys(currentFilters).length > 0
    if (!hasActiveFilters) {
      toast.error('No active filters to save')
      return
    }

    savePreset(newPresetName.trim(), currentFilters)
    logActivity(`Preset "${newPresetName.trim()}" saved`)
    setNewPresetName('')
  }

  const handleApplyPreset = (id: string) => {
    const filters = applyPreset(id)
    if (filters) {
      onApplyPreset(filters)
      setIsOpen(false)
      logActivity('Preset applied')
    }
  }

  const handleDeletePreset = (id: string, name: string) => {
    deletePreset(id)
    logActivity(`Preset "${name}" deleted`)
  }

  const handleStartEdit = (preset: FilterPreset) => {
    setEditingId(preset.id)
    setEditingName(preset.name)
  }

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      renamePreset(editingId, editingName.trim())
      setEditingId(null)
      setEditingName('')
      logActivity('Preset renamed')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDuplicatePreset = (preset: FilterPreset) => {
    const newPreset = duplicatePreset(preset.id)
    if (newPreset) {
      logActivity(`Preset "${preset.name}" duplicated`)
    }
  }

  const handleCustomizePreset = (preset: FilterPreset) => {
    setCustomizingId(preset.id)
    onApplyPreset(preset.filters)
    setIsOpen(false)
    logActivity(`Customize "${preset.name}" and save as new preset`, 'info')
  }

  const getFilterSummary = (filters: AdvancedFilterOptions): string[] => {
    const summary: string[] = []
    
    if (filters.priceRange) {
      summary.push(`Price: $${filters.priceRange.min}-$${filters.priceRange.max}`)
    }
    if (filters.profitMarginRange) {
      summary.push(`Margin: ${filters.profitMarginRange.min}%-${filters.profitMarginRange.max}%`)
    }
    if (filters.dateRange) {
      const s = safeFormat(filters.dateRange.start, 'MMM d')
      const e = safeFormat(filters.dateRange.end, 'MMM d')
      if (s && e) summary.push(`Date: ${s} - ${e}`)
      else if (s || e) summary.push(`Date: ${s || e}`)
    }
    if (filters.categories && filters.categories.length > 0) {
      summary.push(`${filters.categories.length} categories`)
    }
    
    return summary
  }

  const sortedPresets = [...presets].sort((a, b) => {
    if (a.lastUsed && b.lastUsed) {
      return b.lastUsed - a.lastUsed
    }
    if (a.lastUsed) return -1
    if (b.lastUsed) return 1
    return b.timestamp - a.timestamp
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            className="h-9 px-3 gap-2 text-xs font-semibold border-s2 bg-fg hover:bg-s1 text-t2 hover:text-t1"
          >
            <BookmarkSimple size={16} weight="bold" />
            <span>Presets</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[480px] p-0 bg-fg border-s2 shadow-2xl">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base font-black tracking-tight">
            <BookmarkSimple size={20} weight="bold" className="text-b1" />
            FILTER PRESETS
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="flex gap-2">
            <Input
              placeholder="Save current filters as preset..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSavePreset()
                }
              }}
              className="flex-1 h-9 text-xs bg-bg border-s2"
            />
            <Button
              onClick={handleSavePreset}
              disabled={!newPresetName.trim() || Object.keys(currentFilters).length === 0}
              className="h-9 px-3 bg-b1 hover:bg-b2 text-white"
            >
              <Plus size={16} weight="bold" />
            </Button>
          </div>
          {Object.keys(currentFilters).length === 0 && (
            <p className="text-[10px] text-t3 mt-2">Apply filters first to save as preset</p>
          )}
        </div>

        <div className="px-5 pb-5">
          {sortedPresets.length === 0 ? (
            <div className="text-center py-12">
              <BookmarkSimple size={48} weight="thin" className="text-s3 mx-auto mb-3" />
              <p className="text-sm font-semibold text-t2 mb-1">No Presets Yet</p>
              <p className="text-xs text-t3">Save your commonly used filter combinations</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-2">
                {sortedPresets.map((preset) => {
                  const summary = getFilterSummary(preset.filters)
                  const isEditing = editingId === preset.id

                  return (
                    <div
                      key={preset.id}
                      className="p-3 rounded-lg border border-s2 bg-bg hover:bg-s1 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit()
                                if (e.key === 'Escape') handleCancelEdit()
                              }}
                              className="h-7 text-xs flex-1"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              className="h-7 w-7 p-0 bg-green hover:bg-green/90 text-white"
                            >
                              <Check size={14} weight="bold" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="h-7 w-7 p-0 border-s2"
                            >
                              <X size={14} weight="bold" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-sm text-t1 truncate">{preset.name}</h4>
                                {preset.usageCount > 0 && (
                                  <Badge className="h-5 px-2 text-[10px] font-bold bg-s2 text-t2 border-0">
                                    {preset.usageCount}x
                                  </Badge>
                                )}
                              </div>
                              {(() => {
                                const lastUsedLabel = safeFormat(preset.lastUsed, 'MMM d, h:mm a')
                                return lastUsedLabel ? (
                                  <p className="text-[10px] text-t3 font-medium">
                                    Last used {lastUsedLabel}
                                  </p>
                                ) : null
                              })()}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-t3 hover:text-t1 hover:bg-s2"
                                  title="Quick actions"
                                >
                                  <DotsThreeVertical size={18} weight="bold" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-fg border-s2 shadow-xl">
                                <DropdownMenuItem
                                  onClick={() => handleDuplicatePreset(preset)}
                                  className="gap-2 cursor-pointer text-t2 hover:text-t1 hover:bg-blue-bg focus:bg-blue-bg focus:text-b1"
                                >
                                  <CopySimple size={16} weight="bold" className="text-b1" />
                                  <span className="font-semibold">Duplicate</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCustomizePreset(preset)}
                                  className="gap-2 cursor-pointer text-t2 hover:text-t1 hover:bg-amber/10 focus:bg-amber/10 focus:text-amber"
                                >
                                  <Sliders size={16} weight="bold" className="text-amber" />
                                  <span className="font-semibold">Customize</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-s2" />
                                <DropdownMenuItem
                                  onClick={() => handleStartEdit(preset)}
                                  className="gap-2 cursor-pointer text-t2 hover:text-t1 hover:bg-s1 focus:bg-s1"
                                >
                                  <Pencil size={16} weight="bold" />
                                  <span className="font-semibold">Rename</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeletePreset(preset.id, preset.name)}
                                  className="gap-2 cursor-pointer text-t2 hover:text-red hover:bg-red-bg focus:bg-red-bg focus:text-red"
                                >
                                  <Trash size={16} weight="bold" className="text-red" />
                                  <span className="font-semibold">Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>

                      {!isEditing && summary.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {summary.map((item, idx) => (
                            <Badge
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 bg-blue-bg text-b1 border-0"
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {!isEditing && (
                        <Button
                          onClick={() => handleApplyPreset(preset.id)}
                          size="sm"
                          className="w-full h-8 text-xs font-bold bg-b1 hover:bg-b2 text-white"
                        >
                          Apply Preset
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
