import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Microphone,
  CaretDown,
  ChartBar,
  Image,
  ArrowClockwise,
  ArrowCounterClockwise,
  XCircle,
  BookmarkSimple,
  ShoppingCart,
  Scan,
  FloppyDisk,
  CheckCircle,
  ClipboardText,
} from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ['New', 'Like New', 'Very Good', 'Good', 'Acceptable', 'For Parts'] as const

const PLATFORMS = [
  { id: 'ebay', label: 'eBay' },
  { id: 'mercari', label: 'Mercari' },
  { id: 'poshmark', label: 'Poshmark' },
  { id: 'facebook', label: 'FB Mkt' },
  { id: 'whatnot', label: 'Whatnot' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListingDraftOverrides {
  productName?: string
  category?: string
  condition?: string
  description?: string
  estimatedSellPrice?: number
  shippingCost?: number
  platform?: string
}

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  settings?: AppSettings
  onSaveDraft: (price: number, notes: string) => void
  onCreateListing: (price: number, notes: string, draft: ListingDraftOverrides) => void
  onPassItem: (price: number, notes: string) => void
  onMaybeItem?: (price: number, notes: string) => void
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
    <div className="space-y-1.5 relative">
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
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
              style={{ animation: 'shimmer-sweep 1.5s ease-in-out infinite' }}
            />
          )}
          {isComplete && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
  onMaybeItem,
  onRecalculate,
  onRescan,
  onOpenCamera,
}: AIScreenProps) {
  // ── Listing form state ──
  const [buyPrice, setBuyPrice] = useState('')
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [estSellPrice, setEstSellPrice] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState('ebay')
  const [listingAdded, setListingAdded] = useState(false)

  const [formOpen, setFormOpen] = useCollapsePreference('ai-listing-form', true)
  const [summaryOpen, setSummaryOpen] = useCollapsePreference('ai-summary', false)
  const [imageOpen, setImageOpen] = useCollapsePreference('ai-image', false)
  const { isListening, startListening, isSupported } = useVoiceInput()

  // True when pipeline completed a decision OR when reopening a pre-analyzed item
  // (pipeline is empty on reopen, but currentItem.decision already holds the result)
  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
    || !!(currentItem?.decision)
  const isPipelineRunning = pipeline.length > 0 && pipeline.some(p => p.status === 'processing')
  const decision = currentItem?.decision
  const canSaveDraft = !!(currentItem?.imageData || description.trim().length > 0)

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
  }, [])

  // Reset all form fields when a new scan starts (currentItem.id changes)
  useEffect(() => {
    setItemName('')
    setCategory('')
    setCondition('')
    setBuyPrice('')
    setEstSellPrice('')
    setShippingCost('')
    setDescription('')
    setListingAdded(false)
  }, [currentItem?.id])

  // Pre-fill form once the decision step completes
  // if-guards on each field prevent overwriting user edits
  useEffect(() => {
    if (!hasDecision || !currentItem) return
    if (itemName === '') setItemName(currentItem.productName || '')
    if (category === '') setCategory(currentItem.category || '')
    if (condition === '') setCondition('Good')
    if (buyPrice === '' && (currentItem.purchasePrice ?? 0) > 0) {
      setBuyPrice(String(currentItem.purchasePrice))
    }
    if (estSellPrice === '' && currentItem.estimatedSellPrice) {
      setEstSellPrice(currentItem.estimatedSellPrice.toFixed(2))
    }
    if (shippingCost === '' && settings?.defaultShippingCost) {
      setShippingCost(String(settings.defaultShippingCost))
    }
    if (description === '' && currentItem.description) {
      setDescription(currentItem.description)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDecision, currentItem?.id]) // minimal deps — if-guards prevent overwrites

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

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  const handleAddToQueue = useCallback(() => {
    onCreateListing(parseFloat(buyPrice) || 0, description, {
      productName: itemName || undefined,
      category: category || undefined,
      condition: condition || undefined,
      description: description || undefined,
      estimatedSellPrice: parseFloat(estSellPrice) > 0 ? parseFloat(estSellPrice) : undefined,
      shippingCost: parseFloat(shippingCost) > 0 ? parseFloat(shippingCost) : undefined,
      platform,
    })
    setListingAdded(true)
  }, [buyPrice, description, itemName, category, condition, estSellPrice, shippingCost, platform, onCreateListing])

  return (
    <div className="flex flex-col w-full h-full bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />

      {/* ── Overall Progress — persistent strip between header and scroll ── */}
      {pipeline.length > 0 && (
        <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-s2 bg-fg">
          <OverallProgress steps={pipeline} />
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" ref={pullToRefresh.containerRef}>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-6">
          {(!currentItem && pipeline.length === 0) ? null : (
            /* Scan result — shown as soon as currentItem exists OR pipeline is running */
            <div className="space-y-3 sm:space-y-4">
              {/* Pipeline steps — only visible during an active scan */}
              {pipeline.length > 0 && <PipelinePanel steps={pipeline} />}

              {/* Market velocity "still searching" banner */}
              {pipeline.length > 0 && isPipelineRunning && (() => {
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

              {/* ── Listing draft form ── */}
              {hasDecision && !listingAdded && (
                <Collapsible open={formOpen} onOpenChange={setFormOpen}>
                  <Card className="mt-3 p-3 sm:p-4 bg-fg border-s2">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <ClipboardText size={18} weight="bold" className="text-b1" />
                          <h3 className="text-xs font-bold uppercase tracking-wide text-t1">
                            LISTING DRAFT
                          </h3>
                        </div>
                        <CaretDown
                          size={16}
                          weight="bold"
                          className={cn(
                            'text-t3 transition-transform duration-200 flex-shrink-0',
                            formOpen && 'rotate-180',
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2.5 mt-2">
                        {/* Item name */}
                        <div>
                          <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                            Item Name
                          </label>
                          <Input
                            value={itemName}
                            onChange={e => setItemName(e.target.value)}
                            placeholder="e.g. Nike Air Max 90 White/Black"
                            className="h-9 bg-bg border-s2 text-sm"
                          />
                        </div>

                        {/* Category + Condition */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                              Category
                            </label>
                            <Input
                              value={category}
                              onChange={e => setCategory(e.target.value)}
                              placeholder="e.g. Sneakers"
                              className="h-9 bg-bg border-s2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                              Condition
                            </label>
                            <select
                              value={condition}
                              onChange={e => setCondition(e.target.value)}
                              className="w-full h-9 rounded-md border border-s2 bg-bg px-2 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-b1/50"
                            >
                              <option value="">Select…</option>
                              {CONDITIONS.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Price row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                              Buy $
                            </label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={buyPrice}
                              onChange={e => setBuyPrice(e.target.value)}
                              className="h-9 bg-bg border-s2 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                              Sell $
                            </label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={estSellPrice}
                              onChange={e => setEstSellPrice(e.target.value)}
                              className="h-9 bg-bg border-s2 text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 block">
                              Ship $
                            </label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={shippingCost}
                              onChange={e => setShippingCost(e.target.value)}
                              className="h-9 bg-bg border-s2 text-sm font-mono"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1 flex items-center justify-between">
                            <span>Description / Notes</span>
                            {isSupported && (
                              <button
                                onClick={() =>
                                  startListening(text =>
                                    setDescription(prev => (prev ? prev + ' ' + text : text)),
                                  )
                                }
                                className={cn(
                                  'w-6 h-6 flex items-center justify-center rounded-md transition-colors',
                                  isListening
                                    ? 'text-red animate-pulse'
                                    : 'text-t3 hover:text-t1',
                                )}
                              >
                                <Microphone size={13} weight="bold" />
                              </button>
                            )}
                          </label>
                          <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Brand, model, size, color, notable features, flaws…"
                            rows={3}
                            className="bg-bg border-s2 text-sm resize-none"
                          />
                        </div>

                        {/* Platform selector */}
                        <div>
                          <label className="text-[10px] font-semibold text-t3 uppercase tracking-wide mb-1.5 block">
                            List On
                          </label>
                          <div className="flex gap-1.5 flex-wrap">
                            {PLATFORMS.map(p => (
                              <button
                                key={p.id}
                                onClick={() => setPlatform(p.id)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                                  platform === p.id
                                    ? 'bg-b1 text-white border-b1'
                                    : 'bg-bg text-t2 border-s2 hover:border-b1/50',
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Added-to-queue success banner */}
              {listingAdded && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-green/10 border border-green/30"
                >
                  <CheckCircle size={20} weight="fill" className="text-green flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-green">Added to Queue</p>
                    <p className="text-[10px] text-t3 mt-0.5">
                      AI is optimizing the listing in the background
                    </p>
                  </div>
                </motion.div>
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
                            {currentItem.profitMargin != null && currentItem.estimatedSellPrice
                              ? `$${((currentItem.estimatedSellPrice * currentItem.profitMargin) / 100).toFixed(2)}`
                              : '--'}
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
          listingAdded ? (
            /* Success state — offer to scan another item */
            <div className="p-2.5 sm:p-3">
              <Button
                onClick={() => onRescan?.()}
                className="w-full h-11 bg-b1 hover:bg-b2 text-white font-semibold text-sm"
              >
                <Scan size={15} weight="bold" className="mr-1.5" />
                Scan Another Item
              </Button>
            </div>
          ) : (
            /* Decision available — main action bar */
            <div className="p-2.5 sm:p-3 space-y-2">
              {/* Recalculate — only when buy price has diverged from analyzed price */}
              {buyPrice !== '' &&
                parseFloat(buyPrice) !== currentItem?.purchasePrice && (
                  <Button
                    onClick={() => onRecalculate?.(parseFloat(buyPrice))}
                    className="w-full bg-amber hover:opacity-90 text-white h-10 font-semibold text-xs sm:text-sm"
                  >
                    <ArrowClockwise size={15} weight="bold" className="mr-1.5" />
                    ♻️ Recalculate with new price
                  </Button>
                )}

              {/* Row 1: secondary actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => onRescan?.()}
                  variant="outline"
                  className="flex-shrink-0 h-10 px-3 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-xs"
                >
                  <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                  Rescan
                </Button>
                <Button
                  onClick={() => onPassItem(parseFloat(buyPrice) || 0, description)}
                  disabled={!canSaveDraft}
                  variant="outline"
                  className="flex-1 h-10 border-red/40 text-red hover:bg-red/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
                >
                  <XCircle size={15} weight="bold" className="mr-1" />
                  Pass
                </Button>
                {onMaybeItem && (
                  <Button
                    onClick={() => onMaybeItem(parseFloat(buyPrice) || 0, description)}
                    disabled={!canSaveDraft}
                    variant="outline"
                    className="flex-1 h-10 border-amber-400/50 text-amber-500 hover:bg-amber-400/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
                  >
                    <BookmarkSimple size={15} weight="bold" className="mr-1" />
                    Maybe
                  </Button>
                )}
              </div>
              {/* Row 2: primary CTA — full width, tall, prominent */}
              <Button
                onClick={handleAddToQueue}
                disabled={!canSaveDraft}
                className="w-full h-11 sm:h-12 bg-green hover:opacity-90 text-white disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold shadow-md shadow-green/20"
              >
                <ShoppingCart size={16} weight="bold" className="mr-2" />
                Add to Queue
              </Button>
            </div>
          )
        ) : isPipelineRunning ? (
          /* Pipeline in progress */
          <div className="flex items-center justify-center gap-2 h-12 text-xs text-t3 font-medium">
            <span className="w-2 h-2 rounded-full bg-b1 animate-pulse" />
            Analyzing… decision coming
          </div>
        ) : pipeline.length > 0 ? (
          /* Pipeline ended without a decision (error path) */
          <div className="p-2.5 sm:p-3">
            <Button
              onClick={() => onRescan?.()}
              variant="outline"
              className="w-full h-10 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-sm"
            >
              <ArrowCounterClockwise size={14} weight="bold" className="mr-1.5" />
              Rescan
            </Button>
          </div>
        ) : (
          /* No pipeline yet — quick draft capture */
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
                className="flex-1 bg-b1 hover:bg-b2 text-white h-10 font-medium disabled:opacity-40 disabled:cursor-not-allowed text-sm"
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
