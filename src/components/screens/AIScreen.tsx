import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { marked } from 'marked'

// Prevent XSS: escape raw HTML blocks in AI output instead of passing them through.
// Markdown formatting (bold, lists, etc.) still works — only literal <tags> are neutralised.
marked.use({
  renderer: {
    html({ text }: { text: string }) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    },
  },
})
import { Robot, Plus, Microphone, Scan, FloppyDisk, PaperPlaneRight, Sparkle, CaretDown, ChartBar, Image, ListChecks, Check, Trash, ArrowClockwise, ArrowCounterClockwise, XCircle, ShoppingCart } from '@phosphor-icons/react'
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

function QueueListingCard({ item, onDiscuss }: { item: ScannedItem; onDiscuss: (item: ScannedItem) => void }) {
  const statusColor =
    item.listingStatus === 'ready' ? 'text-green bg-green/10 border-green/30' :
    item.listingStatus === 'optimizing' ? 'text-amber bg-amber/10 border-amber/30' :
    item.listingStatus === 'published' ? 'text-b1 bg-b1/10 border-b1/30' :
    'text-t3 bg-s1 border-s2'

  const hasSellPrice = item.estimatedSellPrice != null && isFinite(item.estimatedSellPrice)
  const profit = hasSellPrice ? item.estimatedSellPrice! - item.purchasePrice : null

  return (
    <Card className="p-3 bg-fg border-s2 flex gap-3 items-start">
      {(item.imageThumbnail || item.imageData) && (
        <img
          src={item.imageThumbnail || item.imageData}
          alt={item.productName || 'Item'}
          className="w-14 h-14 rounded-lg object-cover border border-s2 flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-bold text-t1 truncate">{item.productName || 'Unnamed Item'}</p>
        <div className="flex gap-2 text-[10px] font-mono text-t2 flex-wrap">
          <span>Buy ${item.purchasePrice.toFixed(2)}</span>
          <span>→</span>
          <span>Sell ${item.estimatedSellPrice?.toFixed(2) ?? '--'}</span>
          {profit != null && (
            <span className={profit >= 0 ? 'text-green' : 'text-red'}>
              ({profit >= 0 ? '+' : ''}{profit.toFixed(2)})
            </span>
          )}
        </div>
        {item.profitMargin != null && (
          <p className={cn(
            'text-[10px] font-bold',
            item.profitMargin > 40 ? 'text-green' : item.profitMargin > 25 ? 'text-amber' : 'text-red'
          )}>
            {item.profitMargin.toFixed(1)}% margin
          </p>
        )}
        <span className={cn('inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border', statusColor)}>
          {item.listingStatus?.replace(/-/g, ' ') ?? 'not started'}
        </span>
      </div>
      <button
        onClick={() => onDiscuss(item)}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-b1/10 hover:bg-b1/20 text-b1 rounded-lg text-[10px] font-bold transition-colors active:scale-95"
      >
        <Sparkle size={12} weight="duotone" />
        Discuss
      </button>
    </Card>
  )
}

export function AIScreen({ currentItem, pipeline, settings, queueItems, onSaveDraft, onCreateListing, onPassItem, onRecalculate, onRescan, onOpenCamera, pendingMessage, onPendingMessageHandled, geminiService, onUpdateItem }: AIScreenProps) {
  const [tab, setTab] = useTabPreference<'chat' | 'scans' | 'tasks'>('ai-screen-v2', 'chat')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [description, setDescription] = useState('')
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

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
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
  }, [currentItem?.purchasePrice, buyPrice])

  // Receive messages sent from SessionScreen's AgentPanel and route them into chat
  useEffect(() => {
    if (!pendingMessage) return
    setChatInput(pendingMessage)
    setTab('chat')
    onPendingMessageHandled?.()
  }, [pendingMessage, onPendingMessageHandled, setTab])

  // Auto-switch to Scans tab when a new capture arrives so the user sees
  // the pipeline running — not the last-used tab (which is persisted and defaults to chat)
  useEffect(() => {
    if (currentItem) setTab('scans')
  }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  const prevAIChatCount = useRef(chatMessages.length)
  const aiHasMounted = useRef(false)
  useEffect(() => {
    if (!aiHasMounted.current) {
      aiHasMounted.current = true
      prevAIChatCount.current = chatMessages.length
      return
    }
    if (shippingCost === '' && settings?.defaultShippingCost) {
      setShippingCost(String(settings.defaultShippingCost))
    }
    prevAIChatCount.current = chatMessages.length
  }, [chatMessages])

  const buildAIContext = useCallback(() => {
    const buyItems = queueItems?.filter(i => i.decision === 'BUY' && i.inQueue) ?? []
    const passItems = queueItems?.filter(i => i.decision === 'PASS') ?? []
    const totalProfit = buyItems.reduce((sum, i) => {
      if (i.estimatedSellPrice && i.purchasePrice) {
        return sum + (i.estimatedSellPrice - i.purchasePrice)
      }
      return sum
    }, 0)
    const context = {
      currentAnalysis: currentItem ? {
        productName: currentItem.productName,
        description: currentItem.description,
        category: currentItem.category,
        purchasePrice: currentItem.purchasePrice,
        estimatedSellPrice: currentItem.estimatedSellPrice,
        profitMargin: currentItem.profitMargin,
        decision: currentItem.decision,
        marketData: currentItem.marketData,
      } : null,
      queue: {
        totalItems: queueItems?.length ?? 0,
        buyCount: buyItems.length,
        passCount: passItems.length,
        estimatedProfit: totalProfit.toFixed(2),
        recentItems: buyItems.slice(0, 5).map(i => ({
          name: i.productName,
          buyPrice: i.purchasePrice,
          sellPrice: i.estimatedSellPrice,
          margin: i.profitMargin,
        }))
      },
      pipelineStatus: pipeline.map(p => ({
        step: p.label,
        status: p.status,
        data: p.data
      })),
      settings: {
        minProfitMargin: settings?.minProfitMargin,
        defaultShippingCost: settings?.defaultShippingCost,
        ebayFeePercent: settings?.ebayFeePercent,
        ebayAdFeePercent: settings?.ebayAdFeePercent ?? 3.0,
        shippingMaterialsCost: settings?.shippingMaterialsCost ?? 0.75,
        preferredAiModel: settings?.preferredAiModel
      }
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

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsSendingMessage(true)

    try {
      const contextData = buildAIContext()
      const lowerInput = chatInput.toLowerCase()
      let response: string

      // Detect intent to identify / update the current item agentically
      const isUpdateIntent =
        lowerInput.includes('fill in') || lowerInput.includes('fill it in') ||
        lowerInput.includes('find them') || lowerInput.includes('find it') ||
        lowerInput.includes('identify') || lowerInput.includes('what is this') ||
        lowerInput.includes('what are these') || lowerInput.includes('what is it') ||
        lowerInput.includes('fix the details') ||
        lowerInput.includes('analyze this') || lowerInput.includes('re-analyze') ||
        (currentItem?.productName === 'Unknown Product' && lowerInput.includes('name'))

      if (isUpdateIntent && currentItem) {
        const imageSource = currentItem.imageData || currentItem.imageThumbnail
        if (!settings?.geminiApiKey) {
          response = 'To identify items automatically, add your Gemini API key in ⚙️ Settings → API Keys. Once set, I can analyze images and update the product name, category, and sell price for you.'
        } else if (!imageSource) {
          response = "This item has no image attached. Tap Rescan to capture it with the camera, then ask me again — I'll identify it and fill in all the details."
        } else if (!geminiService) {
          response = 'Gemini service is not available. Please check your API key in Settings.'
        } else {
          // Immediate feedback while working
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: '🔍 Analyzing the image...',
            timestamp: Date.now()
          }])
          try {
            const visionResult = await geminiService.analyzeProductImage(imageSource, {}, currentItem.purchasePrice)
            const updates: Partial<ScannedItem> = {}
            if (visionResult.productName && visionResult.productName !== 'Unknown Product') {
              updates.productName = visionResult.productName
            }
            if (visionResult.description) updates.description = visionResult.description
            // Skip generic "General" fallback when the item already has a specific category
            const nextCategory = visionResult.category
            const hasExistingCategory = !!currentItem.category
            if (nextCategory && (nextCategory !== 'General' || !hasExistingCategory)) {
              updates.category = nextCategory
            }

            // Best-effort market research for price
            if (updates.productName && settings.geminiApiKey) {
              try {
                const research = await researchProduct(
                  updates.productName,
                  { purchasePrice: currentItem.purchasePrice, category: updates.category },
                  settings.geminiApiKey
                )
                const price = parseResearchPrice(research)
                if (price > 0) updates.estimatedSellPrice = price
              } catch { /* price is best-effort */ }
            }
            onUpdateItem?.(currentItem.id, updates)
            response = buildUpdateSummary(updates, currentItem)
          } catch {
            response = "I wasn't able to identify the product from the image. Try a clearer photo (tap Rescan), or type the product name and ask me to research its value."
          }
        }
      } else {
        // Detect research/price questions and use web-grounded search
        const isResearchQuery = lowerInput.includes('price') || lowerInput.includes('worth') ||
          lowerInput.includes('value') || lowerInput.includes('research') ||
          lowerInput.includes('sell for') || lowerInput.includes('market') || lowerInput.includes('how much')

        if (isResearchQuery && currentItem?.productName && settings?.geminiApiKey) {
          response = await researchProduct(
            currentItem.productName,
            { purchasePrice: currentItem.purchasePrice, category: currentItem.category },
            settings.geminiApiKey
          )
        } else {
          const systemPrompt = `You are an AI assistant for a resale business shipping from Orlando, FL 32806.

## Fee model (always use for profit math)
- eBay FVF: 12.9% of sale price
- Promoted Listings ad fee: 3% of sale price
- Per-order fee: $0.30
- Shipping materials: $0.75/item
- Shipping: ~$5 (seller pays)
- Total effective: ~15.9% + $1.05 fixed per sale

## Anti-hallucination rules (CRITICAL)
- NEVER invent prices. If you don't have current market data, say so and suggest the user tap "Research Item" for a live marketplace search.
- Base pricing on actual SOLD comps only — not asking prices or MSRP.
- Distinguish sell-through rate tiers: HIGH (>70%) / MEDIUM (40-70%) / LOW (<40%). Default to MEDIUM when uncertain.
- Prefer conservative profit estimates. Overestimating costs real money.
- All profit figures must be NET (after ALL fees + shipping + materials).

Be helpful, concise, and specific. Reference the scanned item's data when available.`
          // Guard: surface missing API key as a friendly in-chat message instead
          // of throwing an opaque error that gets swallowed by the generic catch.
          if (!settings?.geminiApiKey && !settings?.anthropicApiKey) {
            response = '⚙️ No AI API key configured. Go to **Settings → AI Configuration** and add your Gemini or Claude API key to start chatting.'
          } else {
            const promptText = `## App State\n\`\`\`\n${contextData}\n\`\`\`\n\nUser: ${chatInput}`
            response = await callLLM(promptText, {
              task: 'chat',
              geminiApiKey: settings?.geminiApiKey,
              systemPrompt,
            })
          }
        }
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      }

      setChatMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('AI chat error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      // Surface actionable errors (API key, safety block) as toasts;
      // transient errors get an inline message so the user can simply retry
      if (errorMsg.includes('API key') || errorMsg.includes('configure') || errorMsg.includes('unavailable')) {
        toast.error(errorMsg)
      }
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg.includes('API key') || errorMsg.includes('configure')
          ? '⚙️ No AI API key configured. Go to **Settings → AI Configuration** and add your Gemini or Claude API key.'
          : 'I had trouble with that request. Please try again.',
        timestamp: Date.now()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSendingMessage(false)
    }
  }, [chatInput, isSendingMessage, buildAIContext, settings?.geminiApiKey, currentItem, geminiService, onUpdateItem])

  return (
    <div className="flex flex-col w-full h-full bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />
      <div className="flex-shrink-0 px-3 pt-2 pb-0 sm:px-4 border-b border-s2 bg-fg sticky top-0 z-10 shadow-sm">
        <div className="tab-bar">
          <button
            onClick={() => setTab('chat')}
            className={cn('tab-btn', tab === 'chat' && 'active')}
          >
            <span>💬 CHAT</span>
          </button>
          <button
            onClick={() => setTab('scans')}
            className={cn('tab-btn', tab === 'scans' && 'active')}
          >
            <span>🔎 SCANS</span>
          </button>
          <button
            onClick={() => setTab('tasks')}
            className={cn('tab-btn', tab === 'tasks' && 'active')}
          >
            <span>✅ TASKS{pendingTasks.length > 0 && ` (${pendingTasks.length})`}</span>
          </button>
        </div>
      </div>

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
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {currentItem?.productName === 'Unknown Product' && (
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
                          <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                            <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Profit Margin</p>
                            <p className={cn(
                              "text-base sm:text-lg font-mono font-bold",
                              (currentItem.profitMargin || 0) > 40 ? "text-green" :
                              (currentItem.profitMargin || 0) > 25 ? "text-amber" : "text-red"
                            )}>
                              {currentItem.profitMargin?.toFixed(1) || '--'}%
                            </p>
                          </div>
                          <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                            <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Net Profit <span className="normal-case font-normal">(after fees)</span></p>
                            {(() => {
                              const netProfit = currentItem.profitMargin != null && currentItem.estimatedSellPrice
                                ? (currentItem.profitMargin / 100) * currentItem.estimatedSellPrice
                                : (currentItem.estimatedSellPrice || 0) - currentItem.purchasePrice
                              return (
                                <p className={cn("text-base sm:text-lg font-mono font-bold", netProfit >= 0 ? "text-green" : "text-red")}>
                                  {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                                </p>
                              )
                            })()}
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
                                  'p-1 rounded-md transition-colors',
                                  isListening
                                    ? 'text-red animate-pulse'
                                    : 'text-t3 hover:text-t1',
                                )}
                              >
                                <Microphone size={12} weight="bold" />
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
            {/* Listing Queue section */}
            {(() => {
              const listingItems = (queueItems || []).filter(i => i.decision === 'BUY' && i.inQueue)
              if (!listingItems.length) return null
              return (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 py-2 border-t border-s2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-t2">Listing Queue</span>
                    <span className="text-[10px] text-t3 bg-s1 px-1.5 py-0.5 rounded font-bold">{listingItems.length}</span>
                  </div>
                  {listingItems.map(item => (
                    <QueueListingCard key={item.id} item={item} onDiscuss={handleDiscussItem} />
                  ))}
                </div>
              )
            })()}
          </div>
        )}
        {tab === 'chat' && (
          <div className="flex flex-col min-h-full">
            <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4" ref={(el) => {
              if (el) (chatScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el?.closest('.overflow-y-auto') as HTMLDivElement ?? el
            }}>
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-3 sm:mb-4">
                    <Sparkle size={32} weight="duotone" className="text-b1 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-t1 mb-1.5 sm:mb-2">AI Assistant Ready</h3>
                  <p className="text-xs sm:text-sm text-t3 max-w-xs mb-3 sm:mb-4">Ask questions about the current analysis, get insights, or request market advice</p>
                  <div className="space-y-2 w-full max-w-xs">
                    <button
                      onClick={() => setChatInput("What's the profit potential for this item?")}
                      className="w-full p-2.5 sm:p-3 bg-fg border border-s2 rounded-lg text-left text-[11px] sm:text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
                    >
                      💰 What's the profit potential?
                    </button>
                    <button
                      onClick={() => setChatInput("Should I negotiate the price down?")}
                      className="w-full p-2.5 sm:p-3 bg-fg border border-s2 rounded-lg text-left text-[11px] sm:text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
                    >
                      🤝 Should I negotiate?
                    </button>
                    <button
                      onClick={() => setChatInput("What are similar items selling for?")}
                      className="w-full p-2.5 sm:p-3 bg-fg border border-s2 rounded-lg text-left text-[11px] sm:text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
                    >
                      📊 What are market prices?
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] rounded-xl p-2.5 sm:p-3 shadow-sm",
                      msg.role === 'user'
                        ? "ml-auto bg-gradient-to-br from-b1 to-b2 text-white"
                        : "bg-fg border border-s2 text-t1"
                    )}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div
                        className="text-xs sm:text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: marked.parse(
                          msg.content
                            .replace(/^([A-Z_]+):\s*N\/A\s*$/gm, '')
                            .trim()
                        ) as string }}
                      />
                    )}
                    <p className={cn(
                      "text-[10px] sm:text-xs mt-1 sm:mt-1.5",
                      msg.role === 'user' ? "text-white/70" : "text-t3"
                    )}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
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

      <div
        className="flex-shrink-0 border-t border-s2 bg-fg/95 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      >

        {tab === 'chat' && (
          <div className="p-2.5 sm:p-3">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Ask AI anything..."
                className="flex-1 h-10 sm:h-11 bg-bg border-s2 text-base"
                disabled={isSendingMessage}
              />
              <Button
                onClick={() => onRescan?.()}
                className="w-full h-9 sm:h-10 bg-b1 hover:bg-b2 text-white font-semibold text-xs sm:text-sm"
              >
                <Scan size={15} weight="bold" className="mr-1.5" />
                Scan Another Item
              </Button>
            </div>
          </div>
        )}

        {tab === 'scans' && hasDecision && (
          /* Post-pipeline CTA bar: Recalculate / Rescan / Pass / Create Listing */
          <div className="p-2.5 sm:p-3 space-y-2">
            {/* Price + Notes row */}
            <div className="flex gap-2">
              <Input
                id="ai-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Buy $"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-20 sm:w-24 h-11 sm:h-10 font-mono bg-bg border-s2 text-base"
              />
              <div className="flex-1 relative">
                <Input
                  id="ai-describe"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes..."
                  className="h-11 sm:h-10 pr-10 bg-bg border-s2 text-base"
                />
                {isSupported && (
                  <button
                    onClick={() => startListening((text) => setDescription(text))}
                    className={cn(
                      "absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors",
                      isListening
                        ? "bg-red text-white animate-pulse"
                        : "bg-s1 hover:bg-s2 text-t3 hover:text-t1"
                    )}
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
                Buy ✅
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
              className="w-full h-9 sm:h-10 border-s2 text-t2 hover:text-t1 hover:bg-s1 text-xs sm:text-sm"
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
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-20 sm:w-24 h-11 sm:h-10 font-mono bg-bg border-s2 text-base"
              />
              <div className="flex-1 relative">
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes or description..."
                  className="h-11 sm:h-10 pr-10 bg-bg border-s2 text-base"
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
                onClick={() => onCreateListing(parseFloat(buyPrice), description)}
                disabled={!canSaveDraft}
                className="flex-1 bg-b1 hover:bg-b2 text-white h-11 sm:h-10 font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <ShoppingCart size={16} weight="bold" className="mr-1.5 sm:mr-2" />
                Buy ✅
              </Button>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="p-2.5 sm:p-3">
            <div className="flex gap-2">
              <Input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask() }}
                placeholder="Add a task..."
                className="flex-1 h-10 sm:h-11 bg-bg border-s2 text-base"
              />
              <Button
                onClick={handleAddTask}
                disabled={!taskInput.trim()}
                className="bg-b1 hover:bg-b2 text-white h-10 sm:h-11 w-10 sm:w-11 p-0 flex-shrink-0 disabled:opacity-40"
              >
                <Plus size={18} weight="bold" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
