import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, DeviceMobile } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ResponsiveTestHelperProps {
  enabled?: boolean
}

export function ResponsiveTestHelper({ enabled = false }: ResponsiveTestHelperProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [deviceType, setDeviceType] = useState('')
  const [show, setShow] = useState(enabled)

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      setDimensions({ width, height })

      if (width <= 320) {
        setDeviceType('iPhone SE (1st gen)')
      } else if (width <= 360) {
        setDeviceType('Small Android')
      } else if (width <= 375) {
        setDeviceType('iPhone SE / 12 Mini')
      } else if (width <= 393) {
        setDeviceType('iPhone 14/15')
      } else if (width <= 430) {
        setDeviceType('iPhone Pro Max')
      } else if (width <= 743) {
        setDeviceType('Large Phone')
      } else if (width <= 834) {
        setDeviceType('iPad Mini')
      } else if (width <= 1024) {
        setDeviceType('iPad')
      } else if (width <= 1366) {
        setDeviceType('iPad Pro')
      } else {
        setDeviceType('Desktop')
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  if (!show) return null

  const isNarrow = dimensions.width <= 375
  const isExtraNarrow = dimensions.width <= 320

  return (
    <Card 
      className={cn(
        "fixed top-4 right-4 z-[9999] p-3 bg-card/95 backdrop-blur-md border-2",
        isExtraNarrow && "border-red text-red-foreground",
        isNarrow && !isExtraNarrow && "border-amber",
        !isNarrow && "border-green"
      )}
      style={{ 
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        maxWidth: 'calc(100vw - 2rem)'
      }}
    >
      <div className="flex items-start gap-2">
        <DeviceMobile size={20} weight="duotone" className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-xs uppercase tracking-wider">Viewport</span>
            <Badge variant={isExtraNarrow ? "destructive" : isNarrow ? "secondary" : "default"} className="text-[10px] px-1 py-0">
              {deviceType}
            </Badge>
          </div>
          <div className="text-xs text-t2 font-mono">
            {dimensions.width} × {dimensions.height}px
          </div>
          {isExtraNarrow && (
            <div className="text-[10px] text-red mt-1 font-medium">
              ⚠️ Extra narrow - test carefully
            </div>
          )}
          {isNarrow && !isExtraNarrow && (
            <div className="text-[10px] text-amber mt-1 font-medium">
              ⚡ Narrow phone viewport
            </div>
          )}
        </div>
        <button
          onClick={() => setShow(false)}
          className="flex-shrink-0 p-1 hover:bg-s1 rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </Card>
  )
}
