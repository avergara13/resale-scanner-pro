import { Eye, MagnifyingGlass, TrendUp, Calculator, CheckCircle, Lightning, Clock } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { PipelineStep } from '@/types'

interface PipelinePanelProps {
  steps: PipelineStep[]
}

const phaseConfig = {
  vision: { icon: Eye, label: '1. IDENTIFYING ITEM', detail: 'Visual matching & OCR...' },
  lens: { icon: MagnifyingGlass, label: '2. GOOGLE LENS', detail: 'Finding similar items...' },
  market: { icon: TrendUp, label: '3. MARKET VELOCITY', detail: 'Sell-through rate calculation...' },
  profit: { icon: Calculator, label: '4. EBAY MATH', detail: 'Fees, shipping & net profit...' },
  decision: { icon: CheckCircle, label: '5. FINAL DECISION', detail: 'Agentic recommendation...' },
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
              'pipeline-card relative pipeline-step-transition',
              isComplete && 'done',
              isProcessing && 'running',
              isPending && 'pending',
              isError && 'error'
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 relative z-10',
                    isComplete && 'bg-green text-bg shadow-[0_0_12px_oklch(0.60_0.17_145_/_0.4)]',
                    isProcessing && 'bg-b1 text-bg shadow-[0_0_12px_oklch(0.55_0.15_250_/_0.4)]',
                    isPending && 'bg-s2 text-t4',
                    isError && 'bg-red text-bg shadow-[0_0_12px_oklch(0.58_0.20_25_/_0.4)]'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle size={12} weight="bold" />
                  ) : isProcessing ? (
                    <Lightning size={12} weight="bold" className="animate-pulse" />
                  ) : (
                    <Clock size={12} weight="bold" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-t1 uppercase tracking-wider">{config.label}</h4>
                  {(isProcessing || step.data) && (
                    <p className="text-[10px] text-t3 mt-0.5">
                      {step.data && typeof step.data === 'string' ? step.data : config.detail}
                    </p>
                  )}
                  {step.error && <p className="text-[10px] text-red mt-0.5">{step.error}</p>}
                </div>
              </div>
              {isProcessing && (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-b1 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-b1 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-b1 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
