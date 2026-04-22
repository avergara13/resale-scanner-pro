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
  Camera,
} from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { haptics } from '@/lib/haptics'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card } from '@/components/ui/card'
import { PipelinePanel } from './PipelinePanel'
import { DecisionSignal } from './DecisionSignal'
import { MarketDataPanel } from '../MarketDataPanel'
import { GoogleLensResults } from '../GoogleLensResults'
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
  onRecalculate?: (buyPrice: number, sellPrice?: number, shippingCost?: number) => void
  onRescan?: () => void
  onOpenCamera?: () => void
  onAddPhoto?: () => void
  onDeletePhoto?: (index: number) => void
  onDeletePrimaryPhoto?: () => void
}

// ─── Celebration particles ────────────────────────────────────────────────────

/**
 * Resolve a CSS custom-property name to its computed `oklch(...)` string.
 * Falls back to a sensible default when the DOM isn't available (SSR / tests).
 * We compute at render-time so light/dark mode swaps pick up automatically.
 */
function tokenColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return v || fallback
}

function CelebrationParticle({ delay, index }: { delay: number; index: number }) {
  const spread = ((index * 37) % 200) - 100
  const rotation = ((index * 83) % 720) - 360
  // WS-21 Phase 3: swap hardcoded hex → tokens so particles honor theme.
  // getComputedStyle returns the raw `oklch(...)` string from --green/--amber/--b1.
  const colors = [
    tokenColor('--green', 'oklch(0.60 0.17 145)'),
    tokenColor('--amber', 'oklch(0.75 0.15 75)'),
    tokenColor('--b1', 'oklch(0.56 0.21 250)'),
    tokenColor('--system-yellow', 'oklch(0.85 0.17 95)'),
  ]
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
        x: spread,
        y: [-80, -120, -160],
        scale: [0, 1.2, 1, 0.8],
        rotate: rotation,
      }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
    >
      {shape}
    </motion.div>
  )
}

