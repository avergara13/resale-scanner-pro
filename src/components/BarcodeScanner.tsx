import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Barcode, X, Sparkle, QrCode, Clock, ArrowRight, LinkSimple, Copy, Check } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BarcodeProduct } from '@/lib/barcode-service'

interface BarcodeScannerProps {
  isActive: boolean
  onBarcodeDetected: (barcode: string, product?: BarcodeProduct) => void
  onClose: () => void
  onLookupProduct: (barcode: string) => Promise<BarcodeProduct | null>
}

interface ScanHistoryEntry {
  code: string
  type: 'barcode' | 'qr'
  product?: BarcodeProduct
  timestamp: number
  data?: QRCodeData
}

interface QRCodeData {
  type: 'url' | 'text' | 'contact' | 'wifi' | 'product'
  raw: string
  url?: string
  label?: string
}

function parseQRData(text: string): QRCodeData {
  // URL detection
  if (/^https?:\/\//i.test(text)) {
    return { type: 'url', raw: text, url: text, label: new URL(text).hostname }
  }
  // vCard
  if (text.startsWith('BEGIN:VCARD')) {
    const nameMatch = text.match(/FN:(.+)/i)
    return { type: 'contact', raw: text, label: nameMatch?.[1] || 'Contact' }
  }
  // WiFi
  if (text.startsWith('WIFI:')) {
    const ssidMatch = text.match(/S:([^;]+)/)
    return { type: 'wifi', raw: text, label: ssidMatch?.[1] || 'WiFi Network' }
  }
  // Pure numeric = likely barcode/UPC
  if (/^\d{8,14}$/.test(text)) {
    return { type: 'product', raw: text }
  }
  return { type: 'text', raw: text, label: text.slice(0, 60) }
}

function isBarcode(text: string): boolean {
  return /^\d{8,14}$/.test(text)
}

