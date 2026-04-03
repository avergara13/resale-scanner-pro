import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { X, Plus, Funnel, Copy, Trash, FloppyDisk, PencilSimple, Star } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { toast } from 'sonner'
import { TagManager } from './TagManager'
import type { CategoryPreset, ItemTag, Decision } from '@/types'
import { cn } from '@/lib/utils'

interface FilterPresetsManagerProps {
  isOpen: boolean
  onClose: () => void
  onApplyPreset: (preset: CategoryPreset) => void
}

const DEFAULT_PRESETS: CategoryPreset[] = [
  {
    id: 'preset-high-profit',
    name: 'High Profit Items',
    description: 'Items with profit margin > 50%',
    tags: [],
    filters: {
      minProfit: 50,
      decision: ['GO'],
    },
    sortBy: 'profit',
    sortOrder: 'desc',
    color: '#22c55e',
    icon: '💰',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'preset-recent',
    name: 'Recent Scans',
    description: 'Last 7 days',
    tags: [],
    filters: {
      dateRange: {
        start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      },
    },
    sortBy: 'date',
    sortOrder: 'desc',
    color: '#3b82f6',
    icon: '🕐',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'preset-go-decisions',
    name: 'GO Decisions',
    description: 'All profitable items',
    tags: [],
    filters: {
      decision: ['GO'],
    },
    sortBy: 'profit',
    sortOrder: 'desc',
    color: '#22c55e',
    icon: '✅',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'preset-pass-decisions',
    name: 'PASS Decisions',
    description: 'Review for learning',
    tags: [],
    filters: {
      decision: ['PASS'],
    },
    sortBy: 'date',
    sortOrder: 'desc',
    color: '#ef4444',
    icon: '❌',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
]

export function FilterPresetsManager({ isOpen, onClose, onApplyPreset }: FilterPresetsManagerProps) {
  const [presets, setPresets] = useKV<CategoryPreset[]>('filter-presets', DEFAULT_PRESETS)
  const [tags, setTags] = useKV<ItemTag[]>('item-tags', [])
  const [editingPreset, setEditingPreset] = useState<CategoryPreset | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')
  const [presetIcon, setPresetIcon] = useState('📁')
  const [presetColor, setPresetColor] = useState('#3b82f6')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [minProfit, setMinProfit] = useState<number>(0)
  const [maxProfit, setMaxProfit] = useState<number>(100)
  const [selectedDecisions, setSelectedDecisions] = useState<Decision[]>([])
  const [sortBy, setSortBy] = useState<'profit' | 'date' | 'price' | 'name'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const resetForm = () => {
    setPresetName('')
    setPresetDescription('')
    setPresetIcon('📁')
    setPresetColor('#3b82f6')
    setSelectedTags([])
    setMinProfit(0)
    setMaxProfit(100)
    setSelectedDecisions([])
    setSortBy('date')
    setSortOrder('desc')
    setEditingPreset(null)
    setIsCreating(false)
  }

  const loadPresetForEdit = (preset: CategoryPreset) => {
    setEditingPreset(preset)
    setPresetName(preset.name)
    setPresetDescription(preset.description || '')
    setPresetIcon(preset.icon || '📁')
    setPresetColor(preset.color || '#3b82f6')
    setSelectedTags(preset.tags || [])
    setMinProfit(preset.filters?.minProfit || 0)
    setMaxProfit(preset.filters?.maxProfit || 100)
    setSelectedDecisions(preset.filters?.decision || [])
    setSortBy(preset.sortBy || 'date')
    setSortOrder(preset.sortOrder || 'desc')
    setIsCreating(true)
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('Preset name is required')
      return
    }

    const newPreset: CategoryPreset = {
      id: editingPreset?.id || `preset-${Date.now()}`,
      name: presetName.trim(),
      description: presetDescription.trim(),
      tags: selectedTags,
      filters: {
        minProfit: minProfit > 0 ? minProfit : undefined,
        maxProfit: maxProfit < 100 ? maxProfit : undefined,
        decision: selectedDecisions.length > 0 ? selectedDecisions : undefined,
      },
      sortBy,
      sortOrder,
      color: presetColor,
      icon: presetIcon,
      createdAt: editingPreset?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isDefault: editingPreset?.isDefault || false,
    }

    if (editingPreset) {
      setPresets((prev) => (prev || []).map(p => p.id === editingPreset.id ? newPreset : p))
      toast.success('Preset updated')
    } else {
      setPresets((prev) => [...(prev || []), newPreset])
      toast.success('Preset created')
    }

    resetForm()
  }

  const handleDuplicatePreset = (preset: CategoryPreset) => {
    const duplicated: CategoryPreset = {
      ...preset,
      id: `preset-${Date.now()}`,
      name: `${preset.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
    }
    setPresets((prev) => [...(prev || []), duplicated])
    toast.success('Preset duplicated')
  }

  const handleDeletePreset = (presetId: string) => {
    setPresets((prev) => (prev || []).filter(p => p.id !== presetId))
    toast.success('Preset deleted')
  }

  const handleCreateTag = (tag: ItemTag) => {
    setTags((prev) => [...(prev || []), tag])
    toast.success('Tag created')
  }

  const handleDeleteTag = (tagId: string) => {
    setTags((prev) => (prev || []).filter(t => t.id !== tagId))
    setPresets((prev) => (prev || []).map(p => ({
      ...p,
      tags: p.tags.filter(t => t !== tagId)
    })))
    setSelectedTags(prev => prev.filter(t => t !== tagId))
    toast.success('Tag deleted')
  }

  const toggleDecision = (decision: Decision) => {
    setSelectedDecisions(prev =>
      prev.includes(decision)
        ? prev.filter(d => d !== decision)
        : [...prev, decision]
    )
  }

  const PRESET_ICONS = ['📁', '⭐', '💰', '🔥', '✅', '❌', '📦', '🏷️', '🎯', '💎']
  const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ef4444', '#10b981']

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Funnel size={20} weight="fill" className="text-[var(--b1)]" />
            {isCreating ? (editingPreset ? 'Edit Preset' : 'Create Preset') : 'Filter Presets'}
          </DialogTitle>
        </DialogHeader>

        {!isCreating ? (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--t3)]">
                {(presets || []).length} preset{(presets || []).length !== 1 ? 's' : ''} available
              </p>
              <Button
                onClick={() => setIsCreating(true)}
                size="sm"
                className="h-8"
              >
                <Plus size={16} weight="bold" className="mr-1" />
                New Preset
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(presets || []).map((preset) => (
                <div
                  key={preset.id}
                  className="stat-card group cursor-pointer hover:border-[var(--b1)] transition-all"
                  style={{ borderColor: preset.color + '33' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: preset.color + '22' }}
                      >
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold truncate flex items-center gap-1">
                          {preset.name}
                          {preset.isDefault && (
                            <Star size={12} weight="fill" className="text-[var(--amber)]" />
                          )}
                        </h4>
                        {preset.description && (
                          <p className="text-[10px] text-[var(--t3)] truncate">{preset.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {preset.filters?.decision && preset.filters.decision.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-5">
                        {preset.filters.decision.join(', ')}
                      </Badge>
                    )}
                    {preset.filters?.minProfit !== undefined && (
                      <Badge variant="outline" className="text-[9px] h-5">
                        Profit ≥ {preset.filters.minProfit}%
                      </Badge>
                    )}
                    {preset.tags.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-5">
                        {preset.tags.length} tag{preset.tags.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 flex-1 text-[10px]"
                      onClick={() => {
                        onApplyPreset(preset)
                        toast.success(`Applied preset: ${preset.name}`)
                      }}
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => loadPresetForEdit(preset)}
                    >
                      <PencilSimple size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDuplicatePreset(preset)}
                    >
                      <Copy size={14} />
                    </Button>
                    {!preset.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--red)]"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Preset Name *</label>
                <Input
                  placeholder="e.g., Vintage Clothing"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Description</label>
                <Input
                  placeholder="Optional description"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setPresetIcon(icon)}
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 text-lg transition-all hover:scale-110",
                        presetIcon === icon ? "border-[var(--b1)] bg-[var(--blue-bg)]" : "border-[var(--s2)]"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setPresetColor(color)}
                      className="w-10 h-10 rounded-lg border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: presetColor === color ? 'var(--b1)' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--s2)] pt-4">
              <h4 className="text-xs font-bold text-[var(--t2)] mb-3 uppercase tracking-wider">Filters</h4>
              
              <TagManager
                tags={tags || []}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                onCreateTag={handleCreateTag}
                onDeleteTag={handleDeleteTag}
              />

              <div className="mt-4">
                <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider mb-2 block">
                  Decision
                </label>
                <div className="flex gap-2">
                  {(['GO', 'PASS', 'PENDING'] as Decision[]).map((decision) => (
                    <Button
                      key={decision}
                      variant={selectedDecisions.includes(decision) ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => toggleDecision(decision)}
                    >
                      {decision}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider mb-2 block">
                    Min Profit Margin: {minProfit}%
                  </label>
                  <Slider
                    value={[minProfit]}
                    onValueChange={([value]) => setMinProfit(value)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider mb-2 block">
                    Max Profit Margin: {maxProfit}%
                  </label>
                  <Slider
                    value={[maxProfit]}
                    onValueChange={([value]) => setMaxProfit(value)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--s2)] pt-4">
              <h4 className="text-xs font-bold text-[var(--t2)] mb-3 uppercase tracking-wider">Sorting</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider mb-2 block">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profit">Profit Margin</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider mb-2 block">
                    Order
                  </label>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-[var(--s2)]">
              <Button
                variant="outline"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePreset}
                className="flex-1"
                disabled={!presetName.trim()}
              >
                <FloppyDisk size={16} weight="bold" className="mr-2" />
                {editingPreset ? 'Update' : 'Create'} Preset
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