function CelebrationEffect() {
  // WS-21 Phase 3: honor prefers-reduced-motion. Completely skip the particle
  // effect — a static glow is already carried by the pipeline card, so absence
  // of confetti still reads as "complete." 20× infinite scale/rotate/opacity
  // animations are the most likely motion-sensitivity trigger in the app.
  const shouldReduceMotion = useReducedMotion()
  if (shouldReduceMotion) return null
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
  // WS-21 Phase 3: gate infinite animations on prefers-reduced-motion.
  // This bar runs during every scan (not just celebrations), so it's the
  // most-triggered motion surface for sensitive users.
  const shouldReduceMotion = useReducedMotion()
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
      const frame = window.requestAnimationFrame(() => {
        setShowCelebration(true)
      })
      const timer = setTimeout(() => setShowCelebration(false), 1500)
      return () => {
        window.cancelAnimationFrame(frame)
        clearTimeout(timer)
      }
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
            backgroundPosition: isProcessing && !shouldReduceMotion
              ? ['0% 50%', '100% 50%', '0% 50%']
              : '0% 50%',
          }}
          transition={{
            width: { duration: 0.6, ease: 'easeOut' },
            backgroundPosition: isProcessing && !shouldReduceMotion
              ? { duration: 2, ease: 'linear', repeat: Infinity }
              : { duration: 0 },
          }}
          style={{ backgroundSize: '200% 100%' }}
        >
          {isProcessing && !shouldReduceMotion && (
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
  onAddPhoto,
  onDeletePhoto,
  onDeletePrimaryPhoto,
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
  const [confirmPass, setConfirmPass] = useState(false)
  const { isListening, startListening, isSupported } = useVoiceInput()
  // WS-21 Phase 3: Apple-native interaction polish.
  const shouldReduceMotion = useReducedMotion()
  // Add to Queue: lock the button while the commit is inflight so a double-tap
  // can't submit twice. Ref-backed so the guard read is synchronous — a pure
  // useState reads from closure and can miss a simultaneous double-dispatch in
  // the same microtask. The matching state flag drives the disabled prop.
  const isAddingRef = useRef(false)
  const [isAddingToQueue, setIsAddingToQueue] = useState(false)
  // Platform selector: 400 ms post-tap lock. Prevents rapid re-taps from
  // spam-firing state changes (each one can kick a recalc upstream).
  const platformLockUntilRef = useRef(0)
  // Photo delete: which additional index is currently fading out (pointer-
  // events-none for the fade window). Primary delete uses -1. Ref-backed for
  // a synchronous guard read matching the other inflight locks on this screen.
  const deletingPhotoRef = useRef<number | null>(null)
  const [deletingPhotoIdx, setDeletingPhotoIdx] = useState<number | null>(null)

  // hasDecision: true only when we have a FINALIZED decision (BUY or PASS).
  // PENDING is the initial value every new scan starts with — including it here
  // causes panels to flash before the pipeline runs and the action bar to appear
  // prematurely. PENDING is handled separately via pipelineComplete below.
  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
    || (currentItem?.decision === 'BUY' || currentItem?.decision === 'PASS')

  // Single source of truth for scan phase. Computed from the pipeline array so that
  // exactly one footer/CTA region renders at any time. The previous pair of
  // independent booleans (isPipelineRunning + pipelineComplete) could both be
  // false during a transient window — no step 'processing' but some still 'pending' —
  // which dropped the UI into the 'no pipeline yet' draft footer mid-scan.
  type ScanPhase = 'idle' | 'running' | 'complete'
  const scanPhase: ScanPhase = pipeline.length === 0
    ? (currentItem ? 'complete' : 'idle')  // reopened item → treat as complete
    : pipeline.every(p => p.status === 'complete' || p.status === 'error')
      ? 'complete'
      : 'running'  // any 'pending' or 'processing' step keeps us in running

  const isPipelineRunning = scanPhase === 'running'
  const pipelineComplete = scanPhase === 'complete'

  // hasPriceData: we have real market pricing to show in Quick Summary
  const hasPriceData = !!(currentItem?.estimatedSellPrice && currentItem.estimatedSellPrice > 0)

  const decision = currentItem?.decision
  const canSaveDraft = !!(currentItem?.imageData || description.trim().length > 0)

  // Derived floats for form-change detection (computed once, used in multiple places)
  const buyPriceFloat = parseFloat(buyPrice)
  const sellPriceFloat = parseFloat(estSellPrice)
  const shipPriceFloat = parseFloat(shippingCost)

  // formHasChanges: show Recalculate when ANY input differs from what's stored on the item.
  // Covers: editing AI-provided sell price, adjusting shipping, changing buy price.
  const formHasChanges =
    (buyPrice !== '' && Number.isFinite(buyPriceFloat) && buyPriceFloat !== (currentItem?.purchasePrice ?? 0)) ||
    (estSellPrice !== '' && Number.isFinite(sellPriceFloat) && sellPriceFloat > 0 && sellPriceFloat !== (currentItem?.estimatedSellPrice ?? 0)) ||
    (shippingCost !== '' && Number.isFinite(shipPriceFloat) && shipPriceFloat >= 0 && shipPriceFloat !== (settings?.defaultShippingCost ?? 5.0))

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
    setConfirmPass(false)
  }, [currentItem?.id])

  // Pre-fill form once the pipeline finishes (any decision, including PENDING)
  // if-guards on each field prevent overwriting user edits after initial fill
  useEffect(() => {
    if (!pipelineComplete || !currentItem) return
    if (itemName === '') setItemName(currentItem.productName || '')
    if (category === '') setCategory(currentItem.category || '')
    if (condition === '') setCondition(currentItem.condition || 'New')
    // Always pre-fill buy price so user can see and edit the assumed cost
    // purchasePrice=0 → empty string (user sees "free / $0 assumed")
    if (buyPrice === '') {
      setBuyPrice(currentItem.purchasePrice > 0 ? String(currentItem.purchasePrice) : '')
    }
    if (estSellPrice === '' && currentItem.estimatedSellPrice) {
      setEstSellPrice(currentItem.estimatedSellPrice.toFixed(2))
    }
    if (shippingCost === '' && settings?.defaultShippingCost) {
      setShippingCost(String(settings.defaultShippingCost))
    }
    // 'Product analysis unavailable' is an internal sentinel used by
    // handleBatchAnalyze to detect un-enriched quick drafts; never pre-fill it
    // into the user-facing input — it would read as a decision when it isn't.
    if (description === '' && currentItem.description && currentItem.description !== 'Product analysis unavailable') {
      setDescription(currentItem.description)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineComplete, currentItem?.id]) // minimal deps — if-guards prevent overwrites

  // Auto-scroll to decision/result when pipeline finishes (BUY / MAYBE / PASS)
  const decisionRef = useRef<HTMLDivElement>(null)
  const prevPipelineComplete = useRef(false)
  useEffect(() => {
    if (pipelineComplete && !prevPipelineComplete.current) {
      setTimeout(() => {
        decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    }
    prevPipelineComplete.current = pipelineComplete
  }, [pipelineComplete])

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  const handleAddToQueue = useCallback(() => {
    // WS-21 Phase 3: inflight guard — ref read is synchronous so back-to-back
    // dispatches in the same microtask can't both pass. Also fires medium
    // haptic to confirm the commit action.
    if (isAddingRef.current) return
    isAddingRef.current = true
    setIsAddingToQueue(true)
    haptics.impactMedium()
    try {
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
    } finally {
      // onCreateListing is sync-fire-and-forget in the shell; release the lock
      // after a short window so rapid double-tap is still blocked, but the
      // button is usable again by the time the user finishes reading the
      // success banner and navigates away.
      setTimeout(() => {
        isAddingRef.current = false
        setIsAddingToQueue(false)
      }, 400)
    }
  }, [buyPrice, description, itemName, category, condition, estSellPrice, shippingCost, platform, onCreateListing])

  // WS-21 Phase 3: platform selector with 400 ms lock + debounced haptic.
  const handleSelectPlatform = useCallback((id: string) => {
    const now = Date.now()
    if (now < platformLockUntilRef.current) return
    if (id === platform) return
    platformLockUntilRef.current = now + 400
    haptics.selectionDebounced()
    setPlatform(id)
  }, [platform])

  // WS-21 Phase 3: photo delete with 1 s opacity-fade. Prevents double-click
  // races while the delete resolves upstream. Synchronous ref guard + state
  // for rendering the fade.
  const handleAdditionalPhotoDelete = useCallback((idx: number) => {
    if (deletingPhotoRef.current !== null) return
    deletingPhotoRef.current = idx
    setDeletingPhotoIdx(idx)
    haptics.selection()
    onDeletePhoto?.(idx)
    setTimeout(() => {
      deletingPhotoRef.current = null
      setDeletingPhotoIdx(null)
    }, 1000)
  }, [onDeletePhoto])

  const handlePrimaryPhotoDelete = useCallback(() => {
    if (deletingPhotoRef.current !== null) return
    deletingPhotoRef.current = -1
    setDeletingPhotoIdx(-1)
    haptics.selection()
    onDeletePrimaryPhoto?.()
    setTimeout(() => {
      deletingPhotoRef.current = null
      setDeletingPhotoIdx(null)
    }, 1000)
  }, [onDeletePrimaryPhoto])

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
      <div className="flex-1 app-scroll-container" ref={pullToRefresh.containerRef}>
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

              {/* Decision signal — show once pipeline produces a final BUY / MAYBE / PASS */}
              {pipelineComplete && decision && (
                <div className="mt-3 sm:mt-4" ref={decisionRef}>
                  <DecisionSignal decision={decision} item={currentItem} />
                </div>
              )}

              {/* ── Platform ROI Comparison — BUY only, 3 platforms ── */}
              {pipelineComplete && decision === 'BUY' && currentItem?.platformComparison && currentItem.platformComparison.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold text-t3 uppercase tracking-widest mb-1.5 px-0.5">Alt Platform Comparison</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {currentItem.platformComparison.map(p => {
                      const isPos = p.netProfit >= 0
                      return (
                        <div
                          key={p.platform}
                          className={cn(
                            'relative rounded-xl px-2 py-2 border text-left material-thin',
                            p.recommended
                              ? 'border-green/30 bg-green/5'
                              : 'border-s2/60 bg-fg/5'
                          )}
                        >
                          {p.recommended && (
                            <span className="absolute top-1 right-1 text-[7px] font-black text-green tracking-wide uppercase">BEST</span>
                          )}
                          <p className="text-[9px] font-bold text-t2 truncate mb-1">{p.platform}</p>
                          <p className={cn('text-sm font-bold font-mono leading-none', isPos ? 'text-green' : 'text-red')}>
                            {isPos ? '+' : ''}{p.netProfit.toFixed(2)}
                          </p>
                          <p className={cn('text-[9px] font-mono mt-0.5', isPos ? 'text-green/80' : 'text-red/80')}>
                            {p.profitMargin.toFixed(0)}% margin
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── 1. Quick Summary — only when we have real pricing data ── */}
              {hasDecision && currentItem && hasPriceData && (
                <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                  <Card className="mt-3 sm:mt-4 p-3 sm:p-4 border-s2/60 overflow-hidden material-thin">
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
                        <div className="rounded-lg border border-s2/60 bg-system-background/85 p-2.5 sm:p-3">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Buy Price</p>
                          <p className="text-base sm:text-lg font-mono font-bold text-t1">
                            ${currentItem.purchasePrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-s2/60 bg-system-background/85 p-2.5 sm:p-3">
                          <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Sell Price</p>
                          <p className="text-base sm:text-lg font-mono font-bold text-t1">
                            ${currentItem.estimatedSellPrice?.toFixed(2) || '--'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-s2/60 bg-system-background/85 p-2.5 sm:p-3">
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
                        <div className="rounded-lg border border-s2/60 bg-system-background/85 p-2.5 sm:p-3">
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

              {/* ── 2. Listing draft form — always visible once pipeline is done ── */}
              {pipelineComplete && !listingAdded && (
                <Collapsible open={formOpen} onOpenChange={setFormOpen}>
                  <Card className="mt-3 p-3 sm:p-4 border-s2/60 material-thin">
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

                        {/* ── Price range pills — tap to fill Sell $ from market data ──
                            Prefer the trimmed p10/p90 band over literal min/max; a single
                            outlier at 50× the median used to push the "High" chip into
                            orbit and destroy user trust. Falls back to min/max only when
                            the sample was too thin to percentile-rank. */}
                        {(currentItem?.lensAnalysis?.priceRange || currentItem?.estimatedSellPrice || currentItem?.marketData?.ebayPriceRange) && (
                          <div className="flex items-center gap-1.5 flex-wrap -mt-0.5">
                            <span className="text-[9px] text-t3 font-medium uppercase tracking-wide shrink-0">
                              Range:
                            </span>
                            {/* eBay trimmed band (p10/p90) or min/max fallback */}
                            {/* WS-21 Phase 3: flex-1 for equal widths; active:scale-[0.99]
                                + 120 ms transition for press micro-animation;
                                selectionDebounced haptic suppresses rapid re-tap spam. */}
                            {currentItem?.marketData?.ebayPriceRange && (() => {
                              const p10 = currentItem.marketData.ebayP10
                              const p90 = currentItem.marketData.ebayP90
                              const useBand = p10 !== undefined && p90 !== undefined && p90 > 0
                              const low = useBand ? p10! : currentItem.marketData.ebayPriceRange.min
                              const high = useBand ? p90! : currentItem.marketData.ebayPriceRange.max
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { haptics.selectionDebounced(); setEstSellPrice(low.toFixed(2)) }}
                                    className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-s1 text-t2 active:bg-s2 active:scale-[0.99] transition-all duration-[120ms]"
                                  >
                                    Low ${low.toFixed(0)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { haptics.selectionDebounced(); setEstSellPrice(high.toFixed(2)) }}
                                    className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-s1 text-t2 active:bg-s2 active:scale-[0.99] transition-all duration-[120ms]"
                                  >
                                    High ${high.toFixed(0)}
                                  </button>
                                </>
                              )
                            })()}
                            {/* Lens avg (only when no eBay range to avoid duplicates) */}
                            {currentItem?.lensAnalysis?.priceRange && !currentItem?.marketData?.ebayPriceRange && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { haptics.selectionDebounced(); setEstSellPrice(currentItem!.lensAnalysis!.priceRange!.min.toFixed(2)) }}
                                  className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-s1 text-t2 active:bg-s2 active:scale-[0.99] transition-all duration-[120ms]"
                                >
                                  Low ${currentItem.lensAnalysis.priceRange.min.toFixed(0)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { haptics.selectionDebounced(); setEstSellPrice(currentItem!.lensAnalysis!.priceRange!.average.toFixed(2)) }}
                                  className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-s1/80 text-t2 active:bg-s2 active:scale-[0.99] transition-all duration-[120ms]"
                                >
                                  Avg ${currentItem.lensAnalysis.priceRange.average.toFixed(0)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { haptics.selectionDebounced(); setEstSellPrice(currentItem!.lensAnalysis!.priceRange!.max.toFixed(2)) }}
                                  className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-s1 text-t2 active:bg-s2 active:scale-[0.99] transition-all duration-[120ms]"
                                >
                                  High ${currentItem.lensAnalysis.priceRange.max.toFixed(0)}
                                </button>
                              </>
                            )}
                            {/* AI suggested price — always shown when available */}
                            {currentItem?.estimatedSellPrice && (
                              <button
                                type="button"
                                onClick={() => { haptics.selectionDebounced(); setEstSellPrice(currentItem!.estimatedSellPrice!.toFixed(2)) }}
                                className="flex-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-b1/15 dark:bg-b1/20 text-b1 active:bg-b1/25 active:scale-[0.99] transition-all duration-[120ms]"
                              >
                                AI ${currentItem.estimatedSellPrice.toFixed(0)}
                              </button>
                            )}
                          </div>
                        )}

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
                                onClick={() => handleSelectPlatform(p.id)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all active:scale-[0.98]',
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

              {/* ── 3. Photos — collapsible multi-photo strip ── */}
              {(currentItem?.imageData || currentItem?.imageThumbnail) && (
                <Collapsible open={imageOpen} onOpenChange={setImageOpen}>
                  <Card className="mt-3 sm:mt-4 p-3 sm:p-4 border-s2/60 overflow-hidden material-thin">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Image size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
                          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-t1">
                            PHOTOS
                          </h3>
                          <span className="text-[10px] text-t3 font-medium">
                            {1 + (currentItem?.additionalImages?.length || 0)}/5
                          </span>
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
                      <div className="flex items-start gap-2 overflow-x-auto pb-1">
                        {/* Primary photo */}
                        {/* WS-21 Phase 3: fade + pointer-events-none during delete so
                            a double-click can't fire the handler twice. */}
                        <div
                          className={cn(
                            'relative flex-shrink-0 transition-opacity duration-300',
                            deletingPhotoIdx === -1 && 'opacity-40 pointer-events-none',
                          )}
                        >
                          <img
                            src={currentItem.imageData || currentItem.imageThumbnail}
                            alt="Primary photo"
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-b1/30"
                          />
                          <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white bg-b1/80 px-1.5 py-0.5 rounded-full leading-tight">
                            Main
                          </span>
                          <button
                            onClick={handlePrimaryPhotoDelete}
                            disabled={deletingPhotoIdx !== null}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-40"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <XCircle size={12} weight="fill" className="text-white" />
                          </button>
                        </div>

                        {/* Additional photos */}
                        {(currentItem.additionalImages || []).map((thumb, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'relative flex-shrink-0 transition-opacity duration-300',
                              deletingPhotoIdx === idx && 'opacity-40 pointer-events-none',
                            )}
                          >
                            <img
                              src={thumb}
                              alt={`Photo ${idx + 2}`}
                              className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-s2"
                            />
                            <button
                              onClick={() => handleAdditionalPhotoDelete(idx)}
                              disabled={deletingPhotoIdx !== null}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-40"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <XCircle size={12} weight="fill" className="text-white" />
                            </button>
                          </div>
                        ))}

                        {/* Add photo button — hidden when at max 5 */}
                        {(1 + (currentItem.additionalImages?.length || 0)) < 5 && (
                          <button
                            onClick={() => { haptics.selection(); onAddPhoto?.() }}
                            className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl border-2 border-dashed border-s2 flex flex-col items-center justify-center gap-1 hover:bg-s1 transition-colors active:scale-[0.97]"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Camera size={18} className="text-t3" />
                            <span className="text-[9px] text-t3 font-medium">Add Photo</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-t3 mt-2 leading-tight opacity-70">
                        Add photos then tap Re-analyze to scan all {1 + (currentItem?.additionalImages?.length || 0)} together
                      </p>
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
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      {/* Footer is driven by scanPhase (derived above). Exactly one branch renders:
          'complete' → post-scan action bar (or success), 'running' → "Analyzing..."
          pill, 'idle' → quick draft capture. No overlap is possible. */}
      <div className="flex-shrink-0 border-t border-s2 bg-fg/95 backdrop-blur-md safe-bottom">
        {scanPhase === 'complete' ? (
          listingAdded ? (
            /* Success state — offer to scan another item (new photo via camera) */
            <div className="p-2.5 sm:p-3">
              <Button
                onClick={() => { haptics.selection(); onOpenCamera?.() }}
                className="w-full h-11 rounded-xl bg-b1 hover:bg-b2 text-white font-semibold text-sm active:scale-[0.97] transition-all"
              >
                <Scan size={15} weight="bold" className="mr-1.5" />
                Scan Another Item
              </Button>
            </div>
          ) : (
            /* Pipeline done (BUY / PASS / PENDING) — show all actions */
            <div className="p-2.5 sm:p-3 space-y-2">
              {/* Recalculate — shown when ANY of buy, sell, or shipping differ from stored values */}
              {formHasChanges && (
                <Button
                  onClick={() => {
                    haptics.selection()
                    onRecalculate?.(
                      Number.isFinite(buyPriceFloat) ? buyPriceFloat : 0,
                      Number.isFinite(sellPriceFloat) && sellPriceFloat > 0 ? sellPriceFloat : undefined,
                      Number.isFinite(shipPriceFloat) && shipPriceFloat >= 0 ? shipPriceFloat : undefined,
                    )
                  }}
                  className="w-full rounded-xl bg-amber hover:opacity-90 text-white h-10 font-semibold text-sm active:scale-[0.97] transition-all"
                >
                  <ArrowClockwise size={15} weight="bold" className="mr-1.5" />
                  Recalculate ROI
                </Button>
              )}

              {/* Row 1: secondary actions */}
              {/* WS-21 Phase 3: haptics on every decision-class tap.
                  Selection for navigational taps, impactMedium for state-commit
                  actions (entering Pass confirm, Add to Queue). */}
              <div className="flex gap-2">
                <Button
                  onClick={() => { haptics.selection(); onRescan?.() }}
                  variant="outline"
                  className="flex-shrink-0 h-10 px-3 rounded-xl border border-s2 text-t2 hover:text-t1 hover:bg-s1 font-semibold text-xs active:scale-[0.97] transition-all"
                >
                  <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                  Re-analyze
                </Button>
                {/* Pass — 2-step confirm to prevent accidental dismissal */}
                {confirmPass ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => { haptics.selection(); setConfirmPass(false) }}
                      className="flex-1 h-10 rounded-xl text-xs text-t3 border border-s2 hover:bg-s1 active:scale-[0.97] transition-all"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => { haptics.selection(); onPassItem(parseFloat(buyPrice) || 0, description); setConfirmPass(false) }}
                      className="flex-1 h-10 rounded-xl text-xs font-bold bg-red hover:opacity-90 hover:ring-1 hover:ring-red/30 focus-visible:ring-1 focus-visible:ring-red/30 text-white border-0 active:scale-[0.97] transition-all"
                    >
                      Confirm Pass
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => { haptics.impactMedium(); setConfirmPass(true) }}
                    disabled={!canSaveDraft}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl border border-red/40 text-red hover:bg-red/10 font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
                  >
                    <XCircle size={15} weight="bold" className="mr-1" />
                    Pass
                  </Button>
                )}
                {!confirmPass && onMaybeItem && (
                  <Button
                    onClick={() => { haptics.selection(); onMaybeItem(parseFloat(buyPrice) || 0, description) }}
                    disabled={!canSaveDraft}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl border border-amber-400/50 text-amber-500 hover:bg-amber-400/10 font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
                  >
                    <BookmarkSimple size={15} weight="bold" className="mr-1" />
                    Maybe
                  </Button>
                )}
              </div>
              {/* Row 2: camera + primary CTA — CTA locked when PENDING or inflight */}
              <div className="flex gap-2">
                <button
                  onClick={() => { haptics.selection(); onOpenCamera?.() }}
                  className="w-11 h-11 flex-shrink-0 rounded-xl border border-s2 text-t2 hover:text-t1 hover:bg-s1 flex items-center justify-center active:scale-[0.97] transition-all"
                  style={{ touchAction: 'manipulation' }}
                  title="Open camera"
                >
                  <Camera size={18} weight="bold" />
                </button>
                <Button
                  onClick={handleAddToQueue}
                  disabled={!canSaveDraft || decision === 'PENDING' || isAddingToQueue}
                  className="flex-1 h-11 rounded-xl border border-system-green/20 bg-system-green text-white font-bold shadow-sm shadow-green/20 disabled:opacity-40 disabled:cursor-not-allowed text-sm active:scale-[0.97] transition-all hover:bg-system-green/90"
                >
                  <ShoppingCart size={16} weight="bold" className="mr-2" />
                  Add to Queue
                </Button>
              </div>
              {decision === 'PENDING' && (
                <p className="text-center text-[10px] text-t3 -mt-1 leading-tight">
                  Enter a sell price and tap Recalculate to unlock
                </p>
              )}
            </div>
          )
        ) : scanPhase === 'running' ? (
          /* Pipeline in progress */
          <div className="flex items-center justify-center gap-2 h-12 text-xs text-t3 font-medium">
            <span className="w-2 h-2 rounded-full bg-b1 animate-pulse" />
            Analyzing… decision coming
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
                  className="flex-shrink-0 h-10 px-3 rounded-xl border border-s2 text-t2 hover:text-t1 hover:bg-s1 font-semibold text-xs active:scale-[0.97] transition-all"
                >
                  <ArrowCounterClockwise size={14} weight="bold" className="mr-1" />
                  Re-analyze
                </Button>
              )}
              <Button
                onClick={() => onSaveDraft(parseFloat(buyPrice), description)}
                disabled={!canSaveDraft}
                className="flex-1 rounded-xl bg-b1 hover:bg-b2 text-white h-10 font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-sm active:scale-[0.97] transition-all"
              >
                <FloppyDisk size={16} weight="bold" className="mr-1.5 sm:mr-2" />
                Save Draft to Queue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
