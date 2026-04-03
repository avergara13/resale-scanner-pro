import { useState, useEffect, useRef } from 'react'
import { 
  X, Check, ArrowsOut, Sun, CircleHalf, Drop, Sparkle, 
  Scissors, ArrowClockwise, ArrowsDownUp, ArrowsLeftRight, 
  Palette, CornersOut, TextT
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { photoEditorService } from '@/lib/photo-editor-service'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface PhotoEditorProps {
  imageData: string
  onSave: (editedImage: string) => void
  onCancel: () => void
}

const FILTER_PRESETS = [
  { name: 'None', value: 'none' as const, preview: 'Original' },
  { name: 'Vivid', value: 'vivid' as const, preview: 'Rich colors' },
  { name: 'Clean', value: 'clean' as const, preview: 'Crisp & bright' },
  { name: 'Warm', value: 'warm' as const, preview: 'Cozy tones' },
  { name: 'Cool', value: 'cool' as const, preview: 'Blue tint' },
  { name: 'B&W', value: 'bw' as const, preview: 'Black & white' },
]

export function PhotoEditor({ imageData, onSave, onCancel }: PhotoEditorProps) {
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [saturation, setSaturation] = useState(1)
  const [sharpness, setSharpness] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'none' | 'vivid' | 'clean' | 'warm' | 'cool' | 'bw'>('none')
  const [preview, setPreview] = useState(imageData)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('adjust')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setPreview(imageData)
  }, [imageData])

  const handleApplyFilters = async () => {
    setIsProcessing(true)
    try {
      const edited = await photoEditorService.editPhoto(imageData, {
        brightness,
        contrast,
        saturation,
        sharpness,
        rotation,
        flipHorizontal: flipH,
        flipVertical: flipV,
        filter: selectedFilter,
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
      setBrightness(10)
      setContrast(8)
      setSaturation(1.15)
      setSharpness(0.3)
      setSelectedFilter('clean')
      toast.success('Optimized for eBay')
    } catch (error) {
      console.error('Optimization error:', error)
      toast.error('Optimization failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAutoEnhance = async () => {
    setIsProcessing(true)
    try {
      const enhanced = await photoEditorService.autoEnhance(imageData)
      setPreview(enhanced)
      setBrightness(5)
      setContrast(10)
      setSaturation(1.1)
      setSharpness(0.2)
      toast.success('Auto-enhanced')
    } catch (error) {
      console.error('Auto-enhance error:', error)
      toast.error('Auto-enhance failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCropToSquare = async () => {
    setIsProcessing(true)
    try {
      const cropped = await photoEditorService.cropToSquare(imageData)
      setPreview(cropped)
      toast.success('Cropped to square')
    } catch (error) {
      console.error('Crop error:', error)
      toast.error('Crop failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRotate = (degrees: number) => {
    const newRotation = (rotation + degrees) % 360
    setRotation(newRotation)
  }

  const handleFilterSelect = async (filter: typeof selectedFilter) => {
    setSelectedFilter(filter)
    setIsProcessing(true)
    try {
      const filtered = await photoEditorService.editPhoto(imageData, {
        brightness,
        contrast,
        saturation,
        sharpness,
        rotation,
        flipHorizontal: flipH,
        flipVertical: flipV,
        filter,
      })
      setPreview(filtered)
    } catch (error) {
      console.error('Filter error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setBrightness(0)
    setContrast(0)
    setSaturation(1)
    setSharpness(0)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setSelectedFilter('none')
    setPreview(imageData)
    toast.info('Reset to original')
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
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
        style={{ maxWidth: '480px', margin: '0 auto' }}
      >
        <div className="w-full h-full flex flex-col bg-bg">
          <div className="flex items-center justify-between p-4 border-b border-s2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Edit Photo</h2>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-s1 rounded-md transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="mb-4 relative bg-s1 rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto"
                  style={{
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                    transition: 'transform 0.3s ease'
                  }}
                />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-3 mb-4">
                  <TabsTrigger value="adjust">
                    <CircleHalf size={16} className="mr-1.5" />
                    Adjust
                  </TabsTrigger>
                  <TabsTrigger value="filters">
                    <Palette size={16} className="mr-1.5" />
                    Filters
                  </TabsTrigger>
                  <TabsTrigger value="transform">
                    <ArrowClockwise size={16} className="mr-1.5" />
                    Transform
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="adjust" className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sun size={18} className="text-s3" />
                      <label className="text-sm font-medium">Brightness</label>
                      <span className="ml-auto text-xs font-mono text-s3">{brightness}</span>
                    </div>
                    <Slider
                      value={[brightness]}
                      onValueChange={(val) => setBrightness(val[0])}
                      min={-100}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CircleHalf size={18} className="text-s3" />
                      <label className="text-sm font-medium">Contrast</label>
                      <span className="ml-auto text-xs font-mono text-s3">{contrast}</span>
                    </div>
                    <Slider
                      value={[contrast]}
                      onValueChange={(val) => setContrast(val[0])}
                      min={-100}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Drop size={18} className="text-s3" />
                      <label className="text-sm font-medium">Saturation</label>
                      <span className="ml-auto text-xs font-mono text-s3">{saturation.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[saturation]}
                      onValueChange={(val) => setSaturation(val[0])}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkle size={18} className="text-s3" />
                      <label className="text-sm font-medium">Sharpness</label>
                      <span className="ml-auto text-xs font-mono text-s3">{sharpness.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[sharpness]}
                      onValueChange={(val) => setSharpness(val[0])}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      onClick={handleAutoEnhance}
                      disabled={isProcessing}
                      variant="outline"
                      className="w-full"
                    >
                      <Sparkle size={16} className="mr-2" />
                      Auto Enhance
                    </Button>
                    <Button
                      onClick={handleApplyFilters}
                      disabled={isProcessing}
                      className="w-full bg-b1 hover:bg-b2"
                    >
                      Apply Changes
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="filters" className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_PRESETS.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => handleFilterSelect(filter.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedFilter === filter.value
                            ? 'border-b1 bg-t4'
                            : 'border-s2 bg-s1 hover:border-s3'
                        }`}
                      >
                        <div className="font-medium text-sm mb-1">{filter.name}</div>
                        <div className="text-xs text-s3">{filter.preview}</div>
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleOptimizeForEbay}
                    disabled={isProcessing}
                    className="w-full bg-b1 hover:bg-b2"
                  >
                    <ArrowsOut size={18} className="mr-2" />
                    eBay Optimize
                  </Button>
                </TabsContent>

                <TabsContent value="transform" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Rotate</label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        onClick={() => handleRotate(-90)}
                        variant="outline"
                        className="flex flex-col items-center py-3"
                      >
                        <ArrowClockwise size={20} className="mb-1 rotate-180" />
                        <span className="text-xs">-90°</span>
                      </Button>
                      <Button
                        onClick={() => handleRotate(90)}
                        variant="outline"
                        className="flex flex-col items-center py-3"
                      >
                        <ArrowClockwise size={20} className="mb-1" />
                        <span className="text-xs">90°</span>
                      </Button>
                      <Button
                        onClick={() => handleRotate(180)}
                        variant="outline"
                        className="flex flex-col items-center py-3"
                      >
                        <ArrowClockwise size={20} className="mb-1" />
                        <span className="text-xs">180°</span>
                      </Button>
                      <Button
                        onClick={() => setRotation(0)}
                        variant="outline"
                        className="flex flex-col items-center py-3"
                      >
                        <X size={20} className="mb-1" />
                        <span className="text-xs">Reset</span>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Flip</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setFlipH(!flipH)}
                        variant={flipH ? "default" : "outline"}
                        className="flex items-center justify-center"
                      >
                        <ArrowsLeftRight size={18} className="mr-2" />
                        Horizontal
                      </Button>
                      <Button
                        onClick={() => setFlipV(!flipV)}
                        variant={flipV ? "default" : "outline"}
                        className="flex items-center justify-center"
                      >
                        <ArrowsDownUp size={18} className="mr-2" />
                        Vertical
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Crop</label>
                    <Button
                      onClick={handleCropToSquare}
                      disabled={isProcessing}
                      variant="outline"
                      className="w-full"
                    >
                      <CornersOut size={18} className="mr-2" />
                      Crop to Square
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="p-4 border-t border-s2 flex gap-2 bg-bg safe-bottom">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              <ArrowClockwise size={18} className="mr-2" />
              Reset
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-b1 hover:bg-b2">
              <Check size={18} className="mr-2" />
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
