import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Lightning, Check, Scan, Crosshair } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ObjectDetectionService, DetectedObject, ObjectDetectionResult } from '@/lib/object-detection-service'
import { MultiObjectSelector } from './MultiObjectSelector'
import type { DetectedProduct } from '@/types'

interface CameraOverlayProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (imageData: string, price: number) => void
  onQuickDraft?: (imageData: string, price: number) => void
  onMultiCapture?: (products: DetectedProduct[], baseImageData: string, totalPrice: number) => void
  objectDetectionService?: ObjectDetectionService | null
}

export function CameraOverlay({ isOpen, onClose, onCapture, onQuickDraft, onMultiCapture, objectDetectionService }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const detectionIntervalRef = useRef<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [mode, setMode] = useState<'lens' | 'listing'>('lens')
  const [price, setPrice] = useState('')
  const [quickDraftMode, setQuickDraftMode] = useState(false)
  const [draftCount, setDraftCount] = useState(0)
  const [showCaptureFlash, setShowCaptureFlash] = useState(false)
  const [detectionEnabled, setDetectionEnabled] = useState(false)
  const [detectionResult, setDetectionResult] = useState<ObjectDetectionResult | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [showMultiSelector, setShowMultiSelector] = useState(false)
  const [capturedImageForMulti, setCapturedImageForMulti] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      startCamera()
      setDraftCount(0)
    } else {
      stopCamera()
      stopDetection()
      setPrice('')
      setQuickDraftMode(false)
      setDetectionEnabled(false)
      setDetectionResult(null)
    }
    return () => {
      stopCamera()
      stopDetection()
    }
  }, [isOpen])

  useEffect(() => {
    if (detectionEnabled && objectDetectionService && videoRef.current) {
      startDetection()
    } else {
      stopDetection()
    }
    return () => stopDetection()
  }, [detectionEnabled, objectDetectionService])

  const startDetection = useCallback(() => {
    if (!objectDetectionService || !videoRef.current || detectionIntervalRef.current) return

    const runDetection = async () => {
      if (!videoRef.current || !overlayCanvasRef.current || isDetecting) return
      
      const video = videoRef.current
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return

      setIsDetecting(true)
      
      try {
        const result = await objectDetectionService.detectObjectsFromVideo(video)
        setDetectionResult(result)
        
        const canvas = overlayCanvasRef.current
        const context = canvas.getContext('2d')
        if (context) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.clearRect(0, 0, canvas.width, canvas.height)
          
          objectDetectionService.drawDetectionOverlay(canvas, result, {
            showMainOnly: true,
            showCropSuggestion: false,
            highlightColor: '#00ff00',
          })
        }
      } catch (error) {
        console.error('Object detection failed:', error)
      } finally {
        setIsDetecting(false)
      }
    }

    runDetection()
    detectionIntervalRef.current = window.setInterval(runDetection, 2000)
  }, [objectDetectionService, isDetecting])

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
    if (overlayCanvasRef.current) {
      const context = overlayCanvasRef.current.getContext('2d')
      if (context) {
        context.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.warn('Environment camera not found, falling back to default camera', err)
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (fallbackErr) {
        console.error('Camera error:', fallbackErr)
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (mode === 'lens' && !price) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      const imageData = canvas.toDataURL('image/jpeg', 0.9)
      
      if (detectionEnabled && detectionResult && detectionResult.objects.length > 1 && onMultiCapture && !quickDraftMode) {
        setCapturedImageForMulti(imageData)
        setShowMultiSelector(true)
        setShowCaptureFlash(true)
        setTimeout(() => setShowCaptureFlash(false), 300)
        return
      }
      
      if (quickDraftMode && onQuickDraft) {
        onQuickDraft(imageData, parseFloat(price) || 0)
        setDraftCount(prev => prev + 1)
        setShowCaptureFlash(true)
        setTimeout(() => setShowCaptureFlash(false), 300)
        setPrice('')
      } else {
        onCapture(imageData, parseFloat(price) || 0)
        setPrice('')
      }
    }
  }

  const handleMultiProductsSelected = (products: DetectedProduct[]) => {
    if (onMultiCapture) {
      onMultiCapture(products, capturedImageForMulti, parseFloat(price) || 0)
    }
    setShowMultiSelector(false)
    setCapturedImageForMulti('')
    setPrice('')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          id="camera-overlay"
          className="fixed inset-0 z-50 bg-black flex flex-col"
          style={{ maxWidth: '480px', margin: '0 auto' }}
        >
          <div className="relative flex-1 bg-neutral-900 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover opacity-80"
            />

            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ opacity: detectionEnabled ? 1 : 0, transition: 'opacity 0.3s' }}
            />

            <AnimatePresence>
              {showCaptureFlash && (
                <motion.div
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-white pointer-events-none z-20"
                />
              )}
            </AnimatePresence>

            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex bg-black/50 p-1 rounded-xl w-48 backdrop-blur-md border border-white/10 z-10">
              <button
                onClick={() => setMode('lens')}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                  mode === 'lens' ? 'bg-white text-black shadow-sm' : 'text-white'
                )}
              >
                AI LENS
              </button>
              <button
                onClick={() => setMode('listing')}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                  mode === 'listing' ? 'bg-white text-black shadow-sm' : 'text-white'
                )}
              >
                LISTING
              </button>
            </div>

            {onQuickDraft && mode === 'lens' && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setQuickDraftMode(!quickDraftMode)}
                className={cn(
                  'absolute top-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all z-10',
                  quickDraftMode
                    ? 'bg-amber/90 border-amber text-black shadow-lg'
                    : 'bg-black/50 border-white/20 text-white'
                )}
              >
                <Lightning size={16} weight={quickDraftMode ? 'fill' : 'regular'} />
                <span className="text-xs font-bold">QUICK DRAFT</span>
                {quickDraftMode && draftCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center w-5 h-5 bg-black text-amber text-xs font-bold rounded-full"
                  >
                    {draftCount}
                  </motion.span>
                )}
              </motion.button>
            )}

            {objectDetectionService && mode === 'lens' && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setDetectionEnabled(!detectionEnabled)}
                className={cn(
                  'absolute top-32 left-6 flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md border transition-all z-10',
                  detectionEnabled
                    ? 'bg-green/90 border-green text-black shadow-lg'
                    : 'bg-black/50 border-white/20 text-white'
                )}
                disabled={isDetecting}
              >
                {isDetecting ? (
                  <Scan size={18} className="animate-pulse" />
                ) : (
                  <Crosshair size={18} weight={detectionEnabled ? 'fill' : 'regular'} />
                )}
                <span className="text-xs font-bold">DETECT</span>
              </motion.button>
            )}

            {detectionResult && detectionResult.mainProduct && detectionEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-52 left-6 right-6 bg-black/80 backdrop-blur-md border border-green/40 rounded-lg px-4 py-3 z-10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green rounded-full animate-pulse" />
                  <span className="text-green text-xs font-bold">PRODUCT DETECTED</span>
                </div>
                <p className="text-white text-sm font-medium">{detectionResult.mainProduct.name}</p>
                <p className="text-white/60 text-xs">{Math.round(detectionResult.mainProduct.confidence * 100)}% confidence</p>
              </motion.div>
            )}

            <div className="absolute inset-12 border-2 border-white/30 pointer-events-none mt-24">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-black/40 text-white rounded-full z-10"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-black p-6 pb-10 flex flex-col gap-4">
            {mode === 'lens' && (
              <input
                id="camera-price"
                type="number"
                step="0.01"
                placeholder="Enter price ($)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-white/10 text-white border border-white/20 rounded-lg h-12 px-4 text-base font-mono placeholder:text-white/40 outline-none focus:border-white/60"
              />
            )}
            
            {quickDraftMode && draftCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between bg-amber/20 border border-amber/40 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Check size={20} weight="bold" className="text-amber" />
                  <span className="text-amber text-sm font-bold">
                    {draftCount} {draftCount === 1 ? 'draft' : 'drafts'} captured
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-xs font-bold text-amber underline"
                >
                  DONE
                </button>
              </motion.div>
            )}
            
            <div className="flex items-center justify-center px-4 gap-4">
              <button
                onClick={handleCapture}
                disabled={mode === 'lens' && !price}
                className={cn(
                  'w-20 h-20 rounded-full border-4 p-1 disabled:opacity-40 transition-all',
                  quickDraftMode ? 'border-amber' : 'border-white'
                )}
              >
                <div
                  className={cn(
                    'w-full h-full rounded-full active:scale-90 transition-transform',
                    quickDraftMode ? 'bg-amber' : mode === 'lens' ? 'bg-white' : 'bg-b1'
                  )}
                />
              </button>
            </div>
            
            {quickDraftMode && (
              <p className="text-center text-white/60 text-xs">
                Captures saved as drafts • Stay in camera for multiple items
              </p>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      )}
      
      {showMultiSelector && detectionResult && (
        <MultiObjectSelector
          isOpen={showMultiSelector}
          onClose={() => {
            setShowMultiSelector(false)
            setCapturedImageForMulti('')
          }}
          imageData={capturedImageForMulti}
          detectedObjects={detectionResult.objects.map(obj => ({
            id: `${obj.name}-${obj.boundingBox.x}-${obj.boundingBox.y}`,
            name: obj.name,
            confidence: obj.confidence,
            boundingBox: obj.boundingBox,
          }))}
          onSelectProducts={handleMultiProductsSelected}
          purchasePrice={parseFloat(price) || 0}
        />
      )}
    </AnimatePresence>
  )
}
