import { Eye, MagnifyingGlass, TrendUp, Calculator, CheckCircle, Lightning, Clock } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineStep } from '@/types'

interface PipelinePanelProps {
  steps: PipelineStep[]
}

const phaseConfig = {
  vision: { 
    icon: Eye, 
    label: '1. IDENTIFYING ITEM', 
    detail: 'Visual matching & OCR...',
    duration: 3.5,
    progressSteps: [0, 0.25, 0.5, 0.75, 0.95],
    progressTiming: [0, 0.25, 0.5, 0.75, 1]
  },
  lens: { 
    icon: MagnifyingGlass, 
    label: '2. GOOGLE LENS', 
    detail: 'Finding similar items...',
    duration: 2.8,
    progressSteps: [0, 0.35, 0.65, 0.85, 0.95],
    progressTiming: [0, 0.3, 0.6, 0.85, 1]
  },
  market: { 
    icon: TrendUp, 
    label: '3. MARKET VELOCITY', 
    detail: 'Sell-through rate calculation...',
    duration: 4.2,
    progressSteps: [0, 0.20, 0.45, 0.70, 0.90],
    progressTiming: [0, 0.2, 0.5, 0.8, 1]
  },
  profit: { 
    icon: Calculator, 
    label: '4. EBAY MATH', 
    detail: 'Fees, shipping & net profit...',
    duration: 1.8,
    progressSteps: [0, 0.40, 0.70, 0.90, 0.95],
    progressTiming: [0, 0.35, 0.65, 0.9, 1]
  },
  decision: { 
    icon: CheckCircle, 
    label: '5. FINAL DECISION', 
    detail: 'Agentic recommendation...',
    duration: 2.2,
    progressSteps: [0, 0.30, 0.60, 0.85, 0.95],
    progressTiming: [0, 0.3, 0.6, 0.85, 1]
  },
}

function AnimatedPercentage({ targetValue, isActive }: { targetValue: number; isActive: boolean }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, Math.round)
  const displayValue = useTransform(rounded, (latest) => `${latest}%`)

  useEffect(() => {
    if (isActive) {
      const controls = animate(count, targetValue, {
        duration: 0.5,
        ease: 'easeOut'
      })
      return controls.stop
    }
  }, [count, targetValue, isActive])

  if (!isActive) {
    return <span className="text-sm font-mono font-bold text-t3">{targetValue}%</span>
  }

  return (
    <motion.span className="text-sm font-mono font-black text-b1 tabular-nums">
      {displayValue}
    </motion.span>
  )
}

export function PipelinePanel({ steps }: PipelinePanelProps) {
  if (steps.length === 0) {
    return null
  }

  const activeStepIndex = steps.findIndex(s => s.status === 'processing')
  const completedSteps = steps.filter(s => s.status === 'complete').length
  const progressPercentage = (completedSteps / steps.length) * 100

  return (
    <div id="ai-pipeline" className="space-y-2 relative">
      <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-s2 overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-full bg-gradient-to-b from-b1 via-amber to-green"
          initial={{ height: '0%' }}
          animate={{ height: `${progressPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {steps.map((step, index) => {
        const config = phaseConfig[step.id]
        const Icon = config.icon
        const isProcessing = step.status === 'processing'
        const isComplete = step.status === 'complete'
        const isError = step.status === 'error'
        const isPending = step.status === 'pending'

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            id={`phase-${step.id}`}
            className={cn(
              'pipeline-card relative pipeline-step-transition overflow-hidden',
              isComplete && 'done',
              isProcessing && 'running',
              isPending && 'pending',
              isError && 'error'
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 flex-shrink-0 border-2',
                    isComplete && 'bg-green text-white border-green shadow-[0_0_16px_oklch(0.55_0.20_145_/_0.5)]',
                    isProcessing && 'bg-b1 text-white border-b1 shadow-[0_0_16px_oklch(0.50_0.18_250_/_0.5)] animate-pulse',
                    isPending && 'bg-s1 text-t3 border-s2',
                    isError && 'bg-red text-white border-red shadow-[0_0_16px_oklch(0.55_0.22_25_/_0.5)]'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle size={16} weight="fill" />
                  ) : isProcessing ? (
                    <Lightning size={16} weight="fill" />
                  ) : (
                    <Clock size={14} weight="bold" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-t1 uppercase tracking-wide">{config.label}</h4>
                  {(isProcessing || step.data) && (
                    <p className="text-xs text-t2 mt-1 font-medium">
                      {step.data && typeof step.data === 'string' ? step.data : config.detail}
                    </p>
                  )}
                  {step.error && <p className="text-xs text-red mt-1 font-semibold">{step.error}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {isProcessing && (
                  <AnimatedPercentage 
                    targetValue={step.progress ?? 0} 
                    isActive={true}
                  />
                )}
                {isComplete && (
                  <span className="text-sm font-mono font-black text-green tabular-nums">100%</span>
                )}
                {isPending && (
                  <span className="text-sm font-mono font-bold text-t3 tabular-nums">0%</span>
                )}
                {isError && (
                  <span className="text-sm font-mono font-black text-red tabular-nums">ERR</span>
                )}
              </div>
            </div>

            {isProcessing && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-s1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-b1 via-amber to-b1 relative"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: config.progressSteps.map(val => `${val * 100}%`),
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{
                    width: {
                      duration: config.duration,
                      ease: 'easeOut',
                      times: config.progressTiming
                    },
                    backgroundPosition: {
                      duration: config.duration * 0.8,
                      ease: 'linear',
                      repeat: Infinity
                    }
                  }}
                  style={{ backgroundSize: '200% 100%' }}
                >
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{
                      animation: `shimmer-sweep ${config.duration * 0.7}s ease-in-out infinite`
                    }}
                  />
                </motion.div>
              </motion.div>
            )}

            {isComplete && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-s1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-green via-green to-green"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                  />
                </motion.div>
              </motion.div>
            )}

            {isError && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-s1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-red via-red to-red"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </motion.div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
