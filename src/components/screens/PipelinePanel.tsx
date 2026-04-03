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

  return (
    <div id="ai-pipeline" className="space-y-2">
      {steps.map((step) => {
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
            id={`phase-${step.id}`}
            className={cn(
              'p-3 rounded-xl border transition-all duration-300',
              isComplete && 'bg-s1 border-b1',
              isProcessing && 'bg-bg border-b1 shadow-sm ring-1 ring-b1',
              isPending && 'bg-bg border-s2 opacity-50',
              isError && 'bg-red/5 border-red'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center',
                    isComplete && 'bg-green text-bg',
                    isProcessing && 'bg-b1 text-bg animate-pulse',
                    isPending && 'bg-s2 text-t4',
                    isError && 'bg-red text-bg'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle size={12} weight="bold" />
                  ) : isProcessing ? (
                    <Lightning size={12} weight="bold" />
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
                  <div className="w-1 h-1 bg-b1 rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-b1 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1 h-1 bg-b1 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