export function BarcodeScanner({ isActive, onBarcodeDetected, onClose, onLookupProduct }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<string>('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [detectedProduct, setDetectedProduct] = useState<BarcodeProduct | null>(null)
  const [scanMode, setScanMode] = useState<'barcode' | 'qr'>('barcode')
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isActive) {
      initScanner()
    }
    return () => { stopScanner() }
  }, [isActive, scanMode])

  const initScanner = async () => {
    await stopScanner()

    try {
      const scanner = new Html5Qrcode('barcode-scanner-region')
      scannerRef.current = scanner

      const qrboxSize = scanMode === 'qr'
        ? { width: 220, height: 220 }
        : { width: 250, height: 150 }

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: qrboxSize, aspectRatio: 16 / 9 },
        async (decodedText) => {
          if (decodedText !== lastScanned) {
            setLastScanned(decodedText)
            navigator.vibrate?.(200)

            const isProductBarcode = isBarcode(decodedText)

            if (isProductBarcode) {
              // Barcode → product lookup
              setIsLookingUp(true)
              setQrData(null)
              const product = await onLookupProduct(decodedText)
              setDetectedProduct(product)
              setIsLookingUp(false)

              setScanHistory(prev => [{
                code: decodedText,
                type: 'barcode' as const,
                product: product || undefined,
                timestamp: Date.now(),
              }, ...prev].slice(0, 20))

              onBarcodeDetected(decodedText, product || undefined)
            } else {
              // QR code → parse data
              const parsed = parseQRData(decodedText)
              setQrData(parsed)
              setDetectedProduct(null)

              setScanHistory(prev => [{
                code: decodedText,
                type: 'qr' as const,
                data: parsed,
                timestamp: Date.now(),
              }, ...prev].slice(0, 20))
            }

            // Auto-clear after 5 seconds
            setTimeout(() => {
              setDetectedProduct(null)
              setQrData(null)
            }, 5000)
          }
        },
        () => {}
      )

      setIsScanning(true)
    } catch (error) {
      console.error('Scanner initialization failed:', error)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {}
      scannerRef.current = null
      setIsScanning(false)
    }
  }

  const handleUseProduct = () => {
    if (detectedProduct) {
      onBarcodeDetected(detectedProduct.barcode, detectedProduct)
      onClose()
    }
  }

  const handleCopyQR = useCallback(() => {
    if (qrData) {
      navigator.clipboard.writeText(qrData.raw).then(() => {
        setCopied(true)
        toast.success('Copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [qrData])

  const handleOpenURL = useCallback(() => {
    if (qrData?.url) {
      window.open(qrData.url, '_blank', 'noopener,noreferrer')
    }
  }, [qrData])

  const handleToggleMode = useCallback(() => {
    setLastScanned('')
    setDetectedProduct(null)
    setQrData(null)
    setScanMode(prev => prev === 'barcode' ? 'qr' : 'barcode')
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-2 bg-gradient-to-b from-black/80 to-transparent"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 8px)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {scanMode === 'barcode'
            ? <Barcode size={22} weight="duotone" className="text-primary flex-shrink-0" />
            : <QrCode size={22} weight="duotone" className="text-violet-400 flex-shrink-0" />
          }
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">
              {scanMode === 'barcode' ? 'Barcode Scanner' : 'QR Code Scanner'}
            </h2>
            <p className="text-[10px] text-white/60">
              {scanMode === 'barcode' ? 'UPC / EAN / ISBN product lookup' : 'URLs, contacts, WiFi, text'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scanHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                'p-2 rounded-full transition-all',
                showHistory ? 'bg-white/20 text-white' : 'text-white/60'
              )}
            >
              <Clock size={20} weight={showHistory ? 'fill' : 'regular'} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 bg-black/60 text-white rounded-full backdrop-blur-sm border border-white/20"
            style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Scan mode toggle */}
      <div className="flex justify-center px-4 pb-3">
        <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md border border-white/10">
          <button
            onClick={() => { if (scanMode !== 'barcode') handleToggleMode() }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all',
              scanMode === 'barcode' ? 'bg-white text-black shadow-sm' : 'text-white/70'
            )}
          >
            <Barcode size={14} weight="bold" />
            Barcode
          </button>
          <button
            onClick={() => { if (scanMode !== 'qr') handleToggleMode() }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all',
              scanMode === 'qr' ? 'bg-white text-black shadow-sm' : 'text-white/70'
            )}
          >
            <QrCode size={14} weight="bold" />
            QR Code
          </button>
        </div>
      </div>

      {/* Scanner view */}
      <div className="flex-1 relative">
        <div id="barcode-scanner-region" className="w-full h-full" />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            scanMode === 'qr' ? 'w-[220px] h-[220px]' : 'w-[280px] h-[180px]'
          )}>
            <div className={cn(
              'absolute inset-0 border-2 opacity-60',
              scanMode === 'qr' ? 'border-violet-400 rounded-2xl' : 'border-primary rounded-xl'
            )}>
              <div className={cn('absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4', scanMode === 'qr' ? 'border-violet-400 rounded-tl-2xl' : 'border-primary rounded-tl-xl')} />
              <div className={cn('absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4', scanMode === 'qr' ? 'border-violet-400 rounded-tr-2xl' : 'border-primary rounded-tr-xl')} />
              <div className={cn('absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4', scanMode === 'qr' ? 'border-violet-400 rounded-bl-2xl' : 'border-primary rounded-bl-xl')} />
              <div className={cn('absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4', scanMode === 'qr' ? 'border-violet-400 rounded-br-2xl' : 'border-primary rounded-br-xl')} />
            </div>

            <motion.div
              className={cn(
                'absolute left-0 right-0 h-0.5 shadow-lg',
                scanMode === 'qr' ? 'bg-violet-400 shadow-violet-400/50' : 'bg-primary shadow-primary/50'
              )}
              animate={{ y: [0, scanMode === 'qr' ? 220 : 180, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Result cards */}
        <AnimatePresence>
          {isLookingUp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-20 left-4 right-4 bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <Sparkle size={24} className="text-primary animate-pulse" />
                <p className="text-white font-medium text-sm">Looking up product...</p>
              </div>
            </motion.div>
          )}

          {/* Barcode product result */}
          {detectedProduct && !isLookingUp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-20 left-4 right-4 bg-gradient-to-br from-green/90 to-green-bg backdrop-blur-md border border-green rounded-2xl p-4"
            >
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {detectedProduct.imageUrl && (
                    <img
                      src={detectedProduct.imageUrl}
                      alt={detectedProduct.title}
                      className="w-14 h-14 object-cover rounded-lg bg-white flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{detectedProduct.title || 'Unknown Product'}</p>
                    {detectedProduct.brand && (
                      <p className="text-white/80 text-xs truncate">{detectedProduct.brand}</p>
                    )}
                    <p className="text-white/60 text-[10px] mt-1">{detectedProduct.barcode} • {detectedProduct.format}</p>
                  </div>
                </div>
                <Button
                  onClick={handleUseProduct}
                  className="w-full bg-white text-green hover:bg-white/90 font-bold"
                  size="sm"
                >
                  Use This Product
                </Button>
              </div>
            </motion.div>
          )}

          {/* QR code data result */}
          {qrData && !isLookingUp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-20 left-4 right-4 bg-gradient-to-br from-violet-500/90 to-violet-900/80 backdrop-blur-md border border-violet-400 rounded-2xl p-4"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                    {qrData.type === 'url' ? <LinkSimple size={20} className="text-white" /> : <QrCode size={20} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-[10px] font-bold uppercase">{qrData.type}</p>
                    <p className="text-white text-sm font-medium break-all line-clamp-2">
                      {qrData.label || qrData.raw.slice(0, 80)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopyQR}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/30 text-white hover:bg-white/10"
                  >
                    {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  {qrData.url && (
                    <Button
                      onClick={handleOpenURL}
                      size="sm"
                      className="flex-1 bg-white text-violet-700 hover:bg-white/90 font-bold"
                    >
                      Open <ArrowRight size={14} className="ml-1" />
                    </Button>
                  )}
                  {qrData.type === 'product' && (
                    <Button
                      onClick={async () => {
                        setIsLookingUp(true)
                        setQrData(null)
                        const product = await onLookupProduct(qrData.raw)
                        setDetectedProduct(product)
                        setIsLookingUp(false)
                        if (product) onBarcodeDetected(qrData.raw, product)
                      }}
                      size="sm"
                      className="flex-1 bg-white text-violet-700 hover:bg-white/90 font-bold"
                    >
                      Lookup Product
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan history overlay */}
        <AnimatePresence>
          {showHistory && scanHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 200 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 200 }}
              className="absolute top-0 right-0 bottom-0 w-64 bg-black/95 backdrop-blur-md border-l border-white/10 overflow-y-auto z-30"
            >
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-bold uppercase">Scan History</span>
                  <button
                    onClick={() => { setScanHistory([]); setShowHistory(false) }}
                    className="text-white/40 text-[10px] font-bold"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {scanHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {entry.type === 'barcode'
                      ? <Barcode size={12} className="text-primary flex-shrink-0" />
                      : <QrCode size={12} className="text-violet-400 flex-shrink-0" />
                    }
                    <span className="text-white text-xs font-mono truncate">{entry.code.slice(0, 30)}</span>
                  </div>
                  {entry.product?.title && (
                    <p className="text-white/60 text-[10px] truncate pl-5">{entry.product.title}</p>
                  )}
                  {entry.data?.label && (
                    <p className="text-white/60 text-[10px] truncate pl-5">{entry.data.label}</p>
                  )}
                  <p className="text-white/30 text-[9px] pl-5 mt-0.5">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 bg-gradient-to-t from-black/80 to-transparent"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        <p className="text-center text-white/50 text-xs">
          {isScanning
            ? scanMode === 'qr'
              ? 'Point at QR code to scan'
              : 'Position barcode within frame'
            : 'Initializing scanner...'
          }
        </p>
      </div>
    </div>
  )
}
