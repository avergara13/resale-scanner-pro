import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tag, Plus, Copy, Pencil, Trash, Sparkle, Package, CurrencyDollar, Diamond, DeviceMobile, TShirt, Palette, X, Check } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { toast } from 'sonner'
import type { ItemTag } from '@/types'

interface TagPreset {
  id: string
  name: string
  description: string
  tags: ItemTag[]
  category: string
  icon: string
  color: string
  isDefault?: boolean
  createdAt: number
  updatedAt: number
}

const DEFAULT_TAG_PRESETS: TagPreset[] = [
  {
    id: 'vintage',
    name: 'Vintage Items',
    description: 'Classic, retro, and collectible vintage products',
    category: 'collectibles',
    icon: 'sparkle',
    color: 'oklch(0.68 0.18 75)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'vintage-tag-1', name: 'Vintage', color: 'oklch(0.68 0.18 75)' },
      { id: 'vintage-tag-2', name: 'Retro', color: 'oklch(0.65 0.20 260)' },
      { id: 'vintage-tag-3', name: 'Collectible', color: 'oklch(0.52 0.20 145)' },
      { id: 'vintage-tag-4', name: '80s/90s', color: 'oklch(0.52 0.22 25)' },
    ],
  },
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Gadgets, devices, and tech equipment',
    category: 'technology',
    icon: 'package',
    color: 'oklch(0.50 0.18 250)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'electronics-tag-1', name: 'Electronics', color: 'oklch(0.50 0.18 250)' },
      { id: 'electronics-tag-2', name: 'Tested', color: 'oklch(0.52 0.20 145)' },
      { id: 'electronics-tag-3', name: 'Complete', color: 'oklch(0.65 0.20 260)' },
      { id: 'electronics-tag-4', name: 'Parts Only', color: 'oklch(0.52 0.22 25)' },
      { id: 'electronics-tag-5', name: 'Original Box', color: 'oklch(0.68 0.18 75)' },
    ],
  },
  {
    id: 'high-value',
    name: 'High Value',
    description: 'Premium items with significant resale potential',
    category: 'premium',
    icon: 'diamond',
    color: 'oklch(0.65 0.20 260)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'high-value-tag-1', name: 'High Value', color: 'oklch(0.65 0.20 260)' },
      { id: 'high-value-tag-2', name: 'Premium', color: 'oklch(0.68 0.18 75)' },
      { id: 'high-value-tag-3', name: 'Designer', color: 'oklch(0.52 0.22 25)' },
      { id: 'high-value-tag-4', name: 'Luxury Brand', color: 'oklch(0.50 0.18 250)' },
      { id: 'high-value-tag-5', name: 'Investment Piece', color: 'oklch(0.52 0.20 145)' },
    ],
  },
  {
    id: 'clothing',
    name: 'Clothing & Fashion',
    description: 'Apparel, shoes, and fashion accessories',
    category: 'fashion',
    icon: 'tshirt',
    color: 'oklch(0.52 0.22 25)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'clothing-tag-1', name: 'Clothing', color: 'oklch(0.52 0.22 25)' },
      { id: 'clothing-tag-2', name: 'Brand Name', color: 'oklch(0.50 0.18 250)' },
      { id: 'clothing-tag-3', name: 'Like New', color: 'oklch(0.52 0.20 145)' },
      { id: 'clothing-tag-4', name: 'Rare Size', color: 'oklch(0.65 0.20 260)' },
      { id: 'clothing-tag-5', name: 'Limited Edition', color: 'oklch(0.68 0.18 75)' },
    ],
  },
  {
    id: 'bulk-lot',
    name: 'Bulk Lot',
    description: 'Multiple items sold together',
    category: 'bulk',
    icon: 'package',
    color: 'oklch(0.52 0.20 145)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'bulk-tag-1', name: 'Bulk Lot', color: 'oklch(0.52 0.20 145)' },
      { id: 'bulk-tag-2', name: 'Multi-Pack', color: 'oklch(0.50 0.18 250)' },
      { id: 'bulk-tag-3', name: 'Mixed Items', color: 'oklch(0.68 0.18 75)' },
      { id: 'bulk-tag-4', name: 'Wholesale', color: 'oklch(0.65 0.20 260)' },
    ],
  },
  {
    id: 'quick-flip',
    name: 'Quick Flip',
    description: 'Fast-selling items with high turnover',
    category: 'velocity',
    icon: 'currency',
    color: 'oklch(0.68 0.18 75)',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [
      { id: 'quick-flip-tag-1', name: 'Quick Flip', color: 'oklch(0.68 0.18 75)' },
      { id: 'quick-flip-tag-2', name: 'Hot Item', color: 'oklch(0.52 0.22 25)' },
      { id: 'quick-flip-tag-3', name: 'Trending', color: 'oklch(0.50 0.18 250)' },
      { id: 'quick-flip-tag-4', name: 'High Demand', color: 'oklch(0.52 0.20 145)' },
    ],
  },
]

