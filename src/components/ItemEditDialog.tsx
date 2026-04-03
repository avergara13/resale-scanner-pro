import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FloppyDisk, X, PencilSimple } from '@phosphor-icons/react'
import { PhotoEditor } from '@/components/PhotoEditor'
import type { ScannedItem } from '@/types'
import type { GeminiService } from '@/lib/gemini-service'

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
    purchasePrice: item?.purchasePrice.toString() || '0',
    estimatedSellPrice: item?.estimatedSellPrice?.toString() || '',
    notes: item?.notes || '',
  })
  const [editedImage, setEditedImage] = useState<string | null>(null)
  const [isEditingPhoto, setIsEditingPhoto] = useState(false)

  useEffect(() => {
    if (item) {
      setFormData({
        productName: item.productName || '',
        description: item.description || '',
        category: item.category || '',
        purchasePrice: item.purchasePrice.toString() || '0',
        estimatedSellPrice: item.estimatedSellPrice?.toString() || '',
        notes: item.notes || '',
      })
      setEditedImage(null)
    }
  }, [item])

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
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      estimatedSellPrice: formData.estimatedSellPrice ? parseFloat(formData.estimatedSellPrice) : undefined,
      notes: formData.notes || undefined,
    }

    if (editedImage) {
      updates.imageData = editedImage
    }

    if (updates.purchasePrice !== undefined && updates.estimatedSellPrice !== undefined) {
      const profit = updates.estimatedSellPrice - updates.purchasePrice
      const margin = (profit / updates.estimatedSellPrice) * 100
      updates.profitMargin = margin
    }

    onSave(item.id, updates)
    onClose()
  }

  const profitMargin = formData.estimatedSellPrice && formData.purchasePrice
    ? (((parseFloat(formData.estimatedSellPrice) - parseFloat(formData.purchasePrice)) / parseFloat(formData.estimatedSellPrice)) * 100)
    : null

  if (!item) return null

  const displayImage = editedImage || item.imageData

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
            <DialogTitle className="text-lg font-semibold text-fg">Edit Item Details</DialogTitle>
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
              <Label htmlFor="edit-product-name" className="text-sm font-medium text-fg">
                Product Name
              </Label>
              <Input
                id="edit-product-name"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                placeholder="e.g., Vintage Nike Air Jordan Sneakers"
                className="bg-bg border-s2 text-fg placeholder:text-s3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category" className="text-sm font-medium text-fg">
                Category
              </Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g., Footwear, Electronics, Clothing"
                className="bg-bg border-s2 text-fg placeholder:text-s3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-purchase-price" className="text-sm font-medium text-fg">
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
                    className="bg-bg border-s2 text-fg pl-7 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sell-price" className="text-sm font-medium text-fg">
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
                    className="bg-bg border-s2 text-fg pl-7 font-mono"
                  />
                </div>
              </div>
            </div>

            {profitMargin !== null && !isNaN(profitMargin) && (
              <div className="flex items-center gap-2 p-3 bg-t4 border border-t3 rounded-md">
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
              <Label htmlFor="edit-description" className="text-sm font-medium text-fg">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Add detailed product description, condition, features..."
                rows={4}
                className="bg-bg border-s2 text-fg placeholder:text-s3 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-sm font-medium text-fg">
                Notes (Internal)
              </Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Private notes, storage location, sourcing details..."
                rows={3}
                className="bg-bg border-s2 text-fg placeholder:text-s3 resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-4 pt-4 border-t border-s2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-s2 text-s4 hover:bg-s1 hover:text-fg"
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
