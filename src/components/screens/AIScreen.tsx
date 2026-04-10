import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Microphone, CaretDown, ChartBar, Image, ArrowClockwise, ArrowCounterClockwise, XCircle, ShoppingCart, Scan, FloppyDisk } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card } from '@/components/ui/card'
import { PipelinePanel } from './PipelinePanel'
import { DecisionSignal } from './DecisionSignal'
import { MarketDataPanel } from '../MarketDataPanel'
import { GoogleLensResults } from '../GoogleLensResults'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { useCollapsePreference } from '@/hooks/use-collapse-preference'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import type { ScannedItem, PipelineStep, AppSettings } from '@/types'

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  settings?: AppSettings
  onSaveDraft: (price: number, notes: string) => void
  onCreateListing: (price: number, notes: string) => void
  onPassItem: (price: number, notes: string) => void
  onRecalculate?: (price: number) => void
  onRescan?: () => void
  onOpenCamera?: () => void
}

// ─── Celebration particles ────────────────────────────────────────────────────

function CelebrationParticle({ delay, index }: { delay: number; index: number }) {
  const randomX = Math.random() * 200 - 100
  const randomRotation = Math.random() * 720 - 360
  const colors = ['#60aa82', '#c17c5f', '#555ce2', '#f0c75e']
  const color = colors[index % colors.length]
  const shapes = ['○', '●', '◆', '★', '✦', '✨']
  const shape = shapes[index % shapes.length]

  return (
    <motion.div
      className="absolute font-bold text-2xl pointer-events-none"
      style={{ left: '50%', top: '50%', color, textShadow: `0 0 8px ${color}` }}
      initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        x: randomX,
        y: [-80, -120, -160],
        scale: [0, 1.2, 1, 0.8],
        rotate: randomRotation,
      }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
    >
      {shape}
    </motion.div>
  )
}

function CelebrationEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {Array.from({ length: 20 }).map((_, i) => (
        <CelebrationParticle key={i} index={i} delay={i * 0.03} />
      ))}
    </div>
  )
}

// ─── Overall progress bar ─────────────────────────────────────────────────────

