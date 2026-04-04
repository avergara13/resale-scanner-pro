import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, WarningCircle, Hand } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface TouchTargetInfo {
  element: HTMLElement
  rect: DOMRect
  width: number
  height: number
  isValid: boolean
  tagName: string
  id: string
  classes: string
  text: string
}

const MIN_TOUCH_TARGET = 44

export function TouchTargetVerifier() {
  const [isActive, setIsActive] = useState(false)
  const [targets, setTargets] = useState<TouchTargetInfo[]>([])
  const [showOverlays, setShowOverlays] = useState(true)

  const scanTouchTargets = useCallback(() => {
    const interactiveSelectors = [
      'button',
      'a',
      '[role="button"]',
      '[role="link"]',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])',
      '.touch-target',
    ]

    const elements = document.querySelectorAll(interactiveSelectors.join(','))
    const touchTargets: TouchTargetInfo[] = []

    elements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      if (el.offsetParent === null) return

      const rect = el.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(el)
      
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return

      const width = rect.width
      const height = rect.height
      const isValid = width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET

      touchTargets.push({
        element: el,
        rect,
        width,
        height,
        isValid,
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        classes: el.className,
        text: el.textContent?.trim().substring(0, 30) || '',
      })
    })

    setTargets(touchTargets)
  }, [])

  useEffect(() => {
    if (isActive) {
      scanTouchTargets()
      const interval = setInterval(scanTouchTargets, 1000)
      return () => clearInterval(interval)
    }
  }, [isActive, scanTouchTargets])

  const invalidTargets = targets.filter((t) => !t.isValid)
  const validTargets = targets.filter((t) => t.isValid)

  if (!isActive) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsActive(true)}
        className="fixed bottom-24 right-4 z-[100] w-14 h-14 bg-gradient-to-br from-amber to-red text-white rounded-full shadow-lg flex items-center justify-center border-4 border-fg"
        style={{ minWidth: '56px', minHeight: '56px' }}
        title="Touch Target Verifier"
      >
        <Hand size={24} weight="fill" />
      </motion.button>
    )
  }

  return (
    <>
      <AnimatePresence>
        {showOverlays && (
          <>
            {targets.map((target, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed pointer-events-none z-[90]"
                style={{
                  left: target.rect.left,
                  top: target.rect.top,
                  width: target.rect.width,
                  height: target.rect.height,
                  border: target.isValid
                    ? '2px solid oklch(0.60 0.17 145)'
                    : '2px dashed oklch(0.58 0.20 25)',
                  backgroundColor: target.isValid
                    ? 'oklch(0.60 0.17 145 / 0.1)'
                    : 'oklch(0.58 0.20 25 / 0.15)',
                  borderRadius: '4px',
                }}
              >
                <div
                  className="absolute -top-5 left-0 text-[10px] font-mono font-bold px-1 rounded"
                  style={{
                    backgroundColor: target.isValid
                      ? 'oklch(0.60 0.17 145)'
                      : 'oklch(0.58 0.20 25)',
                    color: 'white',
                  }}
                >
                  {Math.round(target.width)}×{Math.round(target.height)}
                </div>
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="fixed top-0 right-0 bottom-20 w-80 bg-card border-l border-border z-[95] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 space-y-3 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Hand size={20} weight="fill" />
              Touch Targets
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsActive(false)}
              className="h-8 w-8"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-bg border border-green rounded-lg p-2">
              <div className="flex items-center gap-1 text-green font-bold">
                <CheckCircle size={16} weight="fill" />
                {validTargets.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Valid (≥44px)</div>
            </div>
            <div className="bg-red-bg border border-red rounded-lg p-2">
              <div className="flex items-center gap-1 text-red font-bold">
                <WarningCircle size={16} weight="fill" />
                {invalidTargets.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Too small</div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowOverlays(!showOverlays)}
            className="w-full"
          >
            {showOverlays ? 'Hide' : 'Show'} Overlays
          </Button>
        </div>

        <div className="p-4 space-y-2">
          {invalidTargets.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-red flex items-center gap-2 sticky top-[180px] bg-card py-2 z-[5]">
                <WarningCircle size={16} weight="fill" />
                Issues Found ({invalidTargets.length})
              </h3>
              {invalidTargets.map((target, index) => (
                <motion.div
                  key={`invalid-${index}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-red-bg border border-red rounded-lg p-3 space-y-1.5 cursor-pointer hover:bg-red-bg/80 transition-colors"
                  onClick={() => {
                    target.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono text-xs text-red font-bold">
                      {Math.round(target.width)}×{Math.round(target.height)}px
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                      {target.tagName}
                    </div>
                  </div>
                  {target.id && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      #{target.id}
                    </div>
                  )}
                  {target.text && (
                    <div className="text-[11px] text-foreground truncate">{target.text}</div>
                  )}
                  <div className="text-[9px] text-amber font-semibold">
                    Needs {MIN_TOUCH_TARGET - Math.min(target.width, target.height)}px more
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {validTargets.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-green flex items-center gap-2 mt-4 sticky top-[180px] bg-card py-2 z-[5]">
                <CheckCircle size={16} weight="fill" />
                Valid Targets ({validTargets.length})
              </h3>
              {validTargets.slice(0, 10).map((target, index) => (
                <motion.div
                  key={`valid-${index}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (invalidTargets.length + index) * 0.05 }}
                  className="bg-green-bg/50 border border-green/30 rounded-lg p-2 space-y-1 cursor-pointer hover:bg-green-bg transition-colors"
                  onClick={() => {
                    target.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-green font-bold">
                      {Math.round(target.width)}×{Math.round(target.height)}px
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                      {target.tagName}
                    </div>
                  </div>
                  {target.text && (
                    <div className="text-[10px] text-foreground truncate">{target.text}</div>
                  )}
                </motion.div>
              ))}
              {validTargets.length > 10 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  + {validTargets.length - 10} more valid targets
                </div>
              )}
            </>
          )}

          {targets.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Scanning for interactive elements...
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