const PRESET_ICONS = {
  sparkle: Sparkle,
  smartphone: DeviceMobile,
  diamond: Diamond,
  tshirt: TShirt,
  package: Package,
  currency: CurrencyDollar,
  palette: Palette,
}

interface TagPresetsManagerProps {
  onApplyPreset: (tags: ItemTag[]) => void
}

export function TagPresetsManager({ onApplyPreset }: TagPresetsManagerProps) {
  const [presets, setPresets] = useKV<TagPreset[]>('tag-presets', DEFAULT_TAG_PRESETS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<TagPreset | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetDescription, setNewPresetDescription] = useState('')
  const [newPresetColor, setNewPresetColor] = useState('oklch(0.50 0.18 250)')
  const [newPresetIcon, setNewPresetIcon] = useState('tag')
  const [newPresetTags, setNewPresetTags] = useState<ItemTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [selectedTagColor, setSelectedTagColor] = useState('oklch(0.50 0.18 250)')

  const TAG_COLORS = [
    'oklch(0.50 0.18 250)',
    'oklch(0.65 0.20 260)',
    'oklch(0.52 0.22 25)',
    'oklch(0.68 0.18 75)',
    'oklch(0.52 0.20 145)',
  ]

  const handleCreatePreset = () => {
    if (!newPresetName.trim() || newPresetTags.length === 0) {
      toast.error('Please provide a name and at least one tag')
      return
    }

    const newPreset: TagPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDescription.trim(),
      tags: newPresetTags,
      category: 'custom',
      icon: newPresetIcon,
      color: newPresetColor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setPresets((prev) => [...(prev || []), newPreset])
    toast.success(`Created preset: ${newPreset.name}`)
    resetForm()
    setIsCreateOpen(false)
  }

  const handleUpdatePreset = () => {
    if (!editingPreset || !newPresetName.trim() || newPresetTags.length === 0) {
      toast.error('Please provide a name and at least one tag')
      return
    }

    setPresets((prev) =>
      (prev || []).map((p) =>
        p.id === editingPreset.id
          ? {
              ...p,
              name: newPresetName.trim(),
              description: newPresetDescription.trim(),
              tags: newPresetTags,
              color: newPresetColor,
              icon: newPresetIcon,
              updatedAt: Date.now(),
            }
          : p
      )
    )
    toast.success(`Updated preset: ${newPresetName}`)
    resetForm()
    setEditingPreset(null)
  }

  const handleDuplicatePreset = (preset: TagPreset) => {
    const duplicatedPreset: TagPreset = {
      ...preset,
      id: `preset-${Date.now()}`,
      name: `${preset.name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setPresets((prev) => [...(prev || []), duplicatedPreset])
    toast.success(`Duplicated preset: ${preset.name}`)
  }

  const handleDeletePreset = (presetId: string) => {
    const preset = (presets || []).find((p) => p.id === presetId)
    if (preset?.isDefault) {
      toast.error('Cannot delete default presets')
      return
    }

    setPresets((prev) => (prev || []).filter((p) => p.id !== presetId))
    toast.success('Preset deleted')
  }

  const handleEditPreset = (preset: TagPreset) => {
    if (preset.isDefault) {
      toast.error('Cannot edit default presets. Duplicate to customize.')
      return
    }

    setEditingPreset(preset)
    setNewPresetName(preset.name)
    setNewPresetDescription(preset.description)
    setNewPresetColor(preset.color)
    setNewPresetIcon(preset.icon)
    setNewPresetTags([...preset.tags])
    setIsCreateOpen(true)
  }

  const handleAddTag = () => {
    if (!newTagName.trim()) return

    const newTag: ItemTag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: selectedTagColor,
    }

    setNewPresetTags((prev) => [...prev, newTag])
    setNewTagName('')
  }

  const handleRemoveTag = (tagId: string) => {
    setNewPresetTags((prev) => prev.filter((t) => t.id !== tagId))
  }

  const resetForm = () => {
    setNewPresetName('')
    setNewPresetDescription('')
    setNewPresetColor('oklch(0.50 0.18 250)')
    setNewPresetIcon('tag')
    setNewPresetTags([])
    setNewTagName('')
    setSelectedTagColor('oklch(0.50 0.18 250)')
  }

  const getIconComponent = (iconName: string) => {
    return PRESET_ICONS[iconName as keyof typeof PRESET_ICONS] || Tag
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--t1)]">Tag Presets</h3>
          <p className="text-[10px] text-[var(--t3)] font-medium">Quick apply common tag combinations</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            resetForm()
            setEditingPreset(null)
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold">
              <Plus size={14} weight="bold" className="mr-1" />
              NEW PRESET
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {editingPreset ? 'Edit Preset' : 'Create Tag Preset'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Preset Name</label>
                <Input
                  placeholder="e.g., Vintage Items"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Description</label>
                <Input
                  placeholder="Brief description of this preset"
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Preset Color</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewPresetColor(color)}
                      className="w-10 h-10 rounded-lg border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: newPresetColor === color ? 'var(--t1)' : 'transparent',
                      }}
                    >
                      {newPresetColor === color && (
                        <Check size={18} weight="bold" className="mx-auto text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Tags in this Preset</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    className="text-sm flex-1"
                  />
                  <div className="flex gap-1">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedTagColor(color)}
                        className="w-8 h-8 rounded border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: selectedTagColor === color ? 'var(--t1)' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                  <Button onClick={handleAddTag} size="sm" disabled={!newTagName.trim()}>
                    <Plus size={16} weight="bold" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-[var(--bg)] border border-[var(--s2)] rounded-lg">
                  {newPresetTags.length === 0 ? (
                    <p className="text-xs text-[var(--t3)] italic">No tags yet. Add some above.</p>
                  ) : (
                    newPresetTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        className="group relative"
                        style={{
                          backgroundColor: tag.color,
                          color: 'white',
                        }}
                      >
                        <Tag size={12} weight="fill" className="mr-1" />
                        {tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={editingPreset ? handleUpdatePreset : handleCreatePreset}
                  className="flex-1"
                  disabled={!newPresetName.trim() || newPresetTags.length === 0}
                >
                  {editingPreset ? 'Update Preset' : 'Create Preset'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setIsCreateOpen(false)
                    setEditingPreset(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {(presets || []).map((preset) => {
          const IconComponent = getIconComponent(preset.icon)
          return (
            <div
              key={preset.id}
              className="p-4 bg-[var(--fg)] border border-[var(--s2)] rounded-xl hover:border-[var(--b1)] transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: preset.color }}
                  >
                    <IconComponent size={20} weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-[var(--t1)] mb-1">{preset.name}</h4>
                    <p className="text-[11px] text-[var(--t3)] leading-relaxed mb-2">
                      {preset.description}
                    </p>
                    {preset.isDefault && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 mb-2">
                        DEFAULT
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDuplicatePreset(preset)}
                  >
                    <Copy size={14} weight="bold" />
                  </Button>
                  {!preset.isDefault && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditPreset(preset)}
                      >
                        <Pencil size={14} weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[var(--red)]"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash size={14} weight="bold" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {preset.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="text-[10px] px-2 py-0.5"
                    style={{
                      backgroundColor: tag.color,
                      color: 'white',
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>

              <Button
                onClick={() => {
                  onApplyPreset(preset.tags)
                  toast.success(`Applied ${preset.name} tags`)
                }}
                size="sm"
                className="w-full h-8 text-[10px] font-bold"
                variant="outline"
              >
                <Check size={14} weight="bold" className="mr-1" />
                APPLY PRESET
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
