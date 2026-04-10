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
import { callLLM, researchProduct, parseResearchPrice } from '@/lib/llm-service'
import { useKV } from '@github/spark/hooks'
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
import { useTabPreference } from '@/hooks/use-tab-preference'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import type { ScannedItem, PipelineStep, AppSettings, ChatMessage, SharedTodo } from '@/types'
import type { GeminiService } from '@/lib/gemini-service'

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  settings?: AppSettings
  queueItems?: ScannedItem[]
  onSaveDraft: (price: number, notes: string) => void
  onCreateListing: (price: number, notes: string) => void
  onPassItem: (price: number, notes: string) => void
  onRecalculate?: (price: number) => void
  onRescan?: () => void
  onOpenCamera?: () => void
  pendingMessage?: string | null
  onPendingMessageHandled?: () => void
  geminiService?: GeminiService | null
  onUpdateItem?: (itemId: string, updates: Partial<ScannedItem>) => void
}

function buildUpdateSummary(updates: Partial<ScannedItem>, prev: ScannedItem): string {
  const lines: string[] = ['✅ Updated the item with what I found:']
  if (updates.productName)        lines.push(`  • Name: "${updates.productName}"`)
  if (updates.category && updates.category !== prev.category)
                                  lines.push(`  • Category: ${updates.category}`)
  if (updates.estimatedSellPrice) lines.push(`  • Est. sell price: $${updates.estimatedSellPrice.toFixed(2)}`)
  if (updates.description)        lines.push(`  • Description updated`)
  if (lines.length === 1)         return "I couldn't extract enough details from the image. Try providing a clearer photo."
  lines.push('\nReview in Edit if anything needs adjusting, or ask me to research the price.')
  return lines.join('\n')
}

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
      style={{ 
        left: '50%',
        top: '50%',
        color,
        textShadow: `0 0 8px ${color}`,
      }}
      initial={{ 
        opacity: 0,
        x: 0,
        y: 0,
        scale: 0,
        rotate: 0
      }}
      animate={{ 
        opacity: [0, 1, 1, 0],
        x: randomX,
        y: [-80, -120, -160],
        scale: [0, 1.2, 1, 0.8],
        rotate: randomRotation
      }}
      transition={{ 
        duration: 1.2,
        delay,
        ease: 'easeOut'
      }}
    >
      {shape}
    </motion.div>
  )
}

