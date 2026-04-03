import { useRef, useState, useEffect } from 'react'
import { X, Camera as CameraIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CameraOverlayProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (imageData: string, price: number) => void
}

export function CameraOverlay({ isOpen, onClose, onCapture }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [price, setPrice] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [isOpen])

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
      console.error('Camera access failed:', err)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !price) return
    setIsCapturing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      const imageData = canvas.toDataURL('image/jpeg', 0.9)
      onCapture(imageData, parseFloat(price))
      setPrice('')
      setIsCapturing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      id="camera-overlay"
      className="fixed inset-0 z-50 bg-t1/95 flex flex-col"
      style={{ maxWidth: '480px', margin: '0 auto' }}
    >
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold text-bg">Scan Item</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-bg/10 hover:bg-bg/20 flex items-center justify-center text-bg transition-colors"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <X size={24} weight="bold" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 10 10 L 20 10 M 10 10 L 10 20"
            stroke="white"
            strokeWidth="0.5"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M 90 10 L 80 10 M 90 10 L 90 20"
            stroke="white"
            strokeWidth="0.5"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M 10 90 L 20 90 M 10 90 L 10 80"
            stroke="white"
            strokeWidth="0.5"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M 90 90 L 80 90 M 90 90 L 90 80"
            stroke="white"
            strokeWidth="0.5"
            fill="none"
            opacity="0.8"
          />
        </svg>
      </div>

      <div className="p-6 space-y-4 bg-t1/98">
        <Input
          id="camera-price"
          type="number"
          step="0.01"
          placeholder="Enter price ($)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="bg-bg/95 text-fg border-s2 h-12 text-base font-mono"
        />
        <Button
          id="shutter-btn"
          onClick={handleCapture}
          disabled={!price || isCapturing}
          className="w-full h-14 bg-bg hover:bg-s1 text-fg text-base font-semibold"
          size="lg"
        >
          <CameraIcon size={20} weight="bold" className="mr-2" />
          Capture Photo
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
