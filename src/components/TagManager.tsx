import { useState } from 'react'
import { X, Plus, Tag, Check } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import type { ItemTag } from '@/types'

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

interface TagManagerProps {
  tags: ItemTag[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onCreateTag: (tag: ItemTag) => void
  onDeleteTag: (tagId: string) => void
}

export function TagManager({ tags, selectedTags, onTagsChange, onCreateTag, onDeleteTag }: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TAG_COLORS[0])

  const handleCreateTag = () => {
    if (!newTagName.trim()) return

    const newTag: ItemTag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: selectedColor,
    }

    onCreateTag(newTag)
    setNewTagName('')
    setSelectedColor(DEFAULT_TAG_COLORS[0])
  }

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-wider">Tags</label>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold">
              <Plus size={12} weight="bold" className="mr-1" />
              NEW TAG
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Create New Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Tag Name</label>
                <Input
                  placeholder="e.g., Vintage, Electronics, High Value"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--t2)] mb-2 block">Color</label>
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
                        <Check size={16} weight="bold" className="mx-auto text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateTag} className="w-full" disabled={!newTagName.trim()}>
                <Tag size={16} weight="bold" className="mr-2" />
                Create Tag
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-xs text-[var(--t3)] italic">No tags yet. Create one to get started.</p>
        ) : (
          tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id)
            return (
              <Badge
                key={tag.id}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer transition-all hover:scale-105 group relative"
                style={{
                  backgroundColor: isSelected ? tag.color : 'transparent',
                  borderColor: tag.color,
                  color: isSelected ? 'white' : tag.color,
                }}
                onClick={() => toggleTag(tag.id)}
              >
                <Tag size={12} weight="fill" className="mr-1" />
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteTag(tag.id)
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} weight="bold" />
                </button>
              </Badge>
            )
          })
        )}
      </div>
    </div>
  )
}