function CelebrationEffect() {
  const particleCount = 20
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {Array.from({ length: particleCount }).map((_, i) => (
        <CelebrationParticle 
          key={i} 
          index={i} 
          delay={i * 0.03}
        />
      ))}
    </div>
  )
}

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
    const controls = animate(count, overallProgress, {
      duration: 0.6,
      ease: 'easeOut'
    })
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
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-t2">
          OVERALL PROGRESS
        </h3>
        <motion.div className="text-lg font-mono font-black tabular-nums relative">
          <motion.span
            className={cn(
              "transition-colors duration-300",
              isComplete && "text-green",
              isProcessing && "text-b1",
              !isProcessing && !isComplete && "text-t2"
            )}
            animate={isComplete ? {
              scale: [1, 1.15, 1],
            } : {}}
            transition={{
              duration: 0.5,
              ease: 'easeOut'
            }}
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
            "h-full relative",
            isComplete && "bg-gradient-to-r from-green via-green to-green",
            isProcessing && "bg-gradient-to-r from-b1 via-amber to-b1"
          )}
          initial={{ width: '0%' }}
          animate={{ 
            width: `${overallProgress}%`,
            backgroundPosition: isProcessing ? ['0% 50%', '100% 50%', '0% 50%'] : '0% 50%'
          }}
          transition={{
            width: { duration: 0.6, ease: 'easeOut' },
            backgroundPosition: isProcessing ? {
              duration: 2,
              ease: 'linear',
              repeat: Infinity
            } : { duration: 0 }
          }}
          style={{ backgroundSize: '200% 100%' }}
        >
          {isProcessing && (
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{
                animation: 'shimmer-sweep 1.5s ease-in-out infinite'
              }}
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
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [summaryOpen, setSummaryOpen] = useCollapsePreference('ai-summary', true)
  const [imageOpen, setImageOpen] = useCollapsePreference('ai-image', false)
  const { isListening, startListening, isSupported } = useVoiceInput()
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const [todos, setTodos] = useKV<SharedTodo[]>('shared-todos', [])
  const [taskInput, setTaskInput] = useState('')
  const pendingTasks = (todos || []).filter(t => !t.completed)
  const completedTasks = (todos || []).filter(t => t.completed)

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const decision = currentItem?.decision
  const canSaveDraft = currentItem?.imageData || description.trim().length > 0

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 600))
  }, [])

  const handleAddTask = useCallback(() => {
    const text = taskInput.trim()
    if (!text) return
    setTodos(prev => [...(prev || []), {
      id: Date.now().toString(),
      text,
      completed: false,
      createdBy: 'user' as const,
      createdAt: Date.now(),
    }])
    setTaskInput('')
  }, [taskInput, setTodos])

  const handleToggleTask = useCallback((id: string) => {
    setTodos(prev => (prev || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }, [setTodos])

  const handleDeleteTask = useCallback((id: string) => {
    setTodos(prev => (prev || []).filter(t => t.id !== id))
  }, [setTodos])

  const handleDiscussItem = useCallback((item: ScannedItem) => {
    const listingLabel = item.listingStatus?.replace(/-/g, ' ') ?? 'not started'
    const msg = `Let's work on ${item.productName || 'this item'} — buy price $${item.purchasePrice.toFixed(2)}, estimated sell $${item.estimatedSellPrice?.toFixed(2) ?? 'unknown'}, listing status: ${listingLabel}. Help me finalize the listing details.`
    setChatInput(msg)
    setTab('chat')
  }, [setTab])

  // Pre-fill buy price when currentItem changes (only if field is empty — never override user input)
  useEffect(() => {
    if (currentItem?.purchasePrice != null && buyPrice === '') {
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
    if (chatMessages.length > prevAIChatCount.current && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
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
        preferredAiModel: settings?.preferredAiModel
      }
    }
    return JSON.stringify(context, null, 2)
  }, [currentItem, pipeline, settings, queueItems])

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || isSendingMessage) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: Date.now()
    }

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
          const promptText = `You are an AI assistant for resale business analysis. Context:\n\n${contextData}\n\nUser: ${chatInput}\n\nProvide a helpful, concise response. Reference the scanned item's data. If the user asks about pricing or market value and you don't have data, suggest they tap "Research Item" in the Agent tab for live marketplace search.`
          response = await callLLM(promptText, {
            task: 'chat',
            geminiApiKey: settings?.geminiApiKey,
          })
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
      toast.error('Failed to get AI response')
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
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
        <div className="flex justify-center mb-2">
          <ApiStatusIndicator settings={settings} compact liveUpdates={true} />
        </div>
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

      <div className="flex-1 overflow-y-auto" ref={pullToRefresh.containerRef}>
        {tab === 'scans' && (
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-4">
            {pipeline.length === 0 ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-3 sm:mb-4">
                    <Scan size={32} strokeWidth={1.5} className="text-b1 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-t1 mb-1.5 sm:mb-2">Ready to Analyze</h3>
                  <p className="text-xs sm:text-sm text-t3 max-w-xs mb-4">Tap the camera button to scan an item and start AI analysis</p>
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
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {currentItem?.productName === 'Unknown Product' && (
                  <button
                    onClick={() => { setTab('chat'); setChatInput('Identify this item and fill in the details for me') }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber/10 border border-amber/30 text-left"
                  >
                    <span className="text-amber text-lg">🔍</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber">Product not identified</p>
                      <p className="text-[11px] text-t2">Tap to ask AI to identify and fill in the details</p>
                    </div>
                  </button>
                )}
                <OverallProgress steps={pipeline} />
                <PipelinePanel steps={pipeline} />
                
                {hasDecision && decision && (
                  <div className="mt-3 sm:mt-4">
                    <DecisionSignal decision={decision} item={currentItem} />
                  </div>
                )}

                {hasDecision && currentItem && (
                  <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                    <Card className="mt-3 sm:mt-4 p-3 sm:p-4 bg-fg border-s2 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <ChartBar size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-t1">QUICK SUMMARY</h3>
                          </div>
                          <CaretDown
                            size={18}
                            weight="bold"
                            className={cn(
                              "text-t3 transition-transform duration-200 flex-shrink-0",
                              summaryOpen && "rotate-180"
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                          <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                            <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Buy Price</p>
                            <p className="text-base sm:text-lg font-mono font-bold text-t1">${currentItem.purchasePrice.toFixed(2)}</p>
                          </div>
                          <div className="p-2.5 sm:p-3 bg-bg rounded-lg border border-s2">
                            <p className="text-[10px] sm:text-xs text-t3 mb-0.5 sm:mb-1">Sell Price</p>
                            <p className="text-base sm:text-lg font-mono font-bold text-t1">${currentItem.estimatedSellPrice?.toFixed(2) || '--'}</p>
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
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
                
                {currentItem?.lensAnalysis && (
                  <GoogleLensResults lensAnalysis={currentItem.lensAnalysis} />
                )}
                
                {currentItem?.marketData && (
                  <MarketDataPanel marketData={currentItem.marketData} />
                )}
                
                {currentItem?.imageData && (
                  <Collapsible open={imageOpen} onOpenChange={setImageOpen}>
                    <Card className="mt-3 sm:mt-4 p-3 sm:p-4 bg-fg border-s2 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Image size={18} weight="bold" className="text-b1 sm:w-5 sm:h-5" />
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-t1">SCANNED IMAGE</h3>
                          </div>
                          <CaretDown
                            size={18}
                            weight="bold"
                            className={cn(
                              "text-t3 transition-transform duration-200 flex-shrink-0",
                              imageOpen && "rotate-180"
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
                ))
              )}
              {isSendingMessage && (
                <div className="max-w-[85%] rounded-xl p-2.5 sm:p-3 bg-fg border border-s2">
                  <div className="flex items-center gap-2 text-t3">
                    <div className="loading-spinner" />
                    <span className="text-xs sm:text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'tasks' && (
          <div className="flex flex-col min-h-full">
            <div className="flex-1 p-3 sm:p-4">
              {(todos || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-3 sm:mb-4">
                    <ListChecks size={32} weight="duotone" className="text-b1 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-t1 mb-1.5 sm:mb-2">No Tasks Yet</h3>
                  <p className="text-xs sm:text-sm text-t3 max-w-xs">Add tasks below, or ask the AI to create tasks for you in the Chat tab.</p>
                </div>
              ) : (
                <div className="divide-y divide-s1">
                  {pendingTasks.map(todo => (
                    <div key={todo.id} className="flex items-center gap-2.5 py-2.5 group">
                      <button
                        onClick={() => handleToggleTask(todo.id)}
                        className="flex-shrink-0 w-5 h-5 rounded-md border border-s2 hover:border-b1 hover:bg-b1/10 transition-colors cursor-pointer"
                      />
                      <span className="flex-1 text-xs sm:text-sm text-t1 leading-snug">{todo.text}</span>
                      <span className={cn(
                        'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
                        todo.createdBy === 'agent' ? 'text-b1 bg-b1/10' : 'text-t3 bg-s1'
                      )}>
                        {todo.createdBy}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(todo.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                  {completedTasks.length > 0 && (
                    <div className="pt-3 pb-1">
                      <p className="text-[10px] text-t3 font-bold uppercase tracking-wide">Completed ({completedTasks.length})</p>
                    </div>
                  )}
                  {completedTasks.map(todo => (
                    <div key={todo.id} className="flex items-center gap-2.5 py-2.5 group opacity-50">
                      <button
                        onClick={() => handleToggleTask(todo.id)}
                        className="flex-shrink-0 w-5 h-5 rounded-md bg-green/15 border border-green/40 flex items-center justify-center"
                      >
                        <Check size={12} weight="bold" className="text-green" />
                      </button>
                      <span className="flex-1 text-xs sm:text-sm text-t2 leading-snug line-through">{todo.text}</span>
                      <button
                        onClick={() => handleDeleteTask(todo.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-t3 hover:text-red p-1"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-s2 bg-fg/95 backdrop-blur-md safe-bottom">

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
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isSendingMessage}
                className="bg-b1 hover:bg-b2 text-white h-10 sm:h-11 w-10 sm:w-11 p-0 flex-shrink-0"
              >
                <PaperPlaneRight size={18} weight="bold" className="sm:w-5 sm:h-5" />
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
                    <Microphone size={14} weight="bold" className="sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Recalculate — only visible when buy price changed */}
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
                Buy ✅
              </Button>
            </div>
          </div>
        )}

        {tab === 'scans' && !hasDecision && (
          /* Pre-pipeline or in-progress: Save Draft */
          <div className="p-2.5 sm:p-3 space-y-2">
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
                  placeholder="Add notes or description..."
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
                    <Microphone size={14} weight="bold" className="sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {currentItem && (
                <Button
                  onClick={() => onRescan?.()}
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
