import { useRef, useState, useEffect, useMemo } from 'react'
import { X, Lightning, Check, Barcode as BarcodeIcon, Camera, Images, MagicWand, GridFour, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { BarcodeScanner } from './BarcodeScanner'
import { createBarcodeService } from '@/lib/barcode-service'
import type { BarcodeProduct } from '@/lib/barcode-service'

/** Matches the Condition select in AIScreen so the camera-side choice round-trips */
const CONDITIONS = ['New', 'Like New', 'Very Good', 'Good', 'Acceptable', 'For Parts'] as const

const LISTING_PHOTO_TIPS = [
  'Front view — clean, well-lit',
  'Back view — show labels/tags',
  'Detail shot — brand, flaws, features',
  'Size/scale reference',
  'Packaging (if applicable)',
]

interface CameraOverlayProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (imageData: string, price: number, barcodeProduct?: BarcodeProduct, condition?: string) => void
  onQuickDraft?: (imageData: string, price: number, barcodeProduct?: BarcodeProduct, condition?: string) => void
  /**
   * When provided and `isAddPhotoMode` is true, a successful barcode lookup while the
   * camera is open in add-photo mode merges the product data into the current item
   * instead of waiting for a new-scan capture.
   */
  onBarcodeForCurrentItem?: (product: BarcodeProduct) => void
  /** True when the camera was opened from the scan-result screen to add more photos/data
   *  to an existing item. Switches barcode handling to merge-into-current-item behavior. */
  isAddPhotoMode?: boolean
  geminiApiKey?: string
}

