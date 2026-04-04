import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Barcode, X, Sparkle } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { BarcodeProduct } from '@/lib/barcode-service'

interface BarcodeScannerProps {
  isActive: boolean
  onBarcodeDetected: (barcode: string, product?: BarcodeProduct) => void
  onClose: () => void
  onLookupProduct: (barcode: string) => Promise<BarcodeProduct | null>
}

export function BarcodeScanner({ isActive, onBarcodeDetected, onClose, onLookupProduct }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<string>('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [detectedProduct, setDetectedProduct] = useState<BarcodeProduct | null>(null)

  useEffect(() => {
    if (isActive && !scannerRef.current) {
      initScanner()
    }
    
    return () => {
      stopScanner()
    }
  }, [isActive])

  const initScanner = async () => {
    try {
      const scanner = new Html5Qrcode('barcode-scanner-region')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 16 / 9,
        },
        async (decodedText) => {
          if (decodedText !== lastScanned) {
            setLastScanned(decodedText)
            setIsLookingUp(true)
            
            const product = await onLookupProduct(decodedText)
            setDetectedProduct(product)
            setIsLookingUp(false)
            
            onBarcodeDetected(decodedText, product || undefined)
            
            navigator.vibrate?.(200)
            
            setTimeout(() => {
              setDetectedProduct(null)
            }, 3000)
          }
        },
        () => {
        }
      )
      
      setIsScanning(true)
    } catch (error) {
      console.error('Barcode scanner initialization failed:', error)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
        setIsScanning(false)
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <Barcode size={28} weight="duotone" className="text-primary" />
          <div>
            <h2 className="text-lg font-bold text-white">Barcode Scanner</h2>
            <p className="text-xs text-white/70">Scan UPC/EAN for quick lookup</p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X size={24} />
        </Button>
      </div>

      <div className="flex-1 relative">
        <div 
          id="barcode-scanner-region" 
          className="w-full h-full"
        />
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[180px]">
            <div className="absolute inset-0 border-2 border-primary rounded-xl opacity-60">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
            </div>
            
            <motion.div
              className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-lg shadow-primary/50"
              animate={{
                y: [0, 180, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        </div>

        <AnimatePresence>
          {isLookingUp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-24 left-4 right-4 bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <Sparkle size={24} className="text-primary animate-pulse" />
                <p className="text-white font-medium">Looking up product...</p>
              </div>
            </motion.div>
          )}

          {detectedProduct && !isLookingUp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-24 left-4 right-4 bg-gradient-to-br from-green/90 to-green-bg backdrop-blur-md border border-green rounded-2xl p-4"
            >
              <div className="flex gap-3">
                {detectedProduct.imageUrl && (
                  <img
                    src={detectedProduct.imageUrl}
                    alt={detectedProduct.title}
                    className="w-16 h-16 object-cover rounded-lg bg-white"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{detectedProduct.title || 'Unknown Product'}</p>
                  {detectedProduct.brand && (
                    <p className="text-white/80 text-sm truncate">{detectedProduct.brand}</p>
                  )}
                  <p className="text-white/60 text-xs mt-1">{detectedProduct.barcode} • {detectedProduct.format}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent safe-bottom">
        <div className="text-center text-white/70 text-sm">
          {isScanning ? (
            <>Position barcode within frame</>
          ) : (
            <>Initializing scanner...</>
          )}
        </div>
      </div>
    </div>
  )
}