function OverallProgress({ steps }: { steps: PipelineStep[] }) {
  const overallProgress = useMemo(() => {
    if (steps.length === 0) return 0
    let totalProgress = 0
    steps.forEach(step => {
      if (step.status === 'complete') {
        totalProgress += 100
      } else if (step.status === 'processing') {
        totalProgress += (step.progress ?? 0)
      }
    })
    return Math.round(totalProgress / steps.length)
  }, [steps])

  const count = useMotionValue(0)
  const rounded = useTransform(count, Math.round)
  const [showCelebration, setShowCelebration] = useState(false)
  const previousProgress = useRef(0)

  useEffect(() => {
    const controls = animate(count, overallProgress, { duration: 0.6, ease: 'easeOut' })
    return controls.stop
  }, [count, overallProgress])

  useEffect(() => {
    if (overallProgress === 100 && previousProgress.current < 100) {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 1500)
      return () => clearTimeout(timer)
    }
    previousProgress.current = overallProgress
  }, [overallProgress])

  const isComplete = overallProgress === 100
  const isProcessing = overallProgress > 0 && overallProgress < 100

  if (steps.length === 0) return null

  return (
    <div className="mb-4 space-y-2 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-t2">OVERALL PROGRESS</h3>
        <motion.div className="text-lg font-mono font-black tabular-nums relative">
          <motion.span
            className={cn(
              'transition-colors duration-300',
              isComplete && 'text-green',
              isProcessing && 'text-b1',
              !isProcessing && !isComplete && 'text-t2',
            )}
            animate={isComplete ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {rounded}
          </motion.span>
          <span className="text-t3 text-sm">%</span>
          {isComplete && (
            <motion.span
              className="ml-2 text-green"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, ease: 'backOut' }}
            >
              ✓
            </motion.span>
          )}
        </motion.div>
      </div>

      <div className="h-3 bg-s1 rounded-full overflow-hidden relative border border-s2">
        <motion.div
          className={cn(
            'h-full relative',
            isComplete && 'bg-gradient-to-r from-green via-green to-green',
            isProcessing && 'bg-gradient-to-r from-b1 via-amber to-b1',
          )}
          initial={{ width: '0%' }}
          animate={{
            width: `${overallProgress}%`,
            backgroundPosition: isProcessing ? ['0% 50%', '100% 50%', '0% 50%'] : '0% 50%',
          }}
          transition={{
            width: { duration: 0.6, ease: 'easeOut' },
            backgroundPosition: isProcessing
              ? { duration: 2, ease: 'linear', repeat: Infinity }
              : { duration: 0 },
          }}
          style={{ backgroundSize: '200% 100%' }}
        >
          {isProcessing && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{ animation: 'shimmer-sweep 1.5s ease-in-out infinite' }}
            />
          )}
          {isComplete && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showCelebration && <CelebrationEffect />}
      </AnimatePresence>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function AIScreen({
  currentItem,
  pipeline,
  settings,
  onSaveDraft,
  onCreateListing,
  onPassItem,
  onRecalculate,
  onRescan,
  onOpenCamera,
}: AIScreenProps) {
  const [description, setDescription] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [summaryOpen, setSummaryOpen] = useCollapsePreference('ai-summary', true)
  const [imageOpen, setImageOpen] = useCollapsePreference('ai-image', false)
  const { isListening, startListening, isSupported } = useVoiceInput()

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const isPipelineRunning = pipeline.length > 0 && pipeline.some(p => p.status === 'processing')
  const decision = currentItem?.decision
  const canSaveDraft = !!(currentItem?.imageData || description.trim().length > 0)

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
  }, [])

  // Pre-fill buy price when currentItem arrives (never override user edits)
  useEffect(() => {
    if (currentItem?.purchasePrice != null && buyPrice === '') {
      setBuyPrice(String(currentItem.purchasePrice))
    }
  }, [currentItem?.purchasePrice, buyPrice])

  // Auto-scroll to decision when it first appears
  const decisionRef = useRef<HTMLDivElement>(null)
  const prevHasDecision = useRef(false)
  useEffect(() => {
    if (hasDecision && !prevHasDecision.current) {
      setTimeout(() => {
        decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    }
    prevHasDecision.current = hasDecision
  }, [hasDecision])

  const pullToRefresh = usePullToRefresh({ onRefresh: handleRefresh, threshold: 80, enabled: true })

  return (
    <div className="flex flex-col w-full h-full bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" ref={pullToRefresh.containerRef}>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-4">
          {pipeline.length === 0 ? (
            /* Empty / waiting state */
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-3 sm:mb-4">
                  <Scan size={32} strokeWidth={1.5} className="text-b1 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-t1 mb-1.5 sm:mb-2">Ready to Scan</h3>
                <p className="text-xs sm:text-sm text-t3 max-w-xs mb-4">
                  Tap the camera button to scan an item and start AI analysis
                </p>
                {onOpenCamera && (
                  <button
                    onClick={onOpenCamera}
                    className="flex items-center gap-2 px-4 py-2 bg-b1 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-transform"
                  >
                    <Scan size={16} weight="bold" />
                    Scan an Item
                  </button>
                )}
              </div>
              <div className="px-2 sm:px-4">
                <ApiStatusIndicator settings={settings} />
              </div>
            </div>
          ) : (
            /* Pipeline in progress or complete */
            <div className="space-y-3 sm:space-y-4">
              <OverallProgress steps={pipeline} />
              <PipelinePanel steps={pipeline} />

              {/* Market velocity "still searching" banner */}
              {isPipelineRunning && (() => {
                const marketStep = pipeline.find(p => p.id === 'market')
                const isMarketStuck =
                  marketStep?.status === 'processing' && (marketStep.progress ?? 0) >= 90
                if (!isMarketStuck) return null
                return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber/10 border border-amber/30 text-amber text-xs font-medium">
                    <span className="animate-pulse">⏳</span>
                    Fetching live market data — this can take up to 30s…
                  </div>
                )
              })()}

              {/* Decision signal */}
              {hasDecision && decision && (
                <div className="mt-3 sm:mt-4" ref={decisionRef}>
                  <DecisionSignal decision={decision} item={currentItem} />
                </div>
              )}

              {/* Quick Summary */}
              {hasDecision && currentItem && (
                <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                  <Card className="mt-3 sm:mt-4 p-3 sm:p-4 bg-fg border-s2 overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <ChartBar size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
                          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-t1">
                            QUICK SUMMARY
                          </h3>
                        </div>
                        <CaretDown
                          size={18}
                          weight="bold"
                          className={cn(
                            'text-t3 transition-transform duration-200 flex-shrink-0',
                            summaryOpen && 'rotate-180',
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                        <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Buy Price</p>
                          <p className="text-base sm:text-lg font-mono font-bold text-t1">
                            ${currentItem.purchasePrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Sell Price</p>
                          <p className="text-base sm:text-lg font-mono font-bold text-t1">
                            ${currentItem.estimatedSellPrice?.toFixed(2) || '--'}
                          </p>
                        </div>
                        <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Profit Margin</p>
                          <p
                            className={cn(
                              'text-base sm:text-lg font-mono font-bold',
                              (currentItem.profitMargin || 0) > 50
                                ? 'text-green'
                                : (currentItem.profitMargin || 0) > 20
                                  ? 'text-amber'
                                  : 'text-red',
                            )}
                          >
                            {currentItem.profitMargin?.toFixed(1) || '--'}%
                          </p>
                        </div>
                        <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Net Profit</p>
                          <p className="text-base sm:text-lg font-mono font-bold text-t1">
                            ${((currentItem.estimatedSellPrice || 0) - currentItem.purchasePrice).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Google Lens results */}
              {currentItem?.lensAnalysis && (
                <GoogleLensResults lensAnalysis={currentItem.lensAnalysis} />
              )}

              {/* Market data */}
              {currentItem?.marketData && (
                <MarketDataPanel marketData={currentItem.marketData} />
              )}

              {/* Scanned image */}
              {currentItem?.imageData && (
                <Collapsible open={imageOpen} onOpenChange={setImageOpen}>
                  <Card className="mt-3 sm:mt-4 p-3 sm:p-4 bg-fg border-s2 overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Image size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
                          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-t1">
                            SCANNED IMAGE
                          </h3>
                        </div>
                        <CaretDown
                          size={18}
                          weight="bold"
                          className={cn(
                            'text-t3 transition-transform duration-200 flex-shrink-0',
                            imageOpen && 'rotate-180',
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <img
                        src={currentItem.imageData}
                        alt="Scanned item"
                        className="w-full rounded-lg sm:rounded-xl border-2 border-s2 shadow-md"
                      />
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 border-t border-s2 bg-fg/95 backdrop-blur-md safe-bottom">
        {hasDecision ? (
          /* Pipeline done — full action bar */
          <div className="p-2.5 sm:p-3 space-y-2">
            {/* Price + notes row */}
            <div className="flex gap-2">
              <Input
                id="ai-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Buy $"
                value={buyPrice}
                onChange={e => setBuyPrice(e.target.value)}
                className="w-20 sm:w-24 h-9 sm:h-10 font-mono bg-bg border-s2 text-sm"
              />
              <div className="flex-1 relative">
                <Input
                  id="ai-describe"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Notes..."
                  className="h-9 sm:h-10 pr-10 bg-bg border-s2 text-sm"
                />
                {isSupported && (
                  <button
                    onClick={() => startListening(text => setDescription(text))}
                    className={cn(
                      'absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors',
                      isListening
                        ? 'bg-red text-white animate-pulse'
                        : 'bg-s1 hover:bg-s2 text-t3 hover:text-t1',
                    )}
                  >
                    <Microphone size={14} weight="bold" className="sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Recalculate — only when buy price has changed */}
            {buyPrice !== '' && parseFloat(buyPrice) !== currentItem?.purchasePrice && (
              <Button
                onClick={() => onRecalculate?.(parseFloat(buyPrice))}
                className="w-full bg-amber hover:opacity-90 text-white h-9 sm:h-10 font-semibold text-xs sm:text-sm"
              >
                <ArrowClockwise size={15} weight="bold" className="mr-1.5" />
                ♻️ Recalculate with new price
              </Button>
            )}

            {/* Rescan / Pass / Create Listing */}
            <div className="flex gap-2">
              <Button
                onClick={() => onRescan?.()}
                variant="outline"
                className="flex-shrink-0 h-9 sm:h-10 px-3 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-xs"
              >
                <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                Rescan
              </Button>
              <Button
                onClick={() => onPassItem(parseFloat(buyPrice), description)}
                disabled={!canSaveDraft}
                variant="outline"
                className="flex-1 h-9 sm:h-10 border-red/40 text-red hover:bg-red/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
              >
                <XCircle size={15} weight="bold" className="mr-1" />
                Pass
              </Button>
              <Button
                onClick={() => onCreateListing(parseFloat(buyPrice), description)}
                disabled={!canSaveDraft}
                className="flex-1 h-9 sm:h-10 bg-green hover:opacity-90 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
              >
                <ShoppingCart size={15} weight="bold" className="mr-1" />
                Create Listing
              </Button>
            </div>
          </div>
        ) : isPipelineRunning ? (
          /* Pipeline in progress — hold the bar */
          <div className="flex items-center justify-center gap-2 h-12 text-xs text-t3 font-medium">
            <span className="w-2 h-2 rounded-full bg-b1 animate-pulse" />
            Analyzing… decision coming
          </div>
        ) : pipeline.length > 0 ? (
          /* Pipeline ended without a decision (error path) — allow rescan */
          <div className="p-2.5 sm:p-3">
            <Button
              onClick={() => onRescan?.()}
              variant="outline"
              className="w-full h-9 sm:h-10 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-xs sm:text-sm"
            >
              <ArrowCounterClockwise size={14} weight="bold" className="mr-1.5" />
              Rescan
            </Button>
          </div>
        ) : (
          /* No pipeline yet — allow manual draft save */
          <div className="p-2.5 sm:p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Buy $"
                value={buyPrice}
                onChange={e => setBuyPrice(e.target.value)}
                className="w-20 sm:w-24 h-9 sm:h-10 font-mono bg-bg border-s2 text-sm"
              />
              <div className="flex-1 relative">
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes or description..."
                  className="h-9 sm:h-10 pr-10 bg-bg border-s2 text-sm"
                />
                {isSupported && (
                  <button
                    onClick={() => startListening(text => setDescription(text))}
                    className={cn(
                      'absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors',
                      isListening
                        ? 'bg-red text-white animate-pulse'
                        : 'bg-s1 hover:bg-s2 text-t3 hover:text-t1',
                    )}
                  >
                    <Microphone size={14} weight="bold" className="sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {onRescan && (
                <Button
                  onClick={() => onRescan()}
                  variant="outline"
                  className="flex-shrink-0 h-9 sm:h-10 px-3 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-xs"
                >
                  <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                  Rescan
                </Button>
              )}
              <Button
                onClick={() => onSaveDraft(parseFloat(buyPrice), description)}
                disabled={!canSaveDraft}
                className="flex-1 bg-b1 hover:bg-b2 text-white h-9 sm:h-10 font-medium disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <FloppyDisk size={16} weight="bold" className="mr-1.5 sm:mr-2" />
                SAVE DRAFT TO QUEUE
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
