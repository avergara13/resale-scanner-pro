import { useState, useMemo, useRef, useCallback } from 'react'
import { Robot, PencilSimple, Plus, Microphone, Scan, FloppyDisk, Confetti, PaperPlaneRight, Sparkle, CaretDown, ChartBar, Image } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { ThemeToggle } from '../ThemeToggle'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { useCollapsePreference } from '@/hooks/use-collapse-preference'
import { useTabPreference } from '@/hooks/use-tab-preference'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { toast } from 'sonner'
import type { ScannedItem, PipelineStep, AppSettings } from '@/types'

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  settings?: AppSettings
  onAddToQueue: () => void
  onDeepSearch: () => void
  onSaveDraft: (price: number, notes: string) => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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

export function AIScreen({ currentItem, pipeline, settings, onAddToQueue, onDeepSearch, onSaveDraft }: AIScreenProps) {
  const [tab, setTab] = useTabPreference<'analysis' | 'chat'>('ai-screen', 'analysis')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [description, setDescription] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [summaryOpen, setSummaryOpen] = useCollapsePreference('ai-summary', true)
  const [imageOpen, setImageOpen] = useCollapsePreference('ai-image', false)
  const { isListening, startListening, isSupported } = useVoiceInput()
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const decision = currentItem?.decision
  const canSaveDraft = currentItem?.imageData || description.trim().length > 0

  const handleRefresh = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 800))
    toast.success('AI analysis refreshed')
  }, [])

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  })

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const buildAIContext = useCallback(() => {
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
  }, [currentItem, pipeline, settings])

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
      const promptText = `You are an AI assistant specialized in resale business analysis. You have access to the following app context:\n\n${contextData}\n\nUser question: ${chatInput}\n\nProvide a helpful, concise response based on the context. If analyzing an item, reference specific data from the current analysis. Be professional but conversational.`
      const prompt = window.spark.llmPrompt([promptText] as any, contextData, chatInput)

      const response = await window.spark.llm(promptText, settings?.preferredAiModel || 'gpt-4o')

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
  }, [chatInput, isSendingMessage, buildAIContext, settings?.preferredAiModel])

  return (
    <div className="flex flex-col w-full h-full min-h-screen bg-bg">
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        progress={pullToRefresh.progress}
        shouldTrigger={pullToRefresh.shouldTrigger}
      />
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-s2 bg-fg sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-b1 to-amber text-white rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <Robot size={18} weight="fill" className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-t1 truncate">AI Command Center</h2>
              <p className="text-[9px] sm:text-[10px] text-t3 font-medium tracking-wide truncate">Powered by {settings?.preferredAiModel || 'Gemini'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <ThemeToggle />
            <ApiStatusIndicator settings={settings} compact liveUpdates={true} />
          </div>
        </div>
        <div className="tab-bar">
          <button
            onClick={() => setTab('analysis')}
            className={cn('tab-btn', tab === 'analysis' && 'active')}
          >
            <span className="hidden sm:inline">📊 ANALYSIS</span>
            <span className="sm:hidden">📊 ANALYZE</span>
          </button>
          <button
            onClick={() => setTab('chat')}
            className={cn('tab-btn', tab === 'chat' && 'active')}
          >
            <span className="hidden sm:inline">💬 AI CHAT</span>
            <span className="sm:hidden">💬 CHAT</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'analysis' ? (
          <div ref={pullToRefresh.containerRef} className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-40 sm:pb-44">
            {pipeline.length === 0 ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-3 sm:mb-4">
                    <Scan size={32} strokeWidth={1.5} className="text-b1 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-t1 mb-1.5 sm:mb-2">Ready to Analyze</h3>
                  <p className="text-xs sm:text-sm text-t3 max-w-xs">Tap the camera button below to scan an item and start AI analysis</p>
                </div>
                <div className="px-2 sm:px-4">
                  <ApiStatusIndicator settings={settings} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
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
                              (currentItem.profitMargin || 0) > 50 ? "text-green" :
                              (currentItem.profitMargin || 0) > 20 ? "text-amber" : "text-red"
                            )}>
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
          </div>
        ) : (
          <div className="flex flex-col min-h-full pb-32 sm:pb-36">
            <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4" ref={(el) => {
              if (el) {
                (pullToRefresh.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                (chatScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }
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
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
      </div>

      <div className="fixed bottom-[80px] left-0 right-0 max-w-[480px] mx-auto border-t border-s2 bg-fg/95 backdrop-blur-md z-20 safe-bottom">
        {tab === 'analysis' && hasDecision && (
          <div className="p-2.5 sm:p-3 border-b border-s2">
            <Button
              onClick={onAddToQueue}
              className="w-full bg-gradient-to-r from-green to-green hover:opacity-90 text-white h-10 sm:h-11 font-semibold shadow-lg text-sm"
            >
              <Plus size={18} weight="bold" className="mr-1.5 sm:mr-2" />
              Add to Queue
            </Button>
          </div>
        )}

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
                className="flex-1 h-10 sm:h-11 bg-bg border-s2 text-sm"
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

        {tab === 'analysis' && (
          <div className="p-2.5 sm:p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                id="ai-price"
                type="number"
                step="0.01"
                placeholder="Buy $"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-20 sm:w-24 h-9 sm:h-10 font-mono bg-bg border-s2 text-sm"
              />
              <div className="flex-1 relative">
                <Input
                  id="ai-describe"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add notes or description..."
                  className="h-9 sm:h-10 pr-10 bg-bg border-s2 text-sm"
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

            <Button
              onClick={() => {
                const price = parseFloat(buyPrice) || 0
                onSaveDraft(price, description)
              }}
              disabled={!canSaveDraft}
              className="w-full bg-t1 hover:bg-t2 text-white h-9 sm:h-10 font-medium disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <FloppyDisk size={16} weight="bold" className="mr-1.5 sm:mr-2" />
              SAVE DRAFT TO QUEUE
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
