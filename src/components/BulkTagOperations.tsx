import { useState } from 'react'
import { Tag, Plus, Minus, X, Check } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity-log'
import type { ItemTag } from '@/types'

interface BulkTagOperationsProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  availableTags: ItemTag[]
  onApplyTags: (tagIds: string[]) => void
  onRemoveTags: (tagIds: string[]) => void
  onCreateTag?: (tag: ItemTag) => void
}

const DEFAULT_TAG_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
]

export function BulkTagOperations({
  isOpen,
  onClose,
  selectedCount,
  availableTags,
  onApplyTags,
  onRemoveTags,
  onCreateTag,
}: BulkTagOperationsProps) {
  const [selectedTagsToApply, setSelectedTagsToApply] = useState<Set<string>>(new Set())
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<Set<string>>(new Set())
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TAG_COLORS[0])

  const handleToggleApply = (tagId: string) => {
    setSelectedTagsToApply((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(tagId)) {
        newSet.delete(tagId)
      } else {
        newSet.add(tagId)
      }
      return newSet
    })
  }

  const handleToggleRemove = (tagId: string) => {
    setSelectedTagsToRemove((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(tagId)) {
        newSet.delete(tagId)
      } else {
        newSet.add(tagId)
      }
      return newSet
    })
  }

  const handleApply = () => {
    if (selectedTagsToApply.size === 0) {
      toast.error('Please select at least one tag to apply')
      return
    }

    onApplyTags(Array.from(selectedTagsToApply))
    logActivity(
      `Applied ${selectedTagsToApply.size} tag${selectedTagsToApply.size !== 1 ? 's' : ''} to ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`
    )
    setSelectedTagsToApply(new Set())
    onClose()
  }

  const handleRemove = () => {
    if (selectedTagsToRemove.size === 0) {
      toast.error('Please select at least one tag to remove')
      return
    }

    onRemoveTags(Array.from(selectedTagsToRemove))
    logActivity(
      `Removed ${selectedTagsToRemove.size} tag${selectedTagsToRemove.size !== 1 ? 's' : ''} from ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`
    )
    setSelectedTagsToRemove(new Set())
    onClose()
  }

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name')
      return
    }

    if (!onCreateTag) return

    const newTag: ItemTag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: selectedColor,
    }

    onCreateTag(newTag)
    logActivity(`Created tag: ${newTagName}`)
    setNewTagName('')
    setSelectedColor(DEFAULT_TAG_COLORS[0])
    setIsCreatingTag(false)
  }

  const handleClose = () => {
    setSelectedTagsToApply(new Set())
    setSelectedTagsToRemove(new Set())
    setIsCreatingTag(false)
    setNewTagName('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Tag size={20} weight="fill" className="text-b1" />
            Bulk Tag Operations
          </DialogTitle>
          <DialogDescription className="text-sm text-t3">
            Apply or remove tags from {selectedCount} selected item{selectedCount !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Apply Tags Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-t1 flex items-center gap-2">
                <Plus size={16} weight="bold" className="text-green" />
                Apply Tags
              </h3>
              {onCreateTag && (
                <Button
                  onClick={() => setIsCreatingTag(!isCreatingTag)}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-bold text-b1 hover:text-b2 hover:bg-blue-bg"
                >
                  <Plus size={12} weight="bold" className="mr-1" />
                  New Tag
                </Button>
              )}
            </div>

            {isCreatingTag && (
              <div className="mb-3 p-3 bg-s1 border border-s2 rounded-lg space-y-3">
                <div>
                  <label className="text-xs font-bold text-t2 mb-1.5 block">Tag Name</label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    placeholder="e.g., High Value, Vintage, Electronics"
                    className="w-full h-9 px-3 bg-fg border border-s2 rounded-lg text-sm text-t1 placeholder:text-t3 outline-none focus:border-b1 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-t2 mb-1.5 block">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className="w-8 h-8 rounded-lg border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: selectedColor === color ? 'var(--b1)' : 'transparent',
                        }}
                      >
                        {selectedColor === color && (
                          <Check size={14} weight="bold" className="mx-auto text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTag}
                    className="flex-1 h-9 text-xs font-bold"
                    disabled={!newTagName.trim()}
                  >
                    Create & Select
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCreatingTag(false)
                      setNewTagName('')
                    }}
                    variant="outline"
                    className="h-9 px-3 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="h-32">
              <div className="flex flex-wrap gap-2 pr-4">
                {availableTags.length === 0 ? (
                  <p className="text-xs text-t3 italic py-2">
                    No tags available. Create one to get started.
                  </p>
                ) : (
                  availableTags.map((tag) => {
                    const isSelected = selectedTagsToApply.has(tag.id)
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer transition-all hover:scale-105 text-xs px-3 py-1.5"
                        style={{
                          backgroundColor: isSelected ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: isSelected ? 'white' : tag.color,
                        }}
                        onClick={() => handleToggleApply(tag.id)}
                      >
                        {isSelected ? (
                          <Check size={12} weight="bold" className="mr-1" />
                        ) : (
                          <Plus size={12} weight="bold" className="mr-1" />
                        )}
                        {tag.name}
                      </Badge>
                    )
                  })
                )}
              </div>
            </ScrollArea>

            {selectedTagsToApply.size > 0 && (
              <div className="mt-3 p-2 bg-green-bg border border-green/20 rounded-lg">
                <p className="text-xs font-medium text-green">
                  {selectedTagsToApply.size} tag{selectedTagsToApply.size !== 1 ? 's' : ''} selected to apply
                </p>
              </div>
            )}
          </div>

          {/* Remove Tags Section */}
          <div className="border-t border-s2 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-t1 flex items-center gap-2">
                <Minus size={16} weight="bold" className="text-red" />
                Remove Tags
              </h3>
            </div>

            <ScrollArea className="h-32">
              <div className="flex flex-wrap gap-2 pr-4">
                {availableTags.length === 0 ? (
                  <p className="text-xs text-t3 italic py-2">No tags available</p>
                ) : (
                  availableTags.map((tag) => {
                    const isSelected = selectedTagsToRemove.has(tag.id)
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer transition-all hover:scale-105 text-xs px-3 py-1.5"
                        style={{
                          backgroundColor: isSelected ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: isSelected ? 'white' : tag.color,
                        }}
                        onClick={() => handleToggleRemove(tag.id)}
                      >
                        {isSelected ? (
                          <Check size={12} weight="bold" className="mr-1" />
                        ) : (
                          <X size={12} weight="bold" className="mr-1" />
                        )}
                        {tag.name}
                      </Badge>
                    )
                  })
                )}
              </div>
            </ScrollArea>

            {selectedTagsToRemove.size > 0 && (
              <div className="mt-3 p-2 bg-red-bg border border-red/20 rounded-lg">
                <p className="text-xs font-medium text-red">
                  {selectedTagsToRemove.size} tag{selectedTagsToRemove.size !== 1 ? 's' : ''} selected to remove
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-s2">
          <Button
            onClick={handleApply}
            disabled={selectedTagsToApply.size === 0}
            className="flex-1 h-10 font-bold bg-green hover:bg-green/90 text-white"
          >
            <Plus size={16} weight="bold" className="mr-2" />
            Apply {selectedTagsToApply.size > 0 ? `(${selectedTagsToApply.size})` : ''}
          </Button>
          <Button
            onClick={handleRemove}
            disabled={selectedTagsToRemove.size === 0}
            variant="outline"
            className="flex-1 h-10 font-bold border-red/30 text-red hover:bg-red/10 hover:text-red"
          >
            <Minus size={16} weight="bold" className="mr-2" />
            Remove {selectedTagsToRemove.size > 0 ? `(${selectedTagsToRemove.size})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
