import { useState } from 'react'
import { X, Check, ArrowsOut, Sun, CircleHalf, Drop } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { photoEditorService } from '@/lib/photo-editor-service'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface PhotoEditorProps {
  imageData: string
  onSave: (editedImage: string) => void
  onCancel: () => void
}

export function PhotoEditor({ imageData, onSave, onCancel }: PhotoEditorProps) {
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [saturation, setSaturation] = useState(1)
  const [preview, setPreview] = useState(imageData)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleApplyFilters = async () => {
    setIsProcessing(true)
    try {
      const edited = await photoEditorService.editPhoto(imageData, {
        brightness,
        contrast,
        saturation,
      })
      setPreview(edited)
      toast.success('Filters applied')
    } catch (error) {
      console.error('Photo edit error:', error)
      toast.error('Failed to apply filters')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOptimizeForEbay = async () => {
    setIsProcessing(true)
    try {
      const optimized = await photoEditorService.optimizeForEbay(imageData)
      setPreview(optimized)
      toast.success('Optimized for eBay')
    } catch (error) {
      console.error('Optimization error:', error)
      toast.error('Optimization failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = () => {
    onSave(preview)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        style={{ maxWidth: '480px', margin: '0 auto' }}
      >
        <Card className="w-full max-h-[90vh] overflow-y-auto bg-bg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Edit Photo</h2>
            <button onClick={onCancel} className="p-2 hover:bg-s1 rounded-md">
              <X size={20} />
            </button>
          </div>

          <div className="mb-4">
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-lg border border-s2"
            />
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sun size={18} className="text-s3" />
                <label className="text-sm font-medium">Brightness</label>
                <span className="ml-auto text-xs text-s3">{brightness}</span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={(val) => setBrightness(val[0])}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <CircleHalf size={18} className="text-s3" />
                <label className="text-sm font-medium">Contrast</label>
                <span className="ml-auto text-xs text-s3">{contrast}</span>
              </div>
              <Slider
                value={[contrast]}
                onValueChange={(val) => setContrast(val[0])}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Drop size={18} className="text-s3" />
                <label className="text-sm font-medium">Saturation</label>
                <span className="ml-auto text-xs text-s3">{saturation.toFixed(1)}</span>
              </div>
              <Slider
                value={[saturation]}
                onValueChange={(val) => setSaturation(val[0])}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <Button
              onClick={handleApplyFilters}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              Apply Filters
            </Button>
            <Button
              onClick={handleOptimizeForEbay}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              <ArrowsOut size={18} className="mr-2" />
              Optimize
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-b1 hover:bg-b2">
              <Check size={18} className="mr-2" />
              Save
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
