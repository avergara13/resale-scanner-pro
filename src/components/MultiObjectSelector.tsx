import { useState, useRef, useEffect } from 'react'
import { X, Check, Scan, Package } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import type { DetectedProduct } from '@/types'

interface DetectedObjectWithBox {
  id: string
  name: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface MultiObjectSelectorProps {
  isOpen: boolean
  onClose: () => void
  imageData: string
  detectedObjects: DetectedObjectWithBox[]
  onSelectProducts: (products: DetectedProduct[]) => void
  purchasePrice: number
}

export function MultiObjectSelector({
  isOpen,
  onClose,
  imageData,
  detectedObjects,
  onSelectProducts,
  purchasePrice,
}: MultiObjectSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [individualPrices, setIndividualPrices] = useState<Map<string, number>>(new Map())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (isOpen && imageData && detectedObjects.length > 0) {
      const defaultPrice = purchasePrice / detectedObjects.length
      const prices = new Map<string, number>()
      detectedObjects.forEach(obj => {
        prices.set(obj.id, defaultPrice)
      })
      setIndividualPrices(prices)
    }
  }, [isOpen, detectedObjects, purchasePrice])

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !imageRef.current || !imageData) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      
      detectedObjects.forEach((obj) => {
        const isSelected = selectedIds.has(obj.id)
        const box = {
          x: obj.boundingBox.x * img.width,
          y: obj.boundingBox.y * img.height,
          width: obj.boundingBox.width * img.width,
          height: obj.boundingBox.height * img.height,
        }

        ctx.strokeStyle = isSelected ? '#00ff00' : '#ffffff'
        ctx.lineWidth = isSelected ? 4 : 2
        ctx.strokeRect(box.x, box.y, box.width, box.height)

        if (isSelected) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'
          ctx.fillRect(box.x, box.y, box.width, box.height)
        }

        ctx.font = 'bold 14px IBM Plex Sans'
        const label = `${obj.name} (${Math.round(obj.confidence * 100)}%)`
        const textWidth = ctx.measureText(label).width
        
        ctx.fillStyle = isSelected ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(box.x, box.y - 22, textWidth + 10, 22)
        
        ctx.fillStyle = '#000000'
        ctx.fillText(label, box.x + 5, box.y - 6)

        if (isSelected) {
          ctx.fillStyle = '#00ff00'
          ctx.beginPath()
          ctx.arc(box.x + box.width - 15, box.y + 15, 10, 0, 2 * Math.PI)
          ctx.fill()
          
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(box.x + box.width - 18, box.y + 15)
          ctx.lineTo(box.x + box.width - 15, box.y + 18)
          ctx.lineTo(box.x + box.width - 10, box.y + 11)
          ctx.stroke()
        }
      })
    }
    img.src = imageData
  }, [isOpen, imageData, detectedObjects, selectedIds])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const updatePrice = (id: string, price: number) => {
    setIndividualPrices(prev => {
      const newMap = new Map(prev)
      newMap.set(id, price)
      return newMap
    })
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.src = imageData
    })

    const products: DetectedProduct[] = []

    for (const obj of detectedObjects) {
      if (!selectedIds.has(obj.id)) continue

      const box = {
        x: obj.boundingBox.x * img.width,
        y: obj.boundingBox.y * img.height,
        width: obj.boundingBox.width * img.width,
        height: obj.boundingBox.height * img.height,
      }

      const padding = 10
      const cropX = Math.max(0, box.x - padding)
      const cropY = Math.max(0, box.y - padding)
      const cropWidth = Math.min(img.width - cropX, box.width + padding * 2)
      const cropHeight = Math.min(img.height - cropY, box.height + padding * 2)

      canvas.width = cropWidth
      canvas.height = cropHeight
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      )

      const croppedImageData = canvas.toDataURL('image/jpeg', 0.9)

      products.push({
        id: obj.id,
        name: obj.name,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox,
        croppedImageData,
      })
    }

    onSelectProducts(products)
    onClose()
  }

  const totalPrice = Array.from(selectedIds).reduce((sum, id) => {
    return sum + (individualPrices.get(id) || 0)
  }, 0)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
        style={{ maxWidth: '480px', margin: '0 auto' }}
      >
        <div className="flex items-center justify-between p-4 bg-black/50 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Package size={24} className="text-green" weight="duotone" />
            <div>
              <h2 className="text-white font-bold text-lg">Multiple Items Detected</h2>
              <p className="text-white/60 text-xs">Select products to analyze separately</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="relative bg-s1 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
            />
            <img
              ref={imageRef}
              src={imageData}
              alt="Detected objects"
              className="hidden"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-medium">
                {selectedIds.size} of {detectedObjects.length} selected
              </p>
              <p className="text-green text-sm font-bold font-mono">
                Total: ${totalPrice.toFixed(2)}
              </p>
            </div>

            {detectedObjects.map((obj) => {
              const isSelected = selectedIds.has(obj.id)
              const price = individualPrices.get(obj.id) || 0

              return (
                <motion.div
                  key={obj.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'bg-s1 border-2 rounded-lg p-3 transition-all cursor-pointer',
                    isSelected ? 'border-green bg-green/5' : 'border-s2'
                  )}
                  onClick={() => toggleSelection(obj.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all flex-shrink-0',
                        isSelected
                          ? 'bg-green border-green'
                          : 'bg-transparent border-s3'
                      )}
                    >
                      {isSelected && <Check size={14} weight="bold" className="text-black" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-fg font-semibold text-sm truncate">{obj.name}</p>
                      <p className="text-s4 text-xs">
                        {Math.round(obj.confidence * 100)}% confidence
                      </p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-s4 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => updatePrice(obj.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 bg-bg border border-s2 rounded text-fg text-sm font-mono text-right"
                        disabled={!isSelected}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="p-4 bg-black/50 border-t border-white/10 space-y-2 safe-bottom">
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="w-full bg-green text-black font-bold py-6 hover:bg-green/90"
          >
            <Scan size={20} weight="bold" />
            Analyze {selectedIds.size} Selected {selectedIds.size === 1 ? 'Item' : 'Items'}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