export function CameraOverlay({ isOpen, onClose, onCapture, onQuickDraft, onBarcodeForCurrentItem, isAddPhotoMode, geminiApiKey }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMountedRef = useRef(true)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [mode, setMode] = useState<'lens' | 'listing' | 'barcode'>('lens')
  const [price, setPrice] = useState('')
  const [quickDraftMode, setQuickDraftMode] = useState(false)
  const [draftCount, setDraftCount] = useState(0)
  const [showCaptureFlash, setShowCaptureFlash] = useState(false)
  const [listingPhotos, setListingPhotos] = useState<string[]>([])
  const [showGrid, setShowGrid] = useState(true)
  const [autoEnhance, setAutoEnhance] = useState(true)
  const [condition, setCondition] = useState<string>('New')
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  
  const barcodeService = useMemo(() => createBarcodeService(geminiApiKey), [geminiApiKey])

  useEffect(() => {
    isMountedRef.current = true
    if (isOpen) {
      startCamera()
      setDraftCount(0)
    } else {
      stopCamera()
      setPrice('')
      setQuickDraftMode(false)
      setCondition('New')
    }
    return () => {
      isMountedRef.current = false
      stopCamera()
    }
  }, [isOpen])

  const startCamera = async () => {
    const applyStream = (mediaStream: MediaStream) => {
      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach(t => t.stop())
        return
      }
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setCameraError(null)
      applyStream(mediaStream)
    } catch (err) {
      console.warn('Environment camera not found, falling back to default camera', err)
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
        setCameraError(null)
        applyStream(mediaStream)
      } catch (fallbackErr) {
        console.error('Camera error:', fallbackErr)
        if (isMountedRef.current) {
          const msg = fallbackErr instanceof Error && fallbackErr.name === 'NotAllowedError'
            ? 'Camera access denied. Please allow camera permission in your browser settings.'
            : 'Camera unavailable. Check that no other app is using it and try again.'
          setCameraError(msg)
        }
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const enhanceListingPhoto = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const imgData = ctx.getImageData(0, 0, w, h)
    const d = imgData.data
    // Compute average brightness
    let totalBrightness = 0
    for (let i = 0; i < d.length; i += 4) {
      totalBrightness += (d[i] + d[i + 1] + d[i + 2]) / 3
    }
    const avgBrightness = totalBrightness / (d.length / 4)
    // Target brightness ~140 for well-lit product photos
    const brightnessFactor = avgBrightness < 80 ? 1.3 : avgBrightness < 120 ? 1.1 : 1.0
    // Slight contrast boost
    const contrastFactor = 1.08
    const intercept = 128 * (1 - contrastFactor)
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.max(0, d[i] * brightnessFactor * contrastFactor + intercept))
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * brightnessFactor * contrastFactor + intercept))
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * brightnessFactor * contrastFactor + intercept))
    }
    ctx.putImageData(imgData, 0, 0)
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0)

      // Auto-enhance listing photos for brighter, higher-contrast product shots
      if (mode === 'listing' && autoEnhance) {
        enhanceListingPhoto(ctx, canvas.width, canvas.height)
      }

      const imageData = canvas.toDataURL('image/jpeg', mode === 'listing' ? 0.95 : 0.9)

      if (mode === 'listing') {
        // Multi-photo: add to listing photos set
        setListingPhotos(prev => [...prev, imageData])
        setShowCaptureFlash(true)
        setTimeout(() => setShowCaptureFlash(false), 300)
        return
      }

      const capturedBarcodeProduct = barcodeProduct || undefined
      if (quickDraftMode && onQuickDraft) {
        onQuickDraft(imageData, parseFloat(price) || 0, capturedBarcodeProduct, condition)
        setDraftCount(prev => prev + 1)
        setShowCaptureFlash(true)
        setTimeout(() => setShowCaptureFlash(false), 300)
        setPrice('')
      } else {
        onCapture(imageData, parseFloat(price) || 0, capturedBarcodeProduct, condition)
        setPrice('')
      }
      setBarcodeProduct(null)
    }
  }

  const handleBarcodeDetected = async (barcode: string, product?: BarcodeProduct) => {
    setBarcodeProduct(product || null)
    if (product) {
      // When camera was opened from scan-result to add more research to an existing item,
      // merge barcode data into the current item instead of waiting for a photo capture.
      // The user can still take a photo after — that flows through onCapture as normal.
      if (isAddPhotoMode && onBarcodeForCurrentItem) {
        onBarcodeForCurrentItem(product)
      }
      setMode('lens')
    }
  }

  const handleLookupProduct = async (barcode: string): Promise<BarcodeProduct | null> => {
    const result = await barcodeService.lookupBarcode(barcode)
    if (result.success && result.product) {
      return result.product
    }
    return null
  }

  return (
    <>
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

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-neutral-900/95 z-10">
                  <div className="text-3xl mb-3">📷</div>
                  <p className="text-white text-sm font-medium leading-snug">{cameraError}</p>
                  <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

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

              <div
                className="absolute left-1/2 -translate-x-1/2 flex bg-black/60 p-1 rounded-2xl backdrop-blur-md border border-white/10 z-10"
                style={{ top: 'calc(env(safe-area-inset-top, 16px) + 48px)', width: '260px' }}
              >
                <button
                  onClick={() => setMode('lens')}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all',
                    mode === 'lens' ? 'bg-white text-black shadow-sm' : 'text-white/70'
                  )}
                >
                  AI LENS
                </button>
                <button
                  onClick={() => setMode('barcode')}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1',
                    mode === 'barcode' ? 'bg-white text-black shadow-sm' : 'text-white/70'
                  )}
                >
                  <BarcodeIcon size={13} weight="bold" />
                  SCAN
                </button>
                <button
                  onClick={() => setMode('listing')}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all',
                    mode === 'listing' ? 'bg-white text-black shadow-sm' : 'text-white/70'
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
                  style={{ top: 'calc(env(safe-area-inset-top, 16px) + 96px)' }}
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all z-10',
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

              {/* Viewfinder brackets for lens/barcode modes */}
              {mode !== 'listing' && (
                <div className="absolute inset-12 border-2 border-white/30 pointer-events-none mt-24">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
                </div>
              )}

              {/* Rule-of-thirds grid for listing mode */}
              {mode === 'listing' && showGrid && (
                <div className="absolute inset-0 pointer-events-none z-[5]" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 90px)', bottom: '0' }}>
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                  {/* Center crosshair */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="absolute right-4 p-3 bg-black/60 text-white rounded-full z-10 backdrop-blur-sm border border-white/20"
                style={{
                  top: 'max(env(safe-area-inset-top, 16px), 16px)',
                  minWidth: '48px',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div
              className="bg-black px-5 pt-4 flex flex-col gap-3"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
            >
              {barcodeProduct && mode === 'lens' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green/20 border border-green/40 rounded-lg p-3"
                >
                  <div className="flex gap-3 items-center">
                    {barcodeProduct.imageUrl && (
                      <img
                        src={barcodeProduct.imageUrl}
                        alt={barcodeProduct.title}
                        className="w-12 h-12 object-cover rounded bg-white flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <BarcodeIcon size={14} className="text-green flex-shrink-0" weight="bold" />
                        <p className="text-white text-xs font-bold truncate">{barcodeProduct.title || 'Scanned Product'}</p>
                      </div>
                      {barcodeProduct.brand && (
                        <p className="text-white/70 text-xs truncate">{barcodeProduct.brand}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setBarcodeProduct(null)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                    >
                      <X size={16} className="text-white/60" />
                    </button>
                  </div>
                </motion.div>
              )}
              
              {mode === 'lens' && (
                <>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-base font-mono pointer-events-none">$</span>
                    <input
                      id="camera-price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-lg h-12 pl-8 pr-4 text-base font-mono placeholder:text-white/30 outline-none focus:border-white/60"
                      style={{
                        WebkitBoxShadow: '0 0 0 1000px rgba(0,0,0,0.75) inset',
                        WebkitTextFillColor: 'rgba(255,255,255,1)',
                        caretColor: 'white',
                      }}
                    />
                  </div>
                  
                  {/* Condition — baked into Gemini pricing and ROI math for this scan */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Condition
                    </span>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-lg h-12 px-3 text-base font-medium outline-none focus:border-white/60"
                      style={{
                        WebkitBoxShadow: '0 0 0 1000px rgba(0,0,0,0.75) inset',
                        WebkitTextFillColor: 'rgba(255,255,255,1)',
                      }}
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c} className="bg-black text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {mode === 'listing' && (
                <>
                  {/* Listing photo controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Images size={18} weight="duotone" className="text-b1" />
                      <span className="text-white text-sm font-bold">
                        {listingPhotos.length} / 5 photos
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={cn(
                          'p-2 rounded-lg transition-all',
                          showGrid ? 'bg-white/20 text-white' : 'text-white/40'
                        )}
                      >
                        <GridFour size={18} weight={showGrid ? 'fill' : 'regular'} />
                      </button>
                      <button
                        onClick={() => setAutoEnhance(!autoEnhance)}
                        className={cn(
                          'p-2 rounded-lg transition-all',
                          autoEnhance ? 'bg-b1/30 text-b1' : 'text-white/40'
                        )}
                      >
                        <MagicWand size={18} weight={autoEnhance ? 'fill' : 'regular'} />
                      </button>
                    </div>
                  </div>

                  {/* Current shot tip */}
                  {listingPhotos.length < LISTING_PHOTO_TIPS.length && (
                    <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Camera size={14} className="text-b1 flex-shrink-0" />
                        <span className="text-white/80 text-xs">
                          <span className="font-bold text-white">Shot {listingPhotos.length + 1}:</span>{' '}
                          {LISTING_PHOTO_TIPS[listingPhotos.length]}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail strip */}
                  {listingPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {listingPhotos.map((photo, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-white/30">
                          <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setListingPhotos(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                          >
                            <X size={10} weight="bold" className="text-white" />
                          </button>
                          <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold text-white bg-black/60 px-1 rounded">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Done button when photos captured */}
                  {listingPhotos.length > 0 && (
                    <button
                      onClick={() => {
                        onCapture(listingPhotos[0], 0, barcodeProduct || undefined, condition)
                        setListingPhotos([])
                        setBarcodeProduct(null)
                      }}
                      className="w-full py-3 bg-b1 text-white font-bold rounded-lg text-sm transition-all active:scale-[0.98]"
                    >
                      Use {listingPhotos.length} {listingPhotos.length === 1 ? 'Photo' : 'Photos'} for Listing
                    </button>
                  )}
                </>
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
              
              <div className="flex items-center justify-center py-2">
                <button
                  onClick={handleCapture}
                  className={cn(
                    'w-[72px] h-[72px] rounded-full border-4 p-1 transition-all active:scale-95',
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
            
            {mode === 'barcode' && (
              <BarcodeScanner
                isActive={mode === 'barcode'}
                onBarcodeDetected={handleBarcodeDetected}
                onClose={() => setMode('lens')}
                onLookupProduct={handleLookupProduct}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </>
  )
}
