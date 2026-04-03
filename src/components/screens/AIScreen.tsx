import { useState, useMemo, useRef } from 'react'
import { Robot, PencilSimple, Plus, Microphone, Scan, FloppyDisk, Confetti } from '@phosphor-icons/react'
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
import type { ScannedItem, PipelineStep, AppSettings } from '@/types'

interface AIScreenProps {
  currentItem?: ScannedItem
  pipeline: PipelineStep[]
  settings?: AppSettings
  onAddToQueue: () => void
  onDeepSearch: () => void
  onSaveDraft: (price: number, notes: string) => void
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
  const [tab, setTab] = useState<'agent' | 'manual'>('agent')
  const [description, setDescription] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const { isListening, startListening, isSupported } = useVoiceInput()

  const hasDecision = pipeline.some(p => p.id === 'decision' && p.status === 'complete')
  const decision = currentItem?.decision
  const canSaveDraft = currentItem?.imageData || description.trim().length > 0

  return (
    <div id="scr-ai" className="flex flex-col h-full">
      <div id="ai-topbar" className="p-4 border-b border-s1 bg-fg sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-b1 to-amber text-white rounded-lg flex items-center justify-center">
              <Robot size={18} weight="fill" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-t1">AI COMMAND CENTER</h2>
              <p className="text-[10px] text-t2 font-medium">Gemini 3 Flash · Grounded</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ApiStatusIndicator settings={settings} compact liveUpdates={true} />
          </div>
        </div>
        <div className="tab-bar">
          <button
            onClick={() => setTab('agent')}
            className={cn('tab-btn', tab === 'agent' && 'active')}
          >
            🤖 AGENT
          </button>
          <button
            onClick={() => setTab('manual')}
            className={cn('tab-btn', tab === 'manual' && 'active')}
          >
            📝 MANUAL
          </button>
        </div>
      </div>

      <ScrollArea id="ai-panel" className="flex-1 overflow-y-auto p-4 pb-32">
        {tab === 'agent' ? (
          <div className="space-y-6">
            {pipeline.length === 0 ? (
              <div className="space-y-6">
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <Scan size={64} strokeWidth={1} className="mb-4" />
                  <h3 className="text-lg font-bold">Ready to Scan</h3>
                  <p className="text-sm">Tap the eye below to start analysis</p>
                </div>
                <ApiStatusIndicator settings={settings} />
              </div>
            ) : (
              <>
                <OverallProgress steps={pipeline} />
                <PipelinePanel steps={pipeline} />
                
                {hasDecision && decision && (
                  <DecisionSignal decision={decision} item={currentItem} />
                )}
                
                {currentItem?.lensAnalysis && (
                  <GoogleLensResults lensAnalysis={currentItem.lensAnalysis} />
                )}
                
                {currentItem?.marketData && (
                  <MarketDataPanel marketData={currentItem.marketData} />
                )}
                
                {currentItem?.imageData && (
                  <div className="space-y-3 pt-2">
                    <img
                      src={currentItem.imageData}
                      alt="Scanned item"
                      className="w-full rounded-xl border border-s2"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Product Name
              </label>
              <Input id="manual-name" placeholder="Enter product name" className="h-10" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Category
              </label>
              <Input id="manual-category" placeholder="e.g., Electronics, Clothing" className="h-10" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Purchase Price
              </label>
              <Input id="manual-price" type="number" step="0.01" placeholder="$0.00" className="h-10 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-s4 mb-1.5">
                Notes
              </label>
              <Textarea
                id="manual-notes"
                placeholder="Condition, brand, special features..."
                className="min-h-24 resize-none"
              />
            </div>
            <Button className="w-full bg-b1 hover:bg-b2 text-bg h-10 font-medium">
              Analyze Item
            </Button>
          </div>
        )}
      </ScrollArea>

      <div id="ai-input-bar" className="absolute bottom-0 left-0 right-0 p-4 bg-bg/90 backdrop-blur-md border-t border-s2 z-20 space-y-3">
        {tab === 'agent' && hasDecision && (
          <Button
            onClick={onAddToQueue}
            className="w-full bg-b1 hover:bg-b2 text-bg h-12 font-medium"
          >
            <Plus size={20} weight="bold" className="mr-2" />
            Add to Queue
          </Button>
        )}
        
        <div className="flex gap-2">
          <Input
            id="ai-price"
            type="number"
            step="0.01"
            placeholder="Buy $"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            className="w-24 h-12 font-mono"
          />
          <div className="flex-1 relative">
            <Textarea
              id="ai-describe"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item or ask a question..."
              className="min-h-0 h-12 resize-none pr-12"
            />
            {isSupported && (
              <button
                onClick={() => startListening((text) => setDescription(text))}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                  isListening
                    ? "bg-red text-bg animate-pulse"
                    : "bg-s1 hover:bg-s2 text-s4 hover:text-fg"
                )}
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <Microphone size={18} weight="bold" />
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
          className="w-full bg-t1 hover:bg-t2 text-bg h-10 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FloppyDisk size={18} weight="bold" className="mr-2" />
          SAVE DRAFT TO QUEUE
        </Button>
      </div>
    </div>
  )
}
