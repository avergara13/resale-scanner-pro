import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FloppyDisk, X, PencilSimple } from '@phosphor-icons/react'
import { PhotoEditor } from '@/components/PhotoEditor'
import { TagManager } from '@/components/TagManager'
import { SuggestedTags } from '@/components/SuggestedTags'
import { useKV } from '@github/spark/hooks'
import { createTagSuggestionService } from '@/lib/tag-suggestion-service'
import type { ScannedItem, ItemTag } from '@/types'
import type { GeminiService } from '@/lib/gemini-service'
import type { TagSuggestion } from '@/lib/tag-suggestion-service'

interface ItemEditDialogProps {
  item: ScannedItem | null
  isOpen: boolean
  onClose: () => void
  onSave: (itemId: string, updates: Partial<ScannedItem>) => void
  geminiService?: GeminiService | null
}

export function ItemEditDialog({ item, isOpen, onClose, onSave, geminiService }: ItemEditDialogProps) {
  const [formData, setFormData] = useState({
    productName: item?.productName || '',
    description: item?.description || '',
    category: item?.category || '',
    condition: item?.condition || 'Good',
    preferredPlatform: item?.preferredPlatform || '',
    purchasePrice: item?.purchasePrice.toString() || '0',
    estimatedSellPrice: item?.estimatedSellPrice?.toString() || '',
    notes: item?.notes || '',
  })
  const [editedImage, setEditedImage] = useState<string | null>(null)
  const [isEditingPhoto, setIsEditingPhoto] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [suggestedTags, setSuggestedTags] = useState<TagSuggestion[]>([])
  const [allTags, setAllTags] = useKV<ItemTag[]>('all-tags', [])

  const tagService = useMemo(() => createTagSuggestionService(), [])

  useEffect(() => {
    if (item) {
      setFormData({
        productName: item.productName || '',
        description: item.description || '',
        category: item.category || '',
        condition: item.condition || 'Good',
        preferredPlatform: item.preferredPlatform || '',
        purchasePrice: item.purchasePrice.toString() || '0',
        estimatedSellPrice: item.estimatedSellPrice?.toString() || '',
        notes: item.notes || '',
      })
      setEditedImage(null)
      setSelectedTags(item.tags || [])
      
      const suggestions = tagService.suggestTags(item)
      setSuggestedTags(suggestions.slice(0, 8))
    }
  }, [item, tagService])

  const handleApplySuggestedTags = (tagIds: string[]) => {
    setSelectedTags((prev) => {
      const newTags = [...prev]
      tagIds.forEach(tagId => {
        if (!newTags.includes(tagId)) {
          newTags.push(tagId)
        }
      })
      return newTags
    })
  }

  const handleApplySingleTag = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter(t => t !== tagId)
      } else {
        return [...prev, tagId]
      }
    })
  }

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags)
  }

  const handleCreateTag = (tag: ItemTag) => {
    setAllTags((prev) => [...(prev || []), tag])
  }

  const handleDeleteTag = (tagId: string) => {
    setAllTags((prev) => (prev || []).filter(t => t.id !== tagId))
    setSelectedTags((prev) => prev.filter(id => id !== tagId))
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePhotoSave = (newImage: string) => {
    setEditedImage(newImage)
    setIsEditingPhoto(false)
  }

  const handleSave = () => {
    if (!item) return

    const updates: Partial<ScannedItem> = {
      productName: formData.productName || undefined,
      description: formData.description || undefined,
      category: formData.category || undefined,
      condition: formData.condition || undefined,
      preferredPlatform: formData.preferredPlatform || undefined,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      estimatedSellPrice: formData.estimatedSellPrice ? parseFloat(formData.estimatedSellPrice) : undefined,
      notes: formData.notes || undefined,
      tags: selectedTags,
    }

    if (editedImage) {
      updates.imageData = editedImage
    }

    if (updates.estimatedSellPrice !== undefined && updates.estimatedSellPrice > 0) {
      const profit = updates.estimatedSellPrice - (updates.purchasePrice ?? 0)
      updates.profitMargin = (profit / updates.estimatedSellPrice) * 100
    } else {
      updates.profitMargin = undefined
    }

    onSave(item.id, updates)
    onClose()
  }

  const sellPrice = parseFloat(formData.estimatedSellPrice)
  const buyPrice = parseFloat(formData.purchasePrice)
  const profitMargin = (sellPrice > 0 && buyPrice >= 0 && !isNaN(sellPrice) && !isNaN(buyPrice))
    ? ((sellPrice - buyPrice) / sellPrice) * 100
    : null

  if (!item) return null

  const displayImage = editedImage || item.imageThumbnail || item.imageData

  return (
    <>
      {isEditingPhoto && displayImage && (
        <PhotoEditor
          imageData={displayImage}
          onSave={handlePhotoSave}
          onCancel={() => setIsEditingPhoto(false)}
          geminiService={geminiService}
        />
      )}
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-bg border-s2">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-t1">Edit Item Details</DialogTitle>
            <DialogDescription className="text-sm text-s4">
              Update product information before creating a listing
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {displayImage && (
                <div className="relative">
                  <img
                    src={displayImage}
                    alt={item.productName || 'Item'}
                    className="w-full h-48 object-cover rounded-md border border-s2"
                  />
                  <Button
                    onClick={() => setIsEditingPhoto(true)}
                    className="absolute bottom-2 right-2 bg-b1 hover:bg-b2 text-bg shadow-lg"
                    size="sm"
                  >
                    <PencilSimple size={16} weight="bold" className="mr-1.5" />
                    Edit Photo
                  </Button>
                  {editedImage && (
                    <Badge className="absolute top-2 left-2 bg-green text-bg">
                      Edited
                    </Badge>
                  )}
                </div>
              )}

            <div className="space-y-2">
              <Label htmlFor="edit-product-name" className="text-sm font-medium text-t1">
                Product Name
              </Label>
              <Input
                id="edit-product-name"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                placeholder="e.g., Vintage Nike Air Jordan Sneakers"
                className="bg-bg border-s2 text-t1 placeholder:text-s3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category" className="text-sm font-medium text-t1">
                Category
              </Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g., Footwear, Electronics, Clothing"
                className="bg-bg border-s2 text-t1 placeholder:text-s3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-condition" className="text-sm font-medium text-t1">
                  Condition
                </Label>
                <select
                  id="edit-condition"
                  value={formData.condition}
                  onChange={(e) => handleInputChange('condition', e.target.value)}
                  className="h-9 w-full rounded-md border border-s2 bg-bg px-3 text-sm text-t1"
                >
                  {['New', 'Like New', 'Very Good', 'Good', 'Fair', 'Poor'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-platform" className="text-sm font-medium text-t1">
                  Preferred Platform
                </Label>
                <select
                  id="edit-platform"
                  value={formData.preferredPlatform}
                  onChange={(e) => handleInputChange('preferredPlatform', e.target.value)}
                  className="h-9 w-full rounded-md border border-s2 bg-bg px-3 text-sm text-t1"
                >
                  <option value="">— any —</option>
                  {['eBay', 'Mercari', 'Poshmark', 'Facebook Marketplace', 'Depop', 'Grailed', 'Whatnot'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-purchase-price" className="text-sm font-medium text-t1">
                  Purchase Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-s4 font-mono">$</span>
                  <Input
                    id="edit-purchase-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                    className="bg-bg border-s2 text-t1 pl-7 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sell-price" className="text-sm font-medium text-t1">
                  Estimated Sell Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-s4 font-mono">$</span>
                  <Input
                    id="edit-sell-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estimatedSellPrice}
                    onChange={(e) => handleInputChange('estimatedSellPrice', e.target.value)}
                    className="bg-bg border-s2 text-t1 pl-7 font-mono"
                  />
                </div>
              </div>
            </div>

            {profitMargin !== null && !isNaN(profitMargin) && isFinite(profitMargin) && (
              <div className="flex items-center gap-2 p-3 bg-s1 border border-s2 rounded-md">
                <span className="text-xs font-medium text-t1">Profit Margin:</span>
                <Badge
                  variant="secondary"
                  className={`font-mono font-medium ${
                    profitMargin > 50
                      ? 'bg-green/20 text-green'
                      : profitMargin > 20
                      ? 'bg-amber/20 text-amber'
                      : 'bg-red/20 text-red'
                  }`}
                >
                  {profitMargin.toFixed(1)}%
                </Badge>
                <span className="text-xs text-s4 ml-auto font-mono">
                  ${(parseFloat(formData.estimatedSellPrice) - parseFloat(formData.purchasePrice)).toFixed(2)} profit
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm font-medium text-t1">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description === 'Product analysis unavailable' ? '' : formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder={formData.description === 'Product analysis unavailable'
                  ? 'Product analysis unavailable — add manually or tap Re-analyze'
                  : 'Add detailed product description, condition, features...'}
                rows={4}
                className="bg-bg border-s2 text-t1 placeholder:text-s3 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-sm font-medium text-t1">
                Notes (Internal)
              </Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Private notes, storage location, sourcing details..."
                rows={3}
                className="bg-bg border-s2 text-t1 placeholder:text-s3 resize-none"
              />
            </div>

            {suggestedTags.length > 0 && (
              <SuggestedTags
                suggestions={suggestedTags}
                onApply={handleApplySuggestedTags}
                onApplyTag={handleApplySingleTag}
                appliedTags={selectedTags}
              />
            )}

            <TagManager
              tags={allTags || []}
              selectedTags={selectedTags}
              onTagsChange={handleTagsChange}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
            />
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-4 pt-4 border-t border-s2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-s2 text-s4 hover:bg-s1 hover:text-t1"
          >
            <X size={16} weight="bold" className="mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-b1 hover:bg-b2 text-bg font-medium"
          >
            <FloppyDisk size={16} weight="bold" className="mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
