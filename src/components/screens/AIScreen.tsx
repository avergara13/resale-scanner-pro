import { useState, useMemo, useRef, useCallback } from 'react'
import { Robot, PencilSimple, Plus, Microphone, Scan, FloppyDisk, Confetti, PaperPlaneRight, Sparkle } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PipelinePanel } from './PipelinePanel'
import { DecisionSignal } from './DecisionSignal'
import { MarketDataPanel } from '../MarketDataPanel'
import { GoogleLensResults } from '../GoogleLensResults'
import { ApiStatusIndicator } from '../ApiStatusIndicator'
import { ThemeToggle } from '../ThemeToggle'
import { useVoiceInput } from '@/hooks/use-voice-input'
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
  const [tab, setTab] = useState<'analysis' | 'chat'>('analysis')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [description, setDescription] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const { isListening, startListening, isSupported } = useVoiceInput()
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const decision = currentItem?.decision
  const canSaveDraft = currentItem?.imageData || description.trim().length > 0

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
      const fullPrompt = `You are an AI assistant specialized in resale business analysis. You have access to the following app context:\n\n${contextData}\n\nUser question: ${chatInput}\n\nProvide a helpful, concise response based on the context. If analyzing an item, reference specific data from the current analysis. Be professional but conversational.`

      const response = await window.spark.llm(fullPrompt, settings?.preferredAiModel || 'gpt-4o')

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
    <div id="scr-ai" className="flex flex-col h-full bg-bg">
      <div id="ai-topbar" className="p-4 border-b border-s2 bg-fg sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-b1 to-amber text-white rounded-lg flex items-center justify-center shadow-md">
              <Robot size={20} weight="fill" />
            </div>
            <div>
              <h2 className="font-bold text-base text-t1">AI Command Center</h2>
              <p className="text-[10px] text-t3 font-medium tracking-wide">Powered by {settings?.preferredAiModel || 'Gemini'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ApiStatusIndicator settings={settings} compact liveUpdates={true} />
          </div>
        </div>
        <div className="tab-bar">
          <button
            onClick={() => setTab('analysis')}
            className={cn('tab-btn', tab === 'analysis' && 'active')}
          >
            📊 ANALYSIS
          </button>
          <button
            onClick={() => setTab('chat')}
            className={cn('tab-btn', tab === 'chat' && 'active')}
          >
            💬 AI CHAT
          </button>
        </div>
      </div>

      <ScrollArea id="ai-panel" className="flex-1 overflow-y-auto">
        {tab === 'analysis' ? (
          <div className="p-4 space-y-4 pb-32">
            {pipeline.length === 0 ? (
              <div className="space-y-6">
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-4">
                    <Scan size={40} strokeWidth={1.5} className="text-b1" />
                  </div>
                  <h3 className="text-lg font-bold text-t1 mb-2">Ready to Analyze</h3>
                  <p className="text-sm text-t3 max-w-xs">Tap the camera button below to scan an item and start AI analysis</p>
                </div>
                <div className="px-4">
                  <ApiStatusIndicator settings={settings} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <OverallProgress steps={pipeline} />
                <PipelinePanel steps={pipeline} />
                
                {hasDecision && decision && (
                  <div className="mt-4">
                    <DecisionSignal decision={decision} item={currentItem} />
                  </div>
                )}

                {hasDecision && currentItem && (
                  <div className="mt-4 p-4 bg-fg border border-s2 rounded-xl space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-t2">QUICK SUMMARY</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-bg rounded-lg">
                        <p className="text-xs text-t3 mb-1">Buy Price</p>
                        <p className="text-lg font-mono font-bold text-t1">${currentItem.purchasePrice.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-bg rounded-lg">
                        <p className="text-xs text-t3 mb-1">Sell Price</p>
                        <p className="text-lg font-mono font-bold text-t1">${currentItem.estimatedSellPrice?.toFixed(2) || '--'}</p>
                      </div>
                      <div className="p-3 bg-bg rounded-lg">
                        <p className="text-xs text-t3 mb-1">Profit Margin</p>
                        <p className={cn(
                          "text-lg font-mono font-bold",
                          (currentItem.profitMargin || 0) > 50 ? "text-green" :
                          (currentItem.profitMargin || 0) > 20 ? "text-amber" : "text-red"
                        )}>
                          {currentItem.profitMargin?.toFixed(1) || '--'}%
                        </p>
                      </div>
                      <div className="p-3 bg-bg rounded-lg">
                        <p className="text-xs text-t3 mb-1">Net Profit</p>
                        <p className="text-lg font-mono font-bold text-t1">
                          ${((currentItem.estimatedSellPrice || 0) - currentItem.purchasePrice).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {currentItem?.lensAnalysis && (
                  <GoogleLensResults lensAnalysis={currentItem.lensAnalysis} />
                )}
                
                {currentItem?.marketData && (
                  <MarketDataPanel marketData={currentItem.marketData} />
                )}
                
                {currentItem?.imageData && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-t2 mb-2 px-1">SCANNED IMAGE</h3>
                    <img
                      src={currentItem.imageData}
                      alt="Scanned item"
                      className="w-full rounded-xl border-2 border-s2 shadow-md"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-b1/10 to-amber/10 flex items-center justify-center mb-4">
                    <Sparkle size={40} weight="duotone" className="text-b1" />
                  </div>
                  <h3 className="text-lg font-bold text-t1 mb-2">AI Assistant Ready</h3>
                  <p className="text-sm text-t3 max-w-xs mb-4">Ask questions about the current analysis, get insights, or request market advice</p>
                  <div className="space-y-2 w-full max-w-xs">
                    <button
                      onClick={() => setChatInput("What's the profit potential for this item?")}
                      className="w-full p-3 bg-fg border border-s2 rounded-lg text-left text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
                    >
                      💰 What's the profit potential?
                    </button>
                    <button
                      onClick={() => setChatInput("Should I negotiate the price down?")}
                      className="w-full p-3 bg-fg border border-s2 rounded-lg text-left text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
                    >
                      🤝 Should I negotiate?
                    </button>
                    <button
                      onClick={() => setChatInput("What are similar items selling for?")}
                      className="w-full p-3 bg-fg border border-s2 rounded-lg text-left text-xs text-t2 hover:border-b1 hover:bg-t4 transition-colors"
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
                      "max-w-[85%] rounded-xl p-3 shadow-sm",
                      msg.role === 'user'
                        ? "ml-auto bg-gradient-to-br from-b1 to-b2 text-white"
                        : "bg-fg border border-s2 text-t1"
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1.5",
                      msg.role === 'user' ? "text-white/70" : "text-t3"
                    )}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
              {isSendingMessage && (
                <div className="max-w-[85%] rounded-xl p-3 bg-fg border border-s2">
                  <div className="flex items-center gap-2 text-t3">
                    <div className="loading-spinner" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      <div id="ai-input-bar" className="border-t border-s2 bg-fg/95 backdrop-blur-md z-20">
        {tab === 'analysis' && hasDecision && (
          <div className="p-3 border-b border-s2">
            <Button
              onClick={onAddToQueue}
              className="w-full bg-gradient-to-r from-green to-green hover:opacity-90 text-white h-11 font-semibold shadow-lg"
            >
              <Plus size={20} weight="bold" className="mr-2" />
              Add to Queue
            </Button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="p-3">
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
                className="flex-1 h-11 bg-bg border-s2"
                disabled={isSendingMessage}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isSendingMessage}
                className="bg-b1 hover:bg-b2 text-white h-11 w-11 p-0 flex-shrink-0"
              >
                <PaperPlaneRight size={20} weight="bold" />
              </Button>
            </div>
          </div>
        )}

        {tab === 'analysis' && (
          <div className="p-3 space-y-2.5">
            <div className="flex gap-2">
              <Input
                id="ai-price"
                type="number"
                step="0.01"
                placeholder="Buy $"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-24 h-10 font-mono bg-bg border-s2"
              />
              <div className="flex-1 relative">
                <Input
                  id="ai-describe"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add notes or description..."
                  className="h-10 pr-10 bg-bg border-s2"
                />
                {isSupported && (
                  <button
                    onClick={() => startListening((text) => setDescription(text))}
                    className={cn(
                      "absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                      isListening
                        ? "bg-red text-white animate-pulse"
                        : "bg-s1 hover:bg-s2 text-t3 hover:text-t1"
                    )}
                  >
                    <Microphone size={16} weight="bold" />
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
              className="w-full bg-t1 hover:bg-t2 text-white h-10 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FloppyDisk size={18} weight="bold" className="mr-2" />
              SAVE DRAFT TO QUEUE
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
